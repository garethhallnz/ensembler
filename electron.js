import { app, BrowserWindow, dialog, shell, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let tray = null;
app.isQuitting = false;

// The containers run independently of the app, so closing the window can keep
// Ensembler resident in the tray for quick access. Opt-out via a Settings toggle
// (config.minimizeToTray); default on.
function shouldMinimizeToTray() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (!fs.existsSync(configPath)) return true;
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')).minimizeToTray !== false;
  } catch {
    return true;
  }
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}

function createTray() {
  if (tray) return;

  // macOS menu bar wants a monochrome template glyph (transparent background, so
  // it adapts to light/dark). The full colour app icon is opaque and would show
  // as a solid block there — but it's the right choice for Windows/Linux trays.
  let image;
  if (process.platform === 'darwin') {
    image = nativeImage.createFromPath(path.join(__dirname, 'assets/trayTemplate.png'));
    image.setTemplateImage(true);
  } else {
    image = nativeImage.createFromPath(path.join(__dirname, 'assets/icon.png')).resize({ width: 18, height: 18 });
  }

  tray = new Tray(image);
  tray.setToolTip('Ensembler');

  const runServiceAction = (endpoint) => {
    fetch(`http://localhost:3001/api/services/${endpoint}`, { method: 'POST' })
      .catch(err => console.error(`[Electron] Tray action ${endpoint} failed:`, err));
  };

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Ensembler', click: showMainWindow },
    { type: 'separator' },
    { label: 'Start all services', click: () => runServiceAction('start-all') },
    { label: 'Stop all services', click: () => runServiceAction('stop-all') },
    { type: 'separator' },
    { label: 'Quit Ensembler', click: () => { app.isQuitting = true; app.quit(); } },
  ]));

  // On Windows/Linux a left-click conventionally opens the app (right-click gives
  // the menu). On macOS the menu-bar convention is that a click opens the menu
  // itself, so setContextMenu above already handles it — no click handler there.
  if (process.platform !== 'darwin') {
    tray.on('click', showMainWindow);
  }
}
let backendProcess;

function createWindow() {
  console.log('[Electron] Creating main window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webviewTag: true, // service UIs render in-app via <webview>, avoiding the browser's "Not Secure" chrome
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Window/taskbar icon (Windows/Linux)
    show: false, // Don't show until ready
    titleBarStyle: 'default'
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('[Electron] Main window ready to show. Showing now.');
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Load the frontend
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    console.log('[Electron] Loading frontend from dev server...');
    mainWindow.loadURL('http://localhost:5180')
      .then(() => console.log('[Electron] Dev frontend loaded.'))
      .catch(err => console.error('[Electron] Error loading dev frontend:', err));
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, 'frontend/dist/index.html');
    console.log('[Electron] Loading frontend from', indexPath);
    mainWindow.loadFile(indexPath)
      .then(() => console.log('[Electron] Production frontend loaded.'))
      .catch(err => console.error('[Electron] Error loading production frontend:', err));
  }

  // Close hides to the tray (keeping the app resident) unless the user is really
  // quitting or has turned the toggle off. before-quit sets isQuitting, so Cmd+Q
  // and the tray's Quit still exit properly.
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && shouldMinimizeToTray()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    console.log('[Electron] Main window closed.');
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Window failed to load: ${errorDescription} (${errorCode}) URL: ${validatedURL}`);
  });
}

// When launched from Finder/Dock (not a terminal), a macOS/Linux GUI app gets a
// minimal PATH that omits where Docker lives (e.g. /usr/local/bin). The backend
// shells out to `docker`/`docker compose`, so prepend the common locations to
// PATH — otherwise Docker appears "not available" even when it's installed.
function backendPath() {
  if (process.platform === 'win32') {
    return process.env.PATH;
  }
  const extra = [
    '/usr/local/bin',
    '/opt/homebrew/bin',
    '/Applications/Docker.app/Contents/Resources/bin',
    '/Applications/OrbStack.app/Contents/MacOS/xbin',
  ];
  return [...extra, process.env.PATH || ''].filter(Boolean).join(path.delimiter);
}

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';

  let command;
  let args;
  let options;

  if (isDev) {
    // ts-node is a local dependency, not on PATH — run it via npx (from the
    // backend dir) so the spawned process resolves the local binary instead of
    // failing with exit code 127.
    command = 'npx';
    args = ['ts-node', path.join(__dirname, 'backend', 'src', 'index.ts')];
    options = {
      stdio: 'inherit',
      cwd: path.join(__dirname, 'backend'),
      shell: true,
      env: { ...process.env, PATH: backendPath(), ENSEMBLER_DATA_DIR: app.getPath('userData') },
    };
  } else {
    // Run the bundled backend with Electron's own Node runtime (no system Node
    // required). ELECTRON_RUN_AS_NODE makes the Electron binary behave as node.
    // The bundle is shipped via extraResources, so it lives under resourcesPath.
    const bundlePath = path.join(process.resourcesPath, 'backend', 'server.bundle.js');
    command = process.execPath;
    args = [bundlePath];
    options = {
      stdio: 'inherit',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PATH: backendPath(), ENSEMBLER_DATA_DIR: app.getPath('userData') },
      shell: false
    };
  }

  backendProcess = spawn(command, args, options);

  backendProcess.on('error', (error) => {
    console.error('Backend process error:', error);
    dialog.showErrorBox('Backend Error', `Failed to start backend: ${error.message}`);
  });

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`);
    if (code !== 0) {
      dialog.showErrorBox('Backend Error', `Backend process exited with code ${code}`);
    }
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

