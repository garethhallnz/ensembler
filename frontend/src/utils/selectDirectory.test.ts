import { isDesktopApp, selectDirectory } from './selectDirectory';

// jsdom has no Electron bridge by default; individual tests stub window.electronAPI.
const setBridge = (impl: unknown) => {
  (window as unknown as { electronAPI?: unknown }).electronAPI = impl;
};
const clearBridge = () => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI;
};

afterEach(clearBridge);

describe('isDesktopApp', () => {
  it('is false when there is no Electron bridge (browser dev)', () => {
    expect(isDesktopApp()).toBe(false);
  });

  it('is true when the bridge exposes showOpenDialog', () => {
    setBridge({ showOpenDialog: async () => ({ canceled: true, filePaths: [] }) });
    expect(isDesktopApp()).toBe(true);
  });
});

describe('selectDirectory', () => {
  it('returns null with no native picker available', async () => {
    await expect(selectDirectory()).resolves.toBeNull();
  });

  it('returns the chosen absolute path from the dialog', async () => {
    setBridge({ showOpenDialog: async () => ({ canceled: false, filePaths: ['/Users/me/Media'] }) });
    await expect(selectDirectory()).resolves.toBe('/Users/me/Media');
  });

  it('returns null when the dialog is cancelled', async () => {
    setBridge({ showOpenDialog: async () => ({ canceled: true, filePaths: [] }) });
    await expect(selectDirectory()).resolves.toBeNull();
  });
});
