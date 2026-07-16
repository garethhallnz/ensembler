import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import StepSelection from './StepSelection';

const services = [
  { key: 'plex', name: 'Plex', description: 'Stream', category: 'media', required: true },
  { key: 'sonarr', name: 'Sonarr', description: 'TV', category: 'management', required: false, recommended: true },
];

describe('StepSelection', () => {
  it('renders the heading, category, and service names', async () => {
    render(
      <StepSelection serviceConfig={services} selected={{ plex: true }} recommendedOn={false} onToggleRecommended={() => {}} onServiceChange={() => {}} />,
    );
    await expect.element(page.getByText('Select services')).toBeInTheDocument();
    await expect.element(page.getByText('Media Servers')).toBeInTheDocument();
    await expect.element(page.getByText('Plex', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText('Sonarr', { exact: true })).toBeInTheDocument();
  });

  it('warns when nothing is selected', async () => {
    render(
      <StepSelection serviceConfig={services} selected={{}} recommendedOn={false} onToggleRecommended={() => {}} onServiceChange={() => {}} />,
    );
    await expect.element(page.getByText('Select at least one service to continue.')).toBeInTheDocument();
  });

  it('fires onServiceChange when a non-required service is toggled', async () => {
    const onServiceChange = vi.fn();
    render(
      <StepSelection serviceConfig={services} selected={{ plex: true }} recommendedOn={false} onToggleRecommended={() => {}} onServiceChange={onServiceChange} />,
    );
    await page.getByRole('switch', { name: 'Sonarr' }).click();
    expect(onServiceChange).toHaveBeenCalledWith('sonarr');
  });
});
