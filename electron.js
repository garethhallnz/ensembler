import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
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
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'frontend/src/assets/icon.png'), // Add your app icon
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
    command = 'ts-node';
    args = [path.join(__dirname, 'backend', 'src', 'index.ts')];
    options = {
      stdio: 'inherit',
      cwd: path.join(__dirname, 'backend'),
      shell: true,
      env: { ...process.env, PATH: backendPath() },
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
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PATH: backendPath() },
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

// App event handlers
app.whenReady().then(() => {
  console.log('[Electron] App is ready. Starting backend...');
  startBackend();
  
  // Wait a bit for backend to start
  setTimeout(() => {
    console.log('[Electron] Creating window after backend startup delay.');
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('[Electron] App activated. Creating window.');
      createWindow();
    }
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

app.on('before-quit', (event) => {
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

// Security: Prevent navigation to external websites
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation within the app
    if (parsedUrl.origin !== 'http://localhost:5180' && parsedUrl.origin !== 'file://') {
      event.preventDefault();
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