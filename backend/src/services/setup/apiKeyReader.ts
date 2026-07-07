import fs from 'fs';
import path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Single non-polling read — returns the key if config.xml exists and holds one,
// otherwise null. Use on request paths (status endpoints) that must answer now.
export function tryReadArrApiKey(configDir: string, serviceKey: string): string | null {
  const configXmlPath = path.join(configDir, serviceKey, 'config', 'config.xml');
  if (!fs.existsSync(configXmlPath)) {
    return null;
  }
  const content = fs.readFileSync(configXmlPath, 'utf-8');
  const match = content.match(/<ApiKey>([^<]+)<\/ApiKey>/);
  return match && match[1].trim() ? match[1].trim() : null;
}

// Sonarr/Radarr/Prowlarr write an auto-generated API key to config.xml on first
// launch. Their /config volume is mapped to {configDir}/{service}/config on the
// host, so the key can be read straight off disk once the app has initialized.
// Polls because the file appears seconds-to-minutes after the container starts.
export async function readArrApiKey(
  configDir: string,
  serviceKey: string,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const key = tryReadArrApiKey(configDir, serviceKey);
    if (key) {
      return key;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error(`Timed out waiting for API key in ${path.join(configDir, serviceKey, 'config', 'config.xml')}`);
    }
    await delay(pollIntervalMs);
  }
}
