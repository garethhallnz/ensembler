import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { createRef } from 'react';
import { describe, it, expect } from 'vitest';
import LogsDrawer from './LogsDrawer';

describe('LogsDrawer', () => {
  it('shows the named title and the service log output when open', async () => {
    render(
      <LogsDrawer
        open
        serviceName="sonarr"
        logs={'line one\nline two'}
        scrollRef={createRef<HTMLDivElement>()}
        onClose={() => {}}
        onScroll={() => {}}
      />,
    );
    await expect.element(page.getByText('sonarr — logs')).toBeInTheDocument();
    await expect.element(page.getByText('Live')).toBeInTheDocument();
    await expect.element(page.getByText(/line one/)).toBeInTheDocument();
  });

  it('shows a loading placeholder when the service has no logs yet', async () => {
    render(
      <LogsDrawer
        open
        serviceName="radarr"
        logs={undefined}
        scrollRef={createRef<HTMLDivElement>()}
        onClose={() => {}}
        onScroll={() => {}}
      />,
    );
    await expect.element(page.getByText('Loading logs…')).toBeInTheDocument();
  });
});
