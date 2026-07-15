import { delay } from './readiness';
import { SetupStepResult } from './types';

export interface ArrRequestOptions {
  baseUrl: string;
  apiKey: string;
  // Sonarr/Radarr use /api/v3, Prowlarr uses /api/v1
  apiBase?: string;
}

export async function arrRequest<T>(
  { baseUrl, apiKey, apiBase = '/api/v3' }: ArrRequestOptions,
  method: 'GET' | 'POST',
  apiPath: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${baseUrl}${apiBase}${apiPath}`, {
    method,
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${method} ${apiPath} returned ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

// Poll the app's status endpoint until it answers with the API key accepted.
export async function waitForArrReady(
  options: ArrRequestOptions,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';

  while (Date.now() < deadline) {
    try {
      await arrRequest(options, 'GET', '/system/status');
      return;
    } catch (err) {
      lastError = (err as Error).message;
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`Service did not become ready within ${timeoutMs / 1000}s (${lastError})`);
}

// Register the media root folder (the path as seen inside the container,
// e.g. /tv for Sonarr) unless it is already configured.
export async function ensureRootFolder(
  options: ArrRequestOptions,
  containerPath: string
): Promise<{ created: boolean }> {
  const existing = await arrRequest<{ path: string }[]>(options, 'GET', '/rootfolder');
  if (existing.some(folder => folder.path === containerPath)) {
    return { created: false };
  }
  await arrRequest(options, 'POST', '/rootfolder', { path: containerPath });
  return { created: true };
}

// Prowlarr and Sonarr/Radarr expose the download-client API under different
// contracts; the caller states which explicitly rather than us inferring it
// from the API path (that would misfire for other apps sharing an API version).
export type DownloadClientContract = 'arr' | 'prowlarr';

// Point the app at Transmission over the compose network (container name as
// host, internal port) unless a Transmission client is already configured.
// Sending the wrong contract's shape returns a 400.
export async function ensureTransmissionDownloadClient(
  options: ArrRequestOptions,
  transmission: { host: string; port: number },
  contract: DownloadClientContract = 'arr'
): Promise<{ created: boolean }> {
  const existing = await arrRequest<{ implementation: string }[]>(options, 'GET', '/downloadclient');
  if (existing.some(client => client.implementation === 'Transmission')) {
    return { created: false };
  }

  await arrRequest(options, 'POST', '/downloadclient', {
    enable: true,
    protocol: 'torrent',
    priority: 1,
    ...(contract === 'prowlarr'
      ? { categories: [] }
      : { removeCompletedDownloads: true, removeFailedDownloads: true }),
    name: 'Transmission',
    implementation: 'Transmission',
    configContract: 'TransmissionSettings',
    tags: [],
    fields: [
      { name: 'host', value: transmission.host },
      { name: 'port', value: transmission.port },
      { name: 'useSsl', value: false },
      { name: 'urlBase', value: '/transmission/' }
    ]
  });
  return { created: true };
}

// A media server the *arr should notify (and tell to rescan) when media is
// imported, so new content appears without a manual library scan.
export interface MediaServerNotificationTarget {
  // 'plex' → PlexServer contract with authToken; 'jellyfin'/'emby' → MediaBrowser with apiKey
  kind: 'plex' | 'jellyfin' | 'emby';
  name: string;
  host: string;
  port: number;
  // Plex auth token or Jellyfin/Emby API key
  credential: string;
}

export async function ensureMediaServerNotification(
  options: ArrRequestOptions,
  target: MediaServerNotificationTarget
): Promise<{ created: boolean }> {
  const existing = await arrRequest<{ implementation: string; fields?: { name: string; value: unknown }[] }[]>(
    options, 'GET', '/notification'
  );

  const implementation = target.kind === 'plex' ? 'PlexServer' : 'MediaBrowser';
  const alreadyPresent = existing.some(n =>
    n.implementation === implementation &&
    (n.fields ?? []).some(f => f.name === 'host' && f.value === target.host)
  );
  if (alreadyPresent) {
    return { created: false };
  }

  // Only trigger flags common to both Sonarr and Radarr; unknown flags 400.
  const triggers = { onGrab: false, onDownload: true, onUpgrade: true, onRename: false };
  const fields = target.kind === 'plex'
    ? [
        { name: 'host', value: target.host },
        { name: 'port', value: target.port },
        { name: 'useSsl', value: false },
        { name: 'authToken', value: target.credential },
        { name: 'updateLibrary', value: true }
      ]
    : [
        { name: 'host', value: target.host },
        { name: 'port', value: target.port },
        { name: 'useSsl', value: false },
        { name: 'apiKey', value: target.credential },
        { name: 'updateLibrary', value: true }
      ];

  await arrRequest(options, 'POST', '/notification', {
    ...triggers,
    name: target.name,
    implementation,
    configContract: target.kind === 'plex' ? 'PlexServerSettings' : 'MediaBrowserSettings',
    tags: [],
    fields
  });
  return { created: true };
}

export interface ArrSetupOptions {
  serviceKey: string;
  baseUrl: string;
  apiKey: string;
  rootFolder: string;
  transmission?: { host: string; port: number };
  readyTimeoutMs?: number;
}

// Run the full wiring sequence for one *arr app. Each step reports its own
// result so a failure in one leaves the others' outcomes visible.
export async function setupArrService(setup: ArrSetupOptions): Promise<SetupStepResult[]> {
  const { serviceKey, rootFolder, transmission } = setup;
  const options = { baseUrl: setup.baseUrl, apiKey: setup.apiKey };
  const results: SetupStepResult[] = [];

  try {
    await waitForArrReady(options, setup.readyTimeoutMs);
  } catch (err) {
    return [{
      service: serviceKey,
      step: 'ready',
      success: false,
      message: (err as Error).message,
      code: 'messages.setup.stepFailed',
      params: { error: (err as Error).message }
    }];
  }

  try {
    const { created } = await ensureRootFolder(options, rootFolder);
    const outcome = created
      ? { message: `Added root folder ${rootFolder}`, code: 'messages.setup.rootFolderAdded' }
      : { message: `Root folder ${rootFolder} already configured`, code: 'messages.setup.rootFolderExists' };
    results.push({
      service: serviceKey,
      step: 'root-folder',
      success: true,
      ...outcome,
      params: { path: rootFolder }
    });
  } catch (err) {
    results.push({
      service: serviceKey,
      step: 'root-folder',
      success: false,
      message: (err as Error).message,
      code: 'messages.setup.stepFailed',
      params: { error: (err as Error).message }
    });
  }

  if (transmission) {
    try {
      const { created } = await ensureTransmissionDownloadClient(options, transmission);
      const outcome = created
        ? { message: 'Connected to Transmission', code: 'messages.setup.transmissionConnected' }
        : { message: 'Transmission already configured', code: 'messages.setup.transmissionExists' };
      results.push({
        service: serviceKey,
        step: 'download-client',
        success: true,
        ...outcome
      });
    } catch (err) {
      results.push({
        service: serviceKey,
        step: 'download-client',
        success: false,
        message: (err as Error).message,
        code: 'messages.setup.stepFailed',
        params: { error: (err as Error).message }
      });
    }
  }

  return results;
}
