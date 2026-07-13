import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import ServiceCard, { type ServiceCardModel } from './ServiceCard';

const baseModel: ServiceCardModel = {
  serviceKey: 'sonarr',
  name: 'Sonarr',
  roleKey: 'tvShows',
  statusLabel: 'Running',
  statusDotClass: 'bg-green-500',
  unhealthy: false,
  isRunning: true,
  isUpdating: false,
  isChecking: false,
  hasUpdate: false,
  recentlyChecked: false,
  runningVersion: '4.0.19.2979-ls319',
  isPinned: false,
};

const handlers = {
  onLaunch: () => {},
  onOpenInBrowser: () => {},
  onAction: () => {},
  onOpenLogs: () => {},
  onCheckUpdate: () => {},
  onConfigure: () => {},
  onUpdate: () => {},
};

describe('ServiceCard', () => {
  it('shows name, status and the cleaned running version', async () => {
    render(<ServiceCard model={baseModel} {...handlers} />);
    await expect.element(page.getByText('Sonarr')).toBeInTheDocument();
    await expect.element(page.getByText('Running')).toBeInTheDocument();
    await expect.element(page.getByText(/v4\.0\.19/)).toBeInTheDocument();
  });

  it('enables Open and fires onLaunch when running', async () => {
    const onLaunch = vi.fn();
    render(<ServiceCard model={baseModel} {...handlers} onLaunch={onLaunch} />);
    await page.getByRole('button', { name: 'Open Sonarr' }).click();
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it('disables Open when the service is not running', async () => {
    render(
      <ServiceCard
        model={{ ...baseModel, isRunning: false, statusLabel: 'Stopped', statusDotClass: 'bg-gray-400' }}
        {...handlers}
      />,
    );
    await expect.element(page.getByRole('button', { name: 'Open Sonarr' })).toBeDisabled();
  });

  it('offers an update action and fires onUpdate', async () => {
    const onUpdate = vi.fn();
    render(<ServiceCard model={{ ...baseModel, hasUpdate: true }} {...handlers} onUpdate={onUpdate} />);
    await page.getByRole('button', { name: /update available/i }).click();
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('shows "Up to date" after a recent check', async () => {
    render(<ServiceCard model={{ ...baseModel, recentlyChecked: true }} {...handlers} />);
    await expect.element(page.getByText('Up to date')).toBeInTheDocument();
  });
});
