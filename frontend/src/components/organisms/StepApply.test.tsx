import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import StepApply, { type ApplyPhase } from './StepApply';

const phases: ApplyPhase[] = [
  { key: 'save', label: 'Save config', status: 'done' },
  { key: 'start', label: 'Start services', status: 'active', detail: 'Working…' },
];

describe('StepApply', () => {
  it('shows the running title and phase labels', async () => {
    render(<StepApply applyPhases={phases} applyError={null} applyDone={false} connectResults={[]} onComplete={() => {}} onBackToConfig={() => {}} />);
    await expect.element(page.getByText('Setting things up')).toBeInTheDocument();
    await expect.element(page.getByText('Save config')).toBeInTheDocument();
    await expect.element(page.getByText('Working…')).toBeInTheDocument();
  });

  it('shows the error and fires onBackToConfig', async () => {
    const onBackToConfig = vi.fn();
    render(<StepApply applyPhases={phases} applyError="Boom" applyDone={false} connectResults={[]} onComplete={() => {}} onBackToConfig={onBackToConfig} />);
    await expect.element(page.getByText('Boom')).toBeInTheDocument();
    await page.getByRole('button', { name: 'Back to configuration' }).click();
    expect(onBackToConfig).toHaveBeenCalledOnce();
  });

  it('shows completion and fires onComplete', async () => {
    const onComplete = vi.fn();
    render(<StepApply applyPhases={phases} applyError={null} applyDone connectResults={[]} onComplete={onComplete} onBackToConfig={() => {}} />);
    await expect.element(page.getByText('Your media center is ready')).toBeInTheDocument();
    await page.getByRole('button', { name: 'Go to Dashboard' }).click();
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
