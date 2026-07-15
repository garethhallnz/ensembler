import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockGetServiceMonitor } = vi.hoisted(() => ({ mockGetServiceMonitor: vi.fn() }));
vi.mock('../requests/services', () => ({ getServiceMonitor: mockGetServiceMonitor }));

import { useServiceAlerts } from './useServiceAlerts';

const alerts = { sonarr: { status: 'running', healthy: true, alert: false } };

beforeEach(() => {
  mockGetServiceMonitor.mockReset();
  mockGetServiceMonitor.mockResolvedValue(alerts);
});

describe('useServiceAlerts', () => {
  it('fetches the monitor on mount when there are services', async () => {
    const { result } = renderHook(() => useServiceAlerts(['sonarr']));
    await waitFor(() => expect(result.current).toEqual(alerts));
    expect(mockGetServiceMonitor).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when there are no services', async () => {
    renderHook(() => useServiceAlerts([]));
    await Promise.resolve();
    expect(mockGetServiceMonitor).not.toHaveBeenCalled();
  });

  it('polls on a 30s interval', async () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useServiceAlerts(['sonarr']));
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetServiceMonitor).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30000);
      expect(mockGetServiceMonitor).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refetches when the service set changes', async () => {
    const { rerender } = renderHook(({ keys }) => useServiceAlerts(keys), {
      initialProps: { keys: ['sonarr'] },
    });
    await waitFor(() => expect(mockGetServiceMonitor).toHaveBeenCalledTimes(1));
    rerender({ keys: ['sonarr', 'radarr'] });
    await waitFor(() => expect(mockGetServiceMonitor).toHaveBeenCalledTimes(2));
  });

  it('keeps the last good value when a fetch fails', async () => {
    const { result, rerender } = renderHook(({ keys }) => useServiceAlerts(keys), {
      initialProps: { keys: ['sonarr'] },
    });
    await waitFor(() => expect(result.current).toEqual(alerts));
    mockGetServiceMonitor.mockRejectedValueOnce(new Error('boom'));
    rerender({ keys: ['sonarr', 'radarr'] });
    await waitFor(() => expect(mockGetServiceMonitor).toHaveBeenCalledTimes(2));
    expect(result.current).toEqual(alerts);
  });
});
