import request from 'supertest';
import fs from 'fs';
import path from 'path';

// Regression coverage for the bugs that broke the packaged macOS app: the data
// directory there is "~/Library/Application Support/Ensembler" — it contains a
// SPACE — and setup could leave media paths empty. Both produced a broken
// compose file (invalid YAML / unquoted shell paths) that stopped every service
// from starting. We reproduce a spaced data dir by mocking os.homedir().

const HOME = '/Users/test user'; // note the space
const DATA_DIR = path.join(HOME, '.ensembler');
const configFile = path.join(DATA_DIR, 'config.json');
const composeFile = path.join(DATA_DIR, 'docker-compose.yml');

// Records every shell command so we can assert paths are quoted.
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
}));
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: () => (cmd: string) => {
    mockExecCommands.push(cmd);
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

beforeEach(() => {
  mockExecCommands.length = 0;
  jest.clearAllMocks();
  (fs.existsSync as jest.Mock).mockImplementation((p: string) => p === configFile || p === composeFile);
  (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));
});

describe('compose generation with a spaced data dir', () => {
  it('pins the project name so the dir path can never orphan containers', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    expect(generatedCompose()).toContain('name: ensembler');
  });

  it('quotes every volume mapping so spaces in paths stay valid YAML', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    const compose = generatedCompose();

    const volumeLines = compose
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^- .*:\/(config|tv|movies|downloads)/.test(l.replace(/"/g, '')));

    expect(volumeLines.length).toBeGreaterThan(0);
    volumeLines.forEach(line => expect(line).toMatch(/^- ".+:\/.+"$/));
    // The spaced host path survives, intact and quoted.
    expect(compose).toMatch(/- ".*My TV Shows.*:\/tv"/);
  });

  it('never leaks an unresolved {placeholder} or an empty host path', async () => {
    await request(app).post('/api/config/generate-compose').expect(200);
    const compose = generatedCompose();

    expect(compose).not.toMatch(/\{[a-zA-Z.]+\}/); // e.g. {paths.movies}, {configDir}
    expect(compose).not.toMatch(/- "?:\//);          // no empty host before the container path
  });
});

describe('docker commands quote the compose file path', () => {
  it('quotes -f so a spaced data dir does not break the shell', async () => {
    await request(app).post('/api/services/sonarr/start').expect(200);
    const upCmd = mockExecCommands.find(c => c.includes('compose') && c.includes('up -d'));
    expect(upCmd).toBeDefined();
    expect(upCmd).toContain(`-f "${composeFile}"`);
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
