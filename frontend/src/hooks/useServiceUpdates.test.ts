import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGetServiceUpdates, mockCheckServiceUpdates, mockGetServiceUpdateStatus } = vi.hoisted(() => ({
  mockGetServiceUpdates: vi.fn(),
  mockCheckServiceUpdates: vi.fn(),
  mockGetServiceUpdateStatus: vi.fn(),
}));
vi.mock('../requests/services', () => ({
  getServiceUpdates: mockGetServiceUpdates,
  checkServiceUpdates: mockCheckServiceUpdates,
  getServiceUpdateStatus: mockGetServiceUpdateStatus,
}));

import { useServiceUpdates } from './useServiceUpdates';

beforeEach(() => {
  mockGetServiceUpdates.mockReset().mockResolvedValue({ updates: { sonarr: { hasUpdate: true } }, lastChecked: new Date().toISOString() });
  mockCheckServiceUpdates.mockReset().mockResolvedValue({ sonarr: { hasUpdate: false } });
  mockGetServiceUpdateStatus.mockReset().mockResolvedValue(true);
});

describe('useServiceUpdates', () => {
  it('fetches updates on mount when there are services', async () => {
    const { result } = renderHook(() => useServiceUpdates(['sonarr']));
    await waitFor(() => expect(result.current.serviceUpdates).toEqual({ sonarr: { hasUpdate: true } }));
  });

  it('does not fetch when there are no services', async () => {
    renderHook(() => useServiceUpdates([]));
    await Promise.resolve();
    expect(mockGetServiceUpdates).not.toHaveBeenCalled();
  });

  it('runs a background availability check once when the cache is stale', async () => {
    mockGetServiceUpdates.mockResolvedValue({ updates: {}, lastChecked: null }); // never checked → stale
    const { result } = renderHook(() => useServiceUpdates(['sonarr']));
    await waitFor(() => expect(mockCheckServiceUpdates).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.serviceUpdates).toEqual({ sonarr: { hasUpdate: false } }));
  });

  it('checkAll returns the update count and toggles the checking flag', async () => {
    mockCheckServiceUpdates.mockResolvedValue({ sonarr: { hasUpdate: true }, radarr: { hasUpdate: false } });
    const { result } = renderHook(() => useServiceUpdates(['sonarr']));
    let count: number | undefined;
    await act(async () => { count = await result.current.checkAll(); });
    expect(count).toBe(1);
    expect(result.current.serviceUpdates).toEqual({ sonarr: { hasUpdate: true }, radarr: { hasUpdate: false } });
    expect(result.current.checkingAll).toBe(false);
  });

  it('checkOne records the result and flags recentlyChecked when up to date', async () => {
    mockGetServiceUpdateStatus.mockResolvedValue(false);
    const { result } = renderHook(() => useServiceUpdates(['sonarr']));
    let hasUpdate: boolean | null | undefined;
    await act(async () => { hasUpdate = await result.current.checkOne('sonarr'); });
    expect(hasUpdate).toBe(false);
    expect(result.current.serviceUpdates.sonarr).toEqual({ hasUpdate: false });
    expect(result.current.recentlyChecked.sonarr).toBe(true);
    expect(result.current.updateChecking.sonarr).toBe(false);
  });

  it('checkOne rejects and clears the checking flag on failure', async () => {
    mockGetServiceUpdateStatus.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useServiceUpdates(['sonarr']));
    await expect(act(async () => { await result.current.checkOne('sonarr'); })).rejects.toThrow();
    expect(result.current.updateChecking.sonarr).toBeFalsy(); // not left stuck "checking"
  });
});
