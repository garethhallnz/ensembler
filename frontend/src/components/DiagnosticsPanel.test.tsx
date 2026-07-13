import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import DiagnosticsPanel from './DiagnosticsPanel';

const dockerUp = { running: true };

describe('DiagnosticsPanel', () => {
  it('shows the heading and an all-clear summary when collapsed and healthy', async () => {
    render(<DiagnosticsPanel dockerStatus={dockerUp} runtimeStatus={null} expanded={false} onToggleExpanded={() => {}} />);
    await expect.element(page.getByText('Diagnostics')).toBeInTheDocument();
    await expect.element(page.getByText('All systems operational')).toBeInTheDocument();
    // Body is hidden while collapsed.
    expect(page.getByText('Docker').query()).toBeNull();
  });

  it('reveals the detail rows when expanded', async () => {
    render(<DiagnosticsPanel dockerStatus={dockerUp} runtimeStatus={null} expanded onToggleExpanded={() => {}} />);
    // exact — "Docker" also appears as a substring in the footnote paragraph.
    await expect.element(page.getByText('Docker', { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText('Running', { exact: true })).toBeInTheDocument();
  });

  it('fires onToggleExpanded when the header is clicked', async () => {
    const onToggle = vi.fn();
    render(<DiagnosticsPanel dockerStatus={dockerUp} runtimeStatus={null} expanded={false} onToggleExpanded={onToggle} />);
    await page.getByText('Diagnostics').click();
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
