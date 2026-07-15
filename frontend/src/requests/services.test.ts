import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('./client', () => ({ apiFetch: mockApiFetch }));

import {
  getDockerStatus,
  getServiceStatuses,
  getServiceUpdates,
  checkServiceUpdates,
  getServiceMonitor,
  getServiceVersion,
  getServiceLogs,
  getServiceUpdateStatus,
  getServiceCatalog,
} from './services';

const jsonRes = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => mockApiFetch.mockReset());

describe('getDockerStatus', () => {
  it('returns validated docker/compose flags', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ docker: true, compose: false, composeVersion: 'v2' }));
    expect(await getDockerStatus()).toEqual({ docker: true, compose: false });
  });

  it('throws on a malformed payload', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ docker: 'yes' }));
    await expect(getDockerStatus()).rejects.toThrow();
  });
});

describe('getServiceStatuses', () => {
  it('returns the serviceStatus map on success', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, serviceStatus: { sonarr: 'Running' } }));
    expect(await getServiceStatuses()).toEqual({ sonarr: 'Running' });
  });

  it('throws when success is false', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: false, serviceStatus: {} }));
    await expect(getServiceStatuses()).rejects.toThrow();
  });

  it('throws when serviceStatus is not a string map', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, serviceStatus: { sonarr: 1 } }));
    await expect(getServiceStatuses()).rejects.toThrow();
  });
});

describe('getServiceUpdates', () => {
  it('returns updates and lastChecked', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({
      success: true,
      updates: { sonarr: { hasUpdate: true }, radarr: { hasUpdate: null } },
      lastChecked: '2026-01-01T00:00:00Z',
    }));
    expect(await getServiceUpdates()).toEqual({
      updates: { sonarr: { hasUpdate: true }, radarr: { hasUpdate: null } },
      lastChecked: '2026-01-01T00:00:00Z',
    });
  });

  it('defaults lastChecked to null when absent', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, updates: {} }));
    expect(await getServiceUpdates()).toEqual({ updates: {}, lastChecked: null });
  });
});

describe('checkServiceUpdates', () => {
  it('returns the refreshed updates map', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, updates: { plex: { hasUpdate: false } } }));
    expect(await checkServiceUpdates()).toEqual({ plex: { hasUpdate: false } });
    expect(mockApiFetch).toHaveBeenCalledWith('/api/services/updates/check', { method: 'POST' });
  });
});

describe('getServiceMonitor', () => {
  it('returns the per-service monitor map on success', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({
      success: true,
      services: { sonarr: { status: 'running', healthy: true, alert: false } },
    }));
    expect(await getServiceMonitor()).toEqual({ sonarr: { status: 'running', healthy: true, alert: false } });
  });

  it('throws on a malformed monitor entry', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, services: { sonarr: { status: 'running' } } }));
    await expect(getServiceMonitor()).rejects.toThrow();
  });
});

describe('getServiceVersion', () => {
  it('returns the version string on success', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, version: '4.0.19' }));
    expect(await getServiceVersion('sonarr')).toBe('4.0.19');
  });

  it('returns "" when unsuccessful or version is absent', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: false }));
    expect(await getServiceVersion('sonarr')).toBe('');
  });
});

describe('getServiceLogs', () => {
  it('returns the logs on success', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, logs: 'line1\nline2' }));
    expect(await getServiceLogs('sonarr')).toBe('line1\nline2');
  });

  it('throws when unsuccessful', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: false }));
    await expect(getServiceLogs('sonarr')).rejects.toThrow();
  });
});

describe('getServiceUpdateStatus', () => {
  it('returns hasUpdate on success (including null)', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, hasUpdate: true, currentVersion: '4.0.1' }));
    expect(await getServiceUpdateStatus('sonarr')).toBe(true);
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, hasUpdate: null }));
    expect(await getServiceUpdateStatus('sonarr')).toBeNull();
  });

  it('throws when unsuccessful', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: false }));
    await expect(getServiceUpdateStatus('sonarr')).rejects.toThrow();
  });
});

describe('getServiceCatalog', () => {
  const entry = {
    key: 'sonarr', name: 'Sonarr', description: 'TV', category: 'management', defaultPort: 8989,
    pathRequirements: [{ label: 'TV', required: true, description: 'tv folder' }], required: false, recommended: true,
  };

  it('returns the validated catalog entries', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, services: [entry] }));
    const catalog = await getServiceCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({ key: 'sonarr', defaultPort: 8989, recommended: true });
  });

  it('accepts entries without the optional recommended flag', async () => {
    const { recommended, ...withoutRecommended } = entry;
    void recommended;
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, services: [withoutRecommended] }));
    expect((await getServiceCatalog())[0].recommended).toBeUndefined();
  });

  it('throws on a malformed entry', async () => {
    mockApiFetch.mockResolvedValue(jsonRes({ success: true, services: [{ key: 'x' }] }));
    await expect(getServiceCatalog()).rejects.toThrow();
  });
});
