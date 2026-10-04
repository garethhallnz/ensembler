const { contextBridge, ipcRenderer } = require('electron');

// electron.js picks the backend's port at launch and passes it as a renderer
// argument (webPreferences.additionalArguments).
const backendPortArg = process.argv.find((arg) => arg.startsWith('--ensembler-backend-port='));
const backendOrigin = backendPortArg ? `http://localhost:${backendPortArg.split('=')[1]}` : undefined;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  getPlatform: () => process.platform,

  // Where the backend this window's app instance spawned is listening
  backendOrigin,
  
  // File system operations (if needed)
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  
  // App version info
  getVersion: () => ipcRenderer.invoke('get-version'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Security: Only allow specific IPC channels
  invoke: (channel, ...args) => {
    const validChannels = [
      'show-open-dialog',
      'get-version',
      'minimize-window',
      'maximize-window',
      'close-window'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },
  
  // Event listeners
  on: (channel, func) => {
    const validChannels = [
      'app-update-available',
      'app-update-downloaded'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, func);
    }
  },
  
  // Remove event listeners
  removeListener: (channel, func) => {
    const validChannels = [
      'app-update-available',
      'app-update-downloaded'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, func);
    }
  }
});

// Log that preload script has loaded
console.log('Preload script loaded successfully'); 