import { ensureMediaServerNotification } from './arrSetup';
import { ArrTarget, SetupStepResult } from './types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Identifies Dockarr to Jellyfin on the authentication call.
const AUTH_HEADER =
  'MediaBrowser Client="Dockarr", Device="Dockarr", DeviceId="dockarr-setup", Version="1.0.0"';

export interface JellyfinCredentials {
  username: string;
  password: string;
}

export interface JellyfinLibrary {
  name: string;
  // Jellyfin collection type
  collectionType: 'tvshows' | 'movies';
  // Path as seen inside the container (/tv, /movies)
  path: string;
}

export const DEFAULT_JELLYFIN_LIBRARIES: JellyfinLibrary[] = [
  { name: 'TV Shows', collectionType: 'tvshows', path: '/tv' },
  { name: 'Movies', collectionType: 'movies', path: '/movies' }
];

interface PublicInfo {
  StartupWizardCompleted?: boolean;
}

// /System/Info/Public answers without authentication and reports whether the
// first-run wizard has been completed — the whole basis for idempotency here.
export async function getPublicInfo(baseUrl: string): Promise<PublicInfo> {
  const response = await fetch(`${baseUrl}/System/Info/Public`);
  if (!response.ok) {
    throw new Error(`GET /System/Info/Public returned ${response.status}`);
  }
  return response.json() as Promise<PublicInfo>;
}

export async function isJellyfinConfigured(baseUrl: string): Promise<boolean> {
  const info = await getPublicInfo(baseUrl);
  return info.StartupWizardCompleted === true;
}

export async function waitForJellyfinReady(
  baseUrl: string,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';

  while (true) {
    try {
      await getPublicInfo(baseUrl);
      return;
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error(`Jellyfin did not become ready within ${timeoutMs / 1000}s (${lastError})`);
    }
    await delay(pollIntervalMs);
  }
}

// The first-run /Startup/* routes register progressively during boot, several
// seconds after /System/Info/Public starts answering — and /Startup/User comes
// up notably later than /Startup/Configuration. Gate on /Startup/User (the
// last to appear) so the whole wizard sequence is safe once this returns.
async function waitForStartupRoutes(
  baseUrl: string,
  timeoutMs = 120000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const response = await fetch(`${baseUrl}/Startup/User`);
      if (response.ok) {
        return;
      }
    } catch {
      // not up yet
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error('Jellyfin first-run setup routes did not become available');
    }
    await delay(pollIntervalMs);
  }
}

