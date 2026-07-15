import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockGetServiceLogs } = vi.hoisted(() => ({ mockGetServiceLogs: vi.fn() }));
vi.mock('../requests/services', () => ({ getServiceLogs: mockGetServiceLogs }));

import { useServiceLogs } from './useServiceLogs';

beforeEach(() => {
  mockGetServiceLogs.mockReset();
  mockGetServiceLogs.mockResolvedValue('log output');
});

describe('useServiceLogs', () => {
  it('fetches logs when the drawer is open and returns them', async () => {
    const { result } = renderHook(() => useServiceLogs('sonarr', true));
    await waitFor(() => expect(result.current).toBe('log output'));
    expect(mockGetServiceLogs).toHaveBeenCalledWith('sonarr');
  });

  it('does not fetch when closed or when there is no service', async () => {
    renderHook(() => useServiceLogs('sonarr', false));
    renderHook(() => useServiceLogs(null, true));
    await Promise.resolve();
    expect(mockGetServiceLogs).not.toHaveBeenCalled();
  });

  it('polls every 2s while open and stops when closed', async () => {
    vi.useFakeTimers();
    try {
      const { rerender } = renderHook(({ open }) => useServiceLogs('sonarr', open), {
        initialProps: { open: true },
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(2);
      rerender({ open: false });
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(2); // no more polls
    } finally {
      vi.useRealTimers();
    }
  });

  it('fetches the new service when it changes', async () => {
    const { result, rerender } = renderHook(({ svc }) => useServiceLogs(svc, true), {
      initialProps: { svc: 'sonarr' },
    });
    await waitFor(() => expect(result.current).toBe('log output'));
    mockGetServiceLogs.mockResolvedValue('radarr logs');
    rerender({ svc: 'radarr' });
    await waitFor(() => expect(result.current).toBe('radarr logs'));
    expect(mockGetServiceLogs).toHaveBeenLastCalledWith('radarr');
  });

  it('keeps prior logs when a fetch fails', async () => {
    const { result } = renderHook(() => useServiceLogs('sonarr', true));
    await waitFor(() => expect(result.current).toBe('log output'));
    mockGetServiceLogs.mockRejectedValue(new Error('boom'));
    await new Promise(r => setTimeout(r, 0));
    expect(result.current).toBe('log output');
  });
});
