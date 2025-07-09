import { test, expect } from '@playwright/experimental-ct-react';
import App from './App';

test.describe('Docker install instructions', () => {
  test('shows macOS Docker instructions if docker missing', async ({ mount, page }) => {
    await page.route('**/api/docker/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docker: false, compose: false })
    }));
    Object.defineProperty(window.navigator, 'platform', { value: 'MacIntel', configurable: true });
    const component = await mount(<App />);
    await expect(component).toContainText('Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it from Applications.');
  });

  test('shows Windows Docker instructions if docker missing', async ({ mount, page }) => {
    await page.route('**/api/docker/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docker: false, compose: false })
    }));
    Object.defineProperty(window.navigator, 'platform', { value: 'Win32', configurable: true });
    const component = await mount(<App />);
    await expect(component).toContainText('Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it from the Start menu.');
  });

  test('shows Linux Docker instructions if docker missing', async ({ mount, page }) => {
    await page.route('**/api/docker/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docker: false, compose: false })
    }));
    Object.defineProperty(window.navigator, 'platform', { value: 'Linux', configurable: true });
    const component = await mount(<App />);
    await expect(component).toContainText('Install Docker Engine: https://docs.docker.com/engine/install/ and start the service (e.g., sudo systemctl start docker).');
  });

  test('shows Compose instructions if compose missing', async ({ mount, page }) => {
    await page.route('**/api/docker/status', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docker: true, compose: false })
    }));
    Object.defineProperty(window.navigator, 'platform', { value: 'Linux', configurable: true });
    const component = await mount(<App />);
    await expect(component).toContainText('Install Docker Compose: https://docs.docker.com/compose/install/');
  });
}); 