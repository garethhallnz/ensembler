import os from 'os';
import path from 'path';
import fs from 'fs';

// Configuration directory. The Electron main process passes the OS-native
// per-user data directory (app.getPath('userData')) via ENSEMBLER_DATA_DIR when
// it launches the backend, so packaged installs store data where each platform
// expects it:
//   macOS   ~/Library/Application Support/Ensembler
//   Windows %APPDATA%\Ensembler
//   Linux   ~/.config/Ensembler
// When the backend runs standalone for local dev (`npm run backend`), nothing
// sets that variable, so it falls back to a simple ~/.ensembler. The backend
// never imports Electron — this keeps the separate-process dev flow working.
function getConfigDir(): string {
  if (process.env.ENSEMBLER_DATA_DIR) {
    return process.env.ENSEMBLER_DATA_DIR;
  }
  return path.join(os.homedir(), '.ensembler');
}

export const configDir = getConfigDir();
export const configFile = path.join(configDir, 'config.json');
export const composeFile = path.join(configDir, 'docker-compose.yml');

// Write a file atomically: write to a temp sibling then rename over the target.
// rename is atomic on the same filesystem, so a crash mid-write can never leave
// a truncated config that would wipe the user's setup.
export function writeFileAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
