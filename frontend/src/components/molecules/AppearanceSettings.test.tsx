import { render } from 'vitest-browser-react';
import { page } from '@vitest/browser/context';
import { describe, it, expect } from 'vitest';
import AppearanceSettings from './AppearanceSettings';
import { CustomThemeProvider } from '../../contexts/ThemeContext';

describe('AppearanceSettings', () => {
  it('renders the theme options and a labelled language select', async () => {
    render(
      <CustomThemeProvider>
        <AppearanceSettings selectId="test-language" />
      </CustomThemeProvider>,
    );
    await expect.element(page.getByText('Appearance')).toBeInTheDocument();
    await expect.element(page.getByText('Theme')).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    await expect.element(page.getByRole('button', { name: 'System' })).toBeInTheDocument();
    await expect.element(page.getByRole('combobox', { name: 'Language' })).toBeInTheDocument();
  });

  it('applies the chosen theme to the document', async () => {
    render(
      <CustomThemeProvider>
        <AppearanceSettings selectId="test-language-2" />
      </CustomThemeProvider>,
    );
    await page.getByRole('button', { name: 'Dark' }).click();
    await expect.poll(() => document.documentElement.classList.contains('dark')).toBe(true);
    await page.getByRole('button', { name: 'Light' }).click();
    await expect.poll(() => document.documentElement.classList.contains('dark')).toBe(false);
  });
});