async function startupPost(baseUrl: string, apiPath: string, body: unknown): Promise<void> {
  const response = await fetch(`${baseUrl}${apiPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`POST ${apiPath} returned ${response.status}: ${text.slice(0, 200)}`);
  }
}

// Drive the first-run wizard end to end. These endpoints accept unauthenticated
// requests only while the wizard is still open (StartupWizardCompleted false).
export async function completeStartup(
  baseUrl: string,
  credentials: JellyfinCredentials,
  readyTimeoutMs = 60000
): Promise<void> {
  await waitForStartupRoutes(baseUrl, readyTimeoutMs);
  await startupPost(baseUrl, '/Startup/Configuration', {
    UICulture: 'en-US',
    MetadataCountryCode: 'US',
    PreferredMetadataLanguage: 'en'
  });
  await startupPost(baseUrl, '/Startup/User', {
    Name: credentials.username,
    Password: credentials.password
  });
  await startupPost(baseUrl, '/Startup/RemoteAccess', {
    EnableRemoteAccess: true,
    EnableAutomaticPortMapping: false
  });
  await startupPost(baseUrl, '/Startup/Complete', {});
}

export async function authenticate(baseUrl: string, credentials: JellyfinCredentials): Promise<string> {
  const response = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': AUTH_HEADER
    },
    body: JSON.stringify({ Username: credentials.username, Pw: credentials.password })
  });
  if (!response.ok) {
    throw new Error(`Authentication failed with ${response.status}`);
  }
  const data = await response.json() as { AccessToken?: string };
  if (!data.AccessToken) {
    throw new Error('Authentication returned no access token');
  }
  return data.AccessToken;
}

interface VirtualFolder {
  CollectionType?: string;
  Locations?: string[];
}

export async function getLibraries(baseUrl: string, token: string): Promise<VirtualFolder[]> {
  const response = await fetch(`${baseUrl}/Library/VirtualFolders`, {
    headers: { 'X-Emby-Token': token }
  });
  if (!response.ok) {
    throw new Error(`GET /Library/VirtualFolders returned ${response.status}`);
  }
  return response.json() as Promise<VirtualFolder[]>;
}

// A library "covers" the target when one of the same collection type already
// points at the path. Shared by creation and status so they cannot disagree.
export function isLibraryCovered(folders: VirtualFolder[], library: JellyfinLibrary): boolean {
  return folders.some(
    folder => folder.CollectionType === library.collectionType &&
      (folder.Locations ?? []).includes(library.path)
  );
}

export function jellyfinLibrariesConfigured(folders: VirtualFolder[], libraries: JellyfinLibrary[]): boolean {
  return libraries.every(library => isLibraryCovered(folders, library));
}

export async function ensureLibrary(
  baseUrl: string,
  token: string,
  library: JellyfinLibrary
): Promise<{ created: boolean }> {
  const existing = await getLibraries(baseUrl, token);
  if (isLibraryCovered(existing, library)) {
    return { created: false };
  }
  const params = new URLSearchParams({
    name: library.name,
    collectionType: library.collectionType,
    paths: library.path,
    refreshLibrary: 'true'
  });
  const response = await fetch(`${baseUrl}/Library/VirtualFolders?${params}`, {
    method: 'POST',
    headers: { 'X-Emby-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`POST /Library/VirtualFolders returned ${response.status}: ${text.slice(0, 200)}`);
  }
  return { created: true };
}

// Create (or reuse) an API key so Sonarr/Radarr can call back into Jellyfin.
// POST /Auth/Keys returns 204, so the key is retrieved by listing afterward.
export async function ensureApiKey(baseUrl: string, token: string, appName = 'Dockarr'): Promise<string> {
  const authHeader = { 'X-Emby-Token': token };
  const list = async (): Promise<{ AccessToken: string; AppName: string }[]> => {
    const res = await fetch(`${baseUrl}/Auth/Keys`, { headers: authHeader });
    if (!res.ok) {
      throw new Error(`GET /Auth/Keys returned ${res.status}`);
    }
    const data = await res.json() as { Items?: { AccessToken: string; AppName: string }[] };
    return data.Items ?? [];
  };

  const existing = (await list()).find(k => k.AppName === appName);
  if (existing) {
    return existing.AccessToken;
  }
  const create = await fetch(`${baseUrl}/Auth/Keys?app=${encodeURIComponent(appName)}`, {
    method: 'POST',
    headers: authHeader
  });
  if (!create.ok) {
    throw new Error(`POST /Auth/Keys returned ${create.status}`);
  }
  const created = (await list()).find(k => k.AppName === appName);
  if (!created) {
    throw new Error('Created API key could not be found');
  }
  return created.AccessToken;
}

export interface JellyfinSetupOptions {
  baseUrl: string;
  credentials?: JellyfinCredentials;
  libraries?: JellyfinLibrary[];
  readyTimeoutMs?: number;
  // *arr instances that should notify Jellyfin on import, plus Jellyfin's
  // address on the container network they reach it at.
  arrTargets?: ArrTarget[];
  networkHost?: { host: string; port: number };
}

export async function setupJellyfin(setup: JellyfinSetupOptions): Promise<SetupStepResult[]> {
  const libraries = setup.libraries ?? DEFAULT_JELLYFIN_LIBRARIES;
  const results: SetupStepResult[] = [];

  try {
    await waitForJellyfinReady(setup.baseUrl, setup.readyTimeoutMs);
  } catch (err) {
    return [{ service: 'jellyfin', step: 'ready', success: false, message: (err as Error).message }];
  }

  const alreadyConfigured = await isJellyfinConfigured(setup.baseUrl);

  // Without credentials there is nothing we can do beyond report status: the
  // wizard supplies them once, transiently, and they are never persisted.
  if (!setup.credentials) {
    return [{
      service: 'jellyfin',
      step: 'sign-in',
      success: false,
      message: alreadyConfigured
        ? 'Jellyfin is set up — open it to add your libraries'
        : 'Jellyfin needs its admin account — re-run setup or finish it in Jellyfin'
    }];
  }

  if (!alreadyConfigured) {
    try {
      await completeStartup(setup.baseUrl, setup.credentials, setup.readyTimeoutMs);
      results.push({ service: 'jellyfin', step: 'account', success: true, message: 'Created admin account and completed setup' });
    } catch (err) {
      return [{ service: 'jellyfin', step: 'account', success: false, message: (err as Error).message }];
    }
  }

  let token: string;
  try {
    token = await authenticate(setup.baseUrl, setup.credentials);
  } catch (err) {
    return [
      ...results,
      { service: 'jellyfin', step: 'authenticate', success: false, message: (err as Error).message }
    ];
  }

  for (const library of libraries) {
    const step = `library-${library.collectionType}`;
    try {
      const { created } = await ensureLibrary(setup.baseUrl, token, library);
      results.push({
        service: 'jellyfin',
        step,
        success: true,
        message: created ? `Created "${library.name}" library at ${library.path}` : `"${library.name}" already configured`
      });
    } catch (err) {
      results.push({ service: 'jellyfin', step, success: false, message: (err as Error).message });
    }
  }

  // Let each *arr notify Jellyfin (and trigger a scan) on import, via an API key.
  if (setup.arrTargets?.length && setup.networkHost) {
    try {
      const apiKey = await ensureApiKey(setup.baseUrl, token);
      for (const target of setup.arrTargets) {
        try {
          const { created } = await ensureMediaServerNotification(
            { baseUrl: target.baseUrl, apiKey: target.apiKey },
            { kind: 'jellyfin', name: 'Jellyfin', host: setup.networkHost.host, port: setup.networkHost.port, credential: apiKey }
          );
          results.push({
            service: 'jellyfin',
            step: `notify-${target.service}`,
            success: true,
            message: created ? `${target.service} will refresh Jellyfin on import` : `${target.service} already notifies Jellyfin`
          });
        } catch (err) {
          results.push({ service: 'jellyfin', step: `notify-${target.service}`, success: false, message: (err as Error).message });
        }
      }
    } catch (err) {
      results.push({ service: 'jellyfin', step: 'api-key', success: false, message: (err as Error).message });
    }
  }

  return results;
}
