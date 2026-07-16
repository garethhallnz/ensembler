import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect, vi } from 'vitest';
import AdvancedSettings from './AdvancedSettings';
import { CustomThemeProvider } from './contexts/ThemeContext';
import ToastProvider from './contexts/ToastProvider';

vi.mock('./requests/services', () => ({
  getCurrentConfig: vi.fn(async () => ({
    selectedServices: { sonarr: true },
    paths: {},
    ports: {},
    environment: { tz: 'UTC', puid: 1000, pgid: 1000 },
    minimizeToTray: true,
    autoUpdate: false,
  })),
}));

const renderSettings = () =>
  render(
    <CustomThemeProvider>
      <ToastProvider>
        <AdvancedSettings onClose={() => {}} />
      </ToastProvider>
    </CustomThemeProvider>,
  );

describe('AdvancedSettings', () => {
  it('renders the section sidebar and defaults to the Appearance section', async () => {
    renderSettings();
    for (const name of ['Appearance', 'General', 'Advanced', 'Reset']) {
      await expect.element(page.getByRole('button', { name })).toBeInTheDocument();
    }
    // Appearance is the default section — its theme buttons are shown.
    await expect.element(page.getByRole('button', { name: 'Light' })).toBeInTheDocument();
  });

  it('shows only the chosen section in the content pane', async () => {
    renderSettings();
    // General holds the tray toggle, update behaviour, and the timezone.
    await page.getByRole('button', { name: 'General' }).click();
    await expect.element(page.getByText('Keep running in the tray when I close the window')).toBeInTheDocument();
    await expect.element(page.getByText('Install updates automatically')).toBeInTheDocument();
    await expect.element(page.getByText('Timezone (TZ)')).toBeInTheDocument();

    // Advanced holds file-ownership IDs (PUID/PGID).
    await page.getByRole('button', { name: 'Advanced' }).click();
    await expect.element(page.getByRole('heading', { name: 'File ownership' })).toBeInTheDocument();
    await expect.element(page.getByText('User ID (PUID)')).toBeInTheDocument();

    // The nav item is "Reset"; the card inside keeps the "Danger zone" framing.
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect.element(page.getByRole('heading', { name: 'Danger zone' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Reset everything' })).toBeInTheDocument();
  });
});
