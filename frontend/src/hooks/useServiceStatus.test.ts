import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGetServiceStatuses, mockGetDockerStatus, mockRuntime } = vi.hoisted(() => ({
  mockGetServiceStatuses: vi.fn(),
  mockGetDockerStatus: vi.fn(),
  mockRuntime: { getStatus: vi.fn(), checkStatus: vi.fn() },
}));
vi.mock('../requests/services', () => ({
  getServiceStatuses: mockGetServiceStatuses,
  getDockerStatus: mockGetDockerStatus,
}));
vi.mock('../services/runtimeManager', () => ({ runtimeManager: mockRuntime }));

import { useServiceStatus } from './useServiceStatus';

const cachedRuntime = { appRunning: true, backendConnected: true, dockerAvailable: true, servicesRunning: ['sonarr'], lastCheck: new Date() };
const freshRuntime = { ...cachedRuntime, servicesRunning: ['sonarr', 'radarr'] };

beforeEach(() => {
  mockGetServiceStatuses.mockReset().mockResolvedValue({ sonarr: 'Running', radarr: 'Stopped' });
  mockGetDockerStatus.mockReset().mockResolvedValue({ docker: true, compose: true });
  mockRuntime.getStatus.mockReset().mockReturnValue(cachedRuntime);
  mockRuntime.checkStatus.mockReset().mockResolvedValue(freshRuntime);
});

describe('useServiceStatus', () => {
  it('loads service, docker, and runtime status on mount and clears loading', async () => {
    const { result } = renderHook(() => useServiceStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.serviceStatus).toEqual({ sonarr: 'Running', radarr: 'Stopped' });
    expect(result.current.dockerStatus.running).toBe(true);
    expect(result.current.runtimeStatus).toEqual(cachedRuntime); // cached (getStatus) on load
  });

  it('marks docker not running when either flag is false', async () => {
    mockGetDockerStatus.mockResolvedValue({ docker: true, compose: false });
    const { result } = renderHook(() => useServiceStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dockerStatus.running).toBe(false);
  });

  it('refresh re-fetches and uses a fresh runtime check', async () => {
    const { result } = renderHook(() => useServiceStatus());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockGetServiceStatuses.mockResolvedValue({ sonarr: 'Running', radarr: 'Running' });
    await act(async () => { await result.current.refresh(); });
    expect(result.current.serviceStatus).toEqual({ sonarr: 'Running', radarr: 'Running' });
    expect(result.current.runtimeStatus).toEqual(freshRuntime); // fresh (checkStatus)
  });

  it('polls status + docker on a 30s interval', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useServiceStatus());
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetServiceStatuses).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGetServiceStatuses).toHaveBeenCalledTimes(2);
      expect(mockGetDockerStatus).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps prior service status when a fetch fails', async () => {
    const { result } = renderHook(() => useServiceStatus());
    await waitFor(() => expect(result.current.serviceStatus).toEqual({ sonarr: 'Running', radarr: 'Stopped' }));
    mockGetServiceStatuses.mockRejectedValue(new Error('boom'));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.serviceStatus).toEqual({ sonarr: 'Running', radarr: 'Stopped' }); // unchanged
  });
});
