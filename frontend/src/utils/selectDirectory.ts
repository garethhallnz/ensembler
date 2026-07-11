// Bridge to the Electron main process's native folder picker. The desktop app
// exposes `window.electronAPI.showOpenDialog` (see preload.js); it returns the
// real absolute host path, which the browser's File System Access API cannot.

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface ElectronAPI {
  showOpenDialog?: (options: unknown) => Promise<OpenDialogResult>;
}

function getElectronAPI(): ElectronAPI | undefined {
  return (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
}

/** True when running inside the packaged/desktop Electron app. */
export function isDesktopApp(): boolean {
  return typeof getElectronAPI()?.showOpenDialog === 'function';
}

/**
 * Open the OS folder picker and return the chosen absolute path, or null if the
 * user cancelled or no native picker is available (e.g. browser dev mode).
 */
export async function selectDirectory(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api?.showOpenDialog) return null;
  try {
    const result = await api.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return !result.canceled && result.filePaths[0] ? result.filePaths[0] : null;
  } catch {
    return null;
  }
}
