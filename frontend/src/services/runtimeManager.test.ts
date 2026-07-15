import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the request seam so runCheck's three probes return canned payloads.
const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../requests/client', () => ({ apiFetch: mockApiFetch }));

import { runtimeManager } from './runtimeManager';

// Minimal Response stand-in: runCheck only uses `.ok` and `.json()`.
const res = (ok: boolean, body: unknown) => ({ ok, json: async () => body });

// Route each probe URL to its response; unlisted URLs resolve ok+empty.
const wire = (byUrl: Record<string, ReturnType<typeof res>>) => {
  mockApiFetch.mockImplementation(async (url: string) => byUrl[url] ?? res(true, {}));
};

const DOCKER = '/api/docker/status';
const SERVICES = '/api/services/status';

beforeEach(() => mockApiFetch.mockReset());

describe('runtimeManager.checkStatus — response validation', () => {
  it('reflects valid docker + service payloads', async () => {
    wire({
      '/': res(true, {}),
      [DOCKER]: res(true, { docker: true, compose: true }),
      [SERVICES]: res(true, { success: true, serviceStatus: { sonarr: 'Running', radarr: 'Stopped' } }),
    });
    const status = await runtimeManager.checkStatus();
    expect(status.backendConnected).toBe(true);
    expect(status.dockerAvailable).toBe(true);
    expect(status.servicesRunning).toEqual(['sonarr']);
  });

  it('treats a malformed docker payload as docker-unavailable', async () => {
    wire({
      '/': res(true, {}),
      [DOCKER]: res(true, { docker: 'yes', compose: 1 }), // wrong types
      [SERVICES]: res(true, { success: true, serviceStatus: {} }),
    });
    const status = await runtimeManager.checkStatus();
    expect(status.dockerAvailable).toBe(false);
  });

  it('keeps the last good service list when the service payload is malformed', async () => {
    wire({
      '/': res(true, {}),
      [DOCKER]: res(true, { docker: true, compose: true }),
      [SERVICES]: res(true, { success: true, serviceStatus: { plex: 'Running' } }),
    });
    await runtimeManager.checkStatus();

    wire({
      '/': res(true, {}),
      [DOCKER]: res(true, { docker: true, compose: true }),
      [SERVICES]: res(true, { success: true, serviceStatus: 'not-an-object' }), // invalid
    });
    const status = await runtimeManager.checkStatus();
    expect(status.dockerAvailable).toBe(true);
    expect(status.servicesRunning).toEqual(['plex']); // unchanged, not corrupted
  });

  it('resets docker/service state and skips further probes when the backend is down', async () => {
    // Prime a good state first…
    wire({
      '/': res(true, {}),
      [DOCKER]: res(true, { docker: true, compose: true }),
      [SERVICES]: res(true, { success: true, serviceStatus: { plex: 'Running' } }),
    });
    await runtimeManager.checkStatus();

    // …then the backend goes down (ok:false, no throw).
    mockApiFetch.mockReset();
    wire({ '/': res(false, {}) });
    const status = await runtimeManager.checkStatus();

    expect(status.backendConnected).toBe(false);
    expect(status.dockerAvailable).toBe(false);
    expect(status.servicesRunning).toEqual([]);
    // docker/services are never probed when the backend is down
    expect(mockApiFetch).toHaveBeenCalledTimes(1);
  });
});
