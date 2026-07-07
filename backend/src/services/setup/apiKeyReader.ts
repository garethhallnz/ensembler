import fs from 'fs';
import path from 'path';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Sonarr/Radarr/Prowlarr write an auto-generated API key to config.xml on first
// launch. Their /config volume is mapped to {configDir}/{service}/config on the
// host, so the key can be read straight off disk once the app has initialized.
export async function readArrApiKey(
  configDir: string,
  serviceKey: string,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<string> {
  const configXmlPath = path.join(configDir, serviceKey, 'config', 'config.xml');
  const deadline = Date.now() + timeoutMs;

  while (true) {
    if (fs.existsSync(configXmlPath)) {
      const content = fs.readFileSync(configXmlPath, 'utf-8');
      const match = content.match(/<ApiKey>([^<]+)<\/ApiKey>/);
      if (match && match[1].trim()) {
        return match[1].trim();
      }
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error(`Timed out waiting for API key in ${configXmlPath}`);
    }
    await delay(pollIntervalMs);
  }
}
