const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets/icon.png'), // Add your app icon
    show: false, // Don't show until ready
    titleBarStyle: 'default'
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
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
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  const backendPath = isDev 
    ? path.join(__dirname, '..', 'backend', 'src', 'index.ts')
    : path.join(__dirname, 'backend', 'index.js');
  
  const command = isDev ? 'ts-node' : 'node';
  const args = [backendPath];

  backendProcess = spawn(command, args, {
    stdio: 'inherit',
    cwd: isDev ? path.join(__dirname, '..', 'backend') : path.join(__dirname, 'backend')
  });

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
  startBackend();
  
  // Wait a bit for backend to start
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
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
    if (parsedUrl.origin !== 'http://localhost:5173' && parsedUrl.origin !== 'file://') {
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
module.exports = { createWindow, startBackend, stopBackend }; 