import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { load as loadYaml } from 'js-yaml';

// Regression coverage for the bugs that broke the packaged macOS app: the data
// directory there is "~/Library/Application Support/Ensembler" — it contains a
// SPACE — and setup could leave media paths empty. Both produced a broken
// compose file (invalid YAML / unquoted shell paths) that stopped every service
// from starting. We reproduce a spaced data dir by mocking os.homedir().
//
// Also covers the security hardening: compose is emitted through a real YAML
// writer (js-yaml) so config values can't inject directives, docker runs via
// execFile (argv, no shell) so a service name can't inject commands, and the
// :serviceName routes reject unknown/hostile names before any docker call.

const HOME = '/Users/test user'; // note the space
const DATA_DIR = path.join(HOME, '.ensembler');
const configFile = path.join(DATA_DIR, 'config.json');
const composeFile = path.join(DATA_DIR, 'docker-compose.yml');

// Records every docker invocation so we can assert on the arguments. exec is
// called as (cmd); execFile as (file, argsArray) — flatten both to a string.
const mockExecCommands: string[] = [];

jest.mock('os', () => ({ ...jest.requireActual('os'), homedir: () => '/Users/test user' }));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
}));
jest.mock('child_process', () => ({
  exec: jest.fn((_cmd: string, cb: (e: unknown, o: string, s: string) => void) => cb(null, '', '')),
  execFile: jest.fn(),
}));
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: () => (...callArgs: unknown[]) => {
    const [first, second] = callArgs;
    mockExecCommands.push(Array.isArray(second) ? `${first} ${(second as string[]).join(' ')}` : String(first));
    return Promise.resolve({ stdout: '', stderr: '' });
  },
}));

import app from '../index';

// radarr's movies path is intentionally empty to exercise the fallback.
const config = {
  selectedServices: { sonarr: true, radarr: true },
  paths: {
    sonarr: ['/Users/test/My TV Shows'], // spaced media path
    radarr: [''],
  },
  ports: { sonarr: 8989, radarr: 7878 },
  environment: { tz: 'UTC', puid: 1000, pgid: 1000 },
};

const generatedCompose = (): string => {
  const call = (fs.writeFileSync as jest.Mock).mock.calls.find(c => c[0] === composeFile);
  return call ? String(call[1]) : '';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parsedCompose = (): any => loadYaml(generatedCompose());

beforeEach(() => {
  mockExecCommands.length = 0;
  jest.clearAllMocks();
  (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === configFile || p === composeFile);
  (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));
});

describe('compose generation with a spaced data dir', () => {
  it('emits valid YAML with the pinned project name', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    // loadYaml throws on invalid YAML, so a successful parse is the assertion.
    expect(parsedCompose().name).toBe('ensembler');
  });

  it('keeps a spaced volume path intact', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    const volumes: string[] = parsedCompose().services.sonarr.volumes;
    expect(volumes.some(v => /My TV Shows:\/tv$/.test(v))).toBe(true);
  });

  it('never leaks an unresolved {placeholder} or an empty host path', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    const services = parsedCompose().services;
    const allVolumes: string[] = Object.values(services).flatMap((s: any) => s.volumes); // eslint-disable-line @typescript-eslint/no-explicit-any
    allVolumes.forEach(v => {
      expect(v).not.toMatch(/\{[a-zA-Z.]+\}/); // e.g. {paths.movies}, {configDir}
      expect(v.startsWith(':')).toBe(false); // no empty host before the container path
    });
  });
});

describe('docker runs via execFile with no shell', () => {
  it('passes the compose file as a discrete argument (spaces are safe, no quoting needed)', async () => {
    await request(app).post('/api/services/sonarr/start').expect(200);
    const upCmd = mockExecCommands.find(c => c.includes('compose') && c.includes('up -d'));
    expect(upCmd).toBeDefined();
    expect(upCmd).toContain(`-f ${composeFile}`);
  });
});

describe('command injection is rejected before any docker call', () => {
  it('404s an unknown service name', async () => {
    await request(app).post('/api/services/notaservice/stop').expect(404);
    expect(mockExecCommands.length).toBe(0);
  });

  it('404s a shell-metacharacter service name and runs no command', async () => {
    await request(app).post('/api/services/sonarr%3Btouch%20pwned/stop').expect(404);
    expect(mockExecCommands.some(c => c.includes('touch'))).toBe(false);
  });
});

describe('YAML injection through config values is neutralised', () => {
  it('keeps a newline-laden TZ as a single scalar and injects no compose keys', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ ...config, environment: { tz: 'UTC\n    privileged: true', puid: 1000, pgid: 1000 } })
    );
    await request(app).post('/api/config/generate-compose').expect(200);
    const sonarr = parsedCompose().services.sonarr;
    expect(sonarr).not.toHaveProperty('privileged');
    expect(sonarr.environment).toContain('TZ=UTC\n    privileged: true');
  });
});

describe('PUID/PGID of 0 (root) survives generation', () => {
  it('does not coerce a legitimate 0 to 1000', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ ...config, environment: { tz: 'UTC', puid: 0, pgid: 0 } })
    );
    await request(app).post('/api/config/generate-compose').expect(200);
    const env: string[] = parsedCompose().services.sonarr.environment;
    expect(env).toContain('PUID=0');
    expect(env).toContain('PGID=0');
  });
});

describe('service update refreshes the cached status', () => {
  it('recomputes and returns hasUpdate after an update', async () => {
    const res = await request(app).post('/api/services/sonarr/update').expect(200);
    // Before the fix the endpoint returned only { success, message }; the
    // recomputed status is what stops a stale "update available" reappearing.
    expect(res.body).toHaveProperty('hasUpdate');
  });
});

describe('version pinning', () => {
  it('emits the default :latest image when nothing is pinned', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    expect(parsedCompose().services.sonarr.image).toBe('lscr.io/linuxserver/sonarr:latest');
  });

  it('pins a service to its configured tag and leaves others on latest', async () => {
    (fs.readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({ ...config, versions: { sonarr: '4.0.9' } })
    );
    await request(app).post('/api/config/generate-compose').expect(200);
    const services = parsedCompose().services;

    expect(services.sonarr.image).toBe('lscr.io/linuxserver/sonarr:4.0.9');
    expect(services.radarr.image).toBe('lscr.io/linuxserver/radarr:latest'); // unpinned
  });
});
