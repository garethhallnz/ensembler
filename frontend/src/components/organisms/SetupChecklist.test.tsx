import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import SetupChecklist from './SetupChecklist';

describe('SetupChecklist', () => {
  it('shows only the active nudges and fires onLaunch with the service key', async () => {
    const onLaunch = vi.fn();
    render(
      <SetupChecklist
        prowlarrNeedsIndexers
        plexNeedsSignIn={false}
        overseerrNeedsSetup={false}
        onLaunch={onLaunch}
      />,
    );
    await expect.element(page.getByText('Finish setting up')).toBeInTheDocument();
    await expect.element(page.getByText(/Add an indexer/)).toBeInTheDocument();
    await page.getByRole('button').click();
    expect(onLaunch).toHaveBeenCalledWith('prowlarr');
  });

  it('renders nothing when there are no outstanding tasks', () => {
    render(
      <SetupChecklist
        prowlarrNeedsIndexers={false}
        plexNeedsSignIn={false}
        overseerrNeedsSetup={false}
        onLaunch={() => {}}
      />,
    );
    expect(page.getByText('Finish setting up').query()).toBeNull();
  });
});