// Native folder picker for the setup wizard (and per-service config). The
// renderer calls window.electronAPI.showOpenDialog(...) via preload; this
// returns the real absolute path the browser's File System Access API cannot.
ipcMain.handle('show-open-dialog', async (_event, options) => {
  return dialog.showOpenDialog(mainWindow, options ?? { properties: ['openDirectory'] });
});

// App event handlers
app.whenReady().then(() => {
  console.log('[Electron] App is ready. Starting backend...');
  startBackend();
  
  createTray();

  // Wait a bit for backend to start
  setTimeout(() => {
    console.log('[Electron] Creating window after backend startup delay.');
    createWindow();
  }, 2000);

  app.on('activate', () => {
    // Reveal the window whether it was hidden to the tray or fully closed.
    console.log('[Electron] App activated.');
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  // Important: Don't automatically stop backend on window close
  // This allows Docker services to continue running independently
  console.log('All windows closed. Backend continues running for service independence.');
  
  if (process.platform !== 'darwin') {
    // On non-macOS platforms, quit the app but keep services running
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true; // let the window's close handler exit instead of hiding
  console.log('App quitting. Backend will be stopped.');
  
  // Give time for graceful shutdown
  if (backendProcess) {
    console.log('Stopping backend process...');
    stopBackend();
  }
  
  // Note: Docker services continue running independently
  console.log('App shutdown complete. Docker services remain running independently.');
});

// Handle app protocol for macOS
app.setAsDefaultProtocolClient('media-center');

// Security: keep the app window locked to the app, but let embedded service
// <webview>s roam their own localhost origins.
app.on('web-contents-created', (event, contents) => {
  if (contents.getType() === 'webview') {
    // Service UIs live on http://localhost:<port>. Allow navigation within
    // localhost; send genuinely external links (e.g. Plex OAuth) to the
    // system browser rather than steering the embedded view off to them.
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (e, navigationUrl) => {
      const { hostname } = new URL(navigationUrl);
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        e.preventDefault();
        shell.openExternal(navigationUrl);
      }
    });
    return;
  }

  contents.on('will-navigate', (e, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:5180' && parsedUrl.origin !== 'file://') {
      e.preventDefault();
    }
  });
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (url.startsWith('https://localhost')) {
    // Allow self-signed certificates for localhost
    event.preventDefault();
    callback(true);
  } else {
    callback(false);
  }
});

// Export for testing
export { createWindow, startBackend, stopBackend }; 