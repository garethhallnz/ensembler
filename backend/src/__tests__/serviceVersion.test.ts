// Locks in the per-service version-probe behaviour before refactoring the
// switch in getServiceVersion. `mock`-prefixed name so jest's hoisted factory
// may reference it.
const mockExecAsync = jest.fn();
jest.mock('../services/exec', () => ({
  execAsync: (...args: unknown[]) => mockExecAsync(...args),
}));

import { getServiceVersion } from '../services/versions';

// Route each docker command the module issues to a canned stdout. `label`
// controls whether the OCI image-label probe yields a value; `apiByUrl` maps a
// curl URL to the JSON the container's status API returns.
const wireExec = (opts: { label?: string; apiByUrl?: Record<string, string>; raw?: Record<string, string> } = {}) => {
  const { label = '', apiByUrl = {}, raw = {} } = opts;
  mockExecAsync.mockImplementation(async (cmd: string) => {
    if (cmd.includes("--format='{{.Config.Image}}'")) return { stdout: label ? 'someimage:latest' : '' };
    if (cmd.includes('image inspect') && cmd.includes('index .Config.Labels')) return { stdout: label };
    if (cmd.includes('docker exec')) {
      for (const [url, out] of Object.entries(apiByUrl)) {
        if (cmd.includes(url)) return { stdout: out };
      }
      for (const [needle, out] of Object.entries(raw)) {
        if (cmd.includes(needle)) return { stdout: out };
      }
      return { stdout: '' };
    }
    return { stdout: '' };
  });
};

beforeEach(() => mockExecAsync.mockReset());

describe('getServiceVersion — image label wins first', () => {
  it('returns the OCI image-label version without probing the API', async () => {
    wireExec({ label: '4.0.19' });
    expect(await getServiceVersion('sonarr')).toBe('4.0.19');
    expect(mockExecAsync.mock.calls.some(([c]) => (c as string).includes('docker exec'))).toBe(false);
  });
});

describe('getServiceVersion — arr status API probe (no label)', () => {
  const cases = [
    { service: 'sonarr', url: 'http://localhost:8989/api/v3/system/status' },
    { service: 'radarr', url: 'http://localhost:7878/api/v3/system/status' },
    { service: 'prowlarr', url: 'http://localhost:9696/api/v1/system/status' },
    { service: 'overseerr', url: 'http://localhost:5055/api/v1/status' },
  ];

  it.each(cases)('reads $service version from its status endpoint', async ({ service, url }) => {
    wireExec({ apiByUrl: { [url]: '{"version":"9.9.9"}' } });
    expect(await getServiceVersion(service)).toBe('9.9.9');
    expect(mockExecAsync.mock.calls.some(([c]) => (c as string).includes(url))).toBe(true);
  });
});

describe('getServiceVersion — bespoke probes', () => {
  it('reads plex from /version.txt', async () => {
    wireExec({ raw: { 'cat /version.txt': '1.40.1.1234' } });
    expect(await getServiceVersion('plex')).toBe('1.40.1.1234');
  });

  it('extracts a clean transmission version from --version output', async () => {
    wireExec({ raw: { 'transmission-daemon --version': 'transmission-daemon 4.0.5 (abc)' } });
    expect(await getServiceVersion('transmission')).toBe('4.0.5');
  });
});

describe('getServiceVersion — fallback', () => {
  it('falls back to the image build date when no probe yields a version', async () => {
    mockExecAsync.mockImplementation(async (cmd: string) => {
      if (cmd.includes("--format='{{.Config.Image}}'")) return { stdout: 'lscr.io/linuxserver/sonarr:latest' };
      if (cmd.includes('--format "{{.Created}}"')) return { stdout: '2026-01-15T10:00:00Z' };
      return { stdout: '' };
    });
    expect(await getServiceVersion('sonarr')).toBe('2026-01-15');
  });
});
