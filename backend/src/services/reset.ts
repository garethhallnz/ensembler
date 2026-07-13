import fs from 'fs';
import path from 'path';
import { configDir, configFile, composeFile } from './paths';
import { dockerCompose } from './exec';

// Stop and remove all service containers. Tolerant of `down` failing (e.g.
// nothing is running) — that must not block the rest of a reset.
export async function resetStopServices(): Promise<void> {
  if (fs.existsSync(composeFile)) {
    try {
      await dockerCompose(['down']);
    } catch (err) {
      console.warn('Failed to stop services during reset:', err);
    }
  }
}

// Delete Ensembler's config files and every service data directory present in
// configDir (settings, databases, API keys) so services start completely
// fresh. Enumerating the directory rather than the current service catalog
// means data for services since removed from Ensembler is also cleared. Media
// files live outside configDir and are never touched.
export function resetCleanFilesAndData(): void {
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
  if (fs.existsSync(composeFile)) {
    fs.unlinkSync(composeFile);
  }
  if (fs.existsSync(configDir)) {
    for (const entry of fs.readdirSync(configDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        fs.rmSync(path.join(configDir, entry.name), { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to remove service data for ${entry.name}:`, err);
      }
    }
  }
}
