import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGetServiceVersion, mockGetPinnedVersions } = vi.hoisted(() => ({
  mockGetServiceVersion: vi.fn(),
  mockGetPinnedVersions: vi.fn(),
}));
vi.mock('../requests/services', () => ({
  getServiceVersion: mockGetServiceVersion,
  getPinnedVersions: mockGetPinnedVersions,
}));

import { useServiceVersions } from './useServiceVersions';

beforeEach(() => {
  mockGetServiceVersion.mockReset().mockImplementation(async (key: string) =>
    ({ sonarr: '4.0.19', radarr: 'Not installed', plex: '' } as Record<string, string>)[key] ?? '',
  );
  mockGetPinnedVersions.mockReset().mockResolvedValue({ sonarr: '4.0.9' });
});

describe('useServiceVersions', () => {
  it('fetches running versions and pinned versions on mount', async () => {
    const { result } = renderHook(() => useServiceVersions(['sonarr']));
    await waitFor(() => expect(result.current.serviceVersions).toEqual({ sonarr: '4.0.19' }));
    expect(result.current.pinnedVersions).toEqual({ sonarr: '4.0.9' });
  });

  it('filters out empty and "Not installed" versions', async () => {
    const { result } = renderHook(() => useServiceVersions(['sonarr', 'radarr', 'plex']));
    await waitFor(() => expect(result.current.serviceVersions).toEqual({ sonarr: '4.0.19' }));
    // radarr ("Not installed") and plex ("") are excluded
  });

  it('does not fetch when there are no services', async () => {
    renderHook(() => useServiceVersions([]));
    await Promise.resolve();
    expect(mockGetServiceVersion).not.toHaveBeenCalled();
    expect(mockGetPinnedVersions).not.toHaveBeenCalled();
  });

  it('refresh merges versions for the requested keys', async () => {
    const { result } = renderHook(() => useServiceVersions(['sonarr']));
    await waitFor(() => expect(result.current.serviceVersions).toEqual({ sonarr: '4.0.19' }));
    mockGetServiceVersion.mockResolvedValue('6.3.0');
    await act(async () => { await result.current.refresh(['radarr']); });
    expect(result.current.serviceVersions).toEqual({ sonarr: '4.0.19', radarr: '6.3.0' });
  });

  it('keeps prior pinned versions when the config fetch fails', async () => {
    const { result } = renderHook(() => useServiceVersions(['sonarr']));
    await waitFor(() => expect(result.current.pinnedVersions).toEqual({ sonarr: '4.0.9' }));
    mockGetPinnedVersions.mockRejectedValue(new Error('boom'));
    await act(async () => { await result.current.refresh(['sonarr']); });
    expect(result.current.pinnedVersions).toEqual({ sonarr: '4.0.9' }); // unchanged
  });
});
