import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import DiagnosticsSection from './DiagnosticsSection';

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));
vi.mock('../../requests/client', () => ({ apiFetch: mockApiFetch }));

const runtimeStatus = {
  appRunning: true,
  backendConnected: true,
  dockerAvailable: true,
  servicesRunning: ['sonarr', 'radarr'],
  lastCheck: new Date('2026-01-01T10:00:00'),
};

describe('DiagnosticsSection', () => {
  it('shows runtime status and host resources from the checks endpoint', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        checks: {
          dockerMemory: { ok: true, allocatedGiB: 8, recommendedGiB: 4 },
          disk: { ok: false, freeGiB: 3, recommendedGiB: 10 },
        },
      }),
    });

    render(<DiagnosticsSection dockerStatus={{ running: true }} runtimeStatus={runtimeStatus} />);

    await expect.element(page.getByText('Running', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText('Connected', { exact: true })).toBeInTheDocument();
    // Host resources fetched from /api/system/checks
    await expect.element(page.getByText('3 GB')).toBeInTheDocument();
    await expect.element(page.getByText('8 GB')).toBeInTheDocument();
  });
});
