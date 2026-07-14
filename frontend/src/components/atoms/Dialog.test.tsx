import { render } from 'vitest-browser-react';
import { page, userEvent } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import Dialog from './Dialog';

describe('Dialog', () => {
  it('renders children in a named dialog when shown', async () => {
    render(
      <Dialog show onClose={() => {}} ariaLabel="Confirm removal">
        <div>
          <button type="button">Cancel</button>
        </div>
      </Dialog>,
    );
    await expect.element(page.getByRole('dialog', { name: 'Confirm removal' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('does not render when hidden', async () => {
    render(
      <Dialog show={false} onClose={() => {}} ariaLabel="Hidden">
        <button type="button">Cancel</button>
      </Dialog>,
    );
    await expect.element(page.getByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('closes on Escape when dismissible', async () => {
    const onClose = vi.fn();
    render(
      <Dialog show onClose={onClose} ariaLabel="Dismissible">
        <button type="button">Cancel</button>
      </Dialog>,
    );
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores Escape when not dismissible', async () => {
    const onClose = vi.fn();
    render(
      <Dialog show onClose={onClose} ariaLabel="Locked" dismissible={false}>
        <button type="button">Working…</button>
      </Dialog>,
    );
    await expect.element(page.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
