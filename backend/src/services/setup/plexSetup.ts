import fs from 'fs';
import path from 'path';
import { ensureMediaServerNotification } from './arrSetup';
import { ArrTarget, SetupStepResult } from './types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Plex writes its account token into Preferences.xml once the user completes
// the one-time plex.tv sign-in. The /config volume is mapped to
// {configDir}/plex/config on the host, so presence of the token is how
// Dockarr knows the sign-in has happened. Returns null until then.
export function readPlexToken(configDir: string): string | null {
  const preferencesPath = path.join(
    configDir,
    'plex',
    'config',
    'Library',
    'Application Support',
    'Plex Media Server',
    'Preferences.xml'
  );
  if (!fs.existsSync(preferencesPath)) {
    return null;
  }
  const content = fs.readFileSync(preferencesPath, 'utf-8');
  const match = content.match(/PlexOnlineToken="([^"]+)"/);
  return match ? match[1] : null;
}

// /identity answers without authentication as soon as the server is up
export async function waitForPlexReady(
  baseUrl: string,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';

  while (true) {
    try {
      const response = await fetch(`${baseUrl}/identity`);
      if (response.ok) {
        return;
      }
      lastError = `Plex responded with ${response.status}`;
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error(`Plex did not become ready within ${timeoutMs / 1000}s (${lastError})`);
    }
    await delay(pollIntervalMs);
  }
}

export interface PlexLibrary {
  name: string;
  // Plex section type
  type: 'show' | 'movie';
  // Path as seen inside the container (/tv, /movies)
  location: string;
  agent: string;
  scanner: string;
}

export const DEFAULT_PLEX_LIBRARIES: PlexLibrary[] = [
  {
    name: 'TV Shows',
    type: 'show',
    location: '/tv',
    agent: 'tv.plex.agents.series',
    scanner: 'Plex TV Series'
  },
  {
    name: 'Movies',
    type: 'movie',
    location: '/movies',
    agent: 'tv.plex.agents.movie',
    scanner: 'Plex Movie'
  }
];

export interface PlexSection {
  type: string;
  Location?: { path: string }[];
}

export async function getPlexLibraries(baseUrl: string, token: string): Promise<PlexSection[]> {
  const response = await fetch(`${baseUrl}/library/sections`, {
    headers: { 'X-Plex-Token': token, Accept: 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`GET /library/sections returned ${response.status}`);
  }
  const data = await response.json() as { MediaContainer?: { Directory?: PlexSection[] } };
  return data.MediaContainer?.Directory ?? [];
}

// A library "covers" the target when a section of the same type already points
// at the location, regardless of what the user named it. Single source of
// truth for both the creation idempotency check and the dashboard status
// endpoint — if these two disagree the dashboard would re-trigger setup forever.
export function isLibraryCovered(sections: PlexSection[], library: PlexLibrary): boolean {
  return sections.some(
    section => section.type === library.type &&
      (section.Location ?? []).some(loc => loc.path === library.location)
  );
}

export function plexLibrariesConfigured(sections: PlexSection[], libraries: PlexLibrary[]): boolean {
  return libraries.every(library => isLibraryCovered(sections, library));
}

// Create the library unless one of the same type already covers the location
// (regardless of what the user named it).
export async function ensurePlexLibrary(
  baseUrl: string,
  token: string,
  library: PlexLibrary
): Promise<{ created: boolean }> {
  const existing = await getPlexLibraries(baseUrl, token);
  if (isLibraryCovered(existing, library)) {
    return { created: false };
  }

  const params = new URLSearchParams({
    name: library.name,
    type: library.type,
    agent: library.agent,
    scanner: library.scanner,
    language: 'en-US',
    location: library.location
  });
  const response = await fetch(`${baseUrl}/library/sections?${params}`, {
    method: 'POST',
    headers: { 'X-Plex-Token': token, Accept: 'application/json' }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`POST /library/sections returned ${response.status}: ${text.slice(0, 200)}`);
  }
  return { created: true };
}

export interface PlexSetupOptions {
  baseUrl: string;
  token: string;
  libraries?: PlexLibrary[];
  readyTimeoutMs?: number;
  // *arr instances that should be told to notify Plex on import, and Plex's
  // address on the container network they reach it at.
  arrTargets?: ArrTarget[];
  networkHost?: { host: string; port: number };
}

export async function setupPlex(setup: PlexSetupOptions): Promise<SetupStepResult[]> {
  const libraries = setup.libraries ?? DEFAULT_PLEX_LIBRARIES;
  const results: SetupStepResult[] = [];

  try {
    await waitForPlexReady(setup.baseUrl, setup.readyTimeoutMs);
  } catch (err) {
    return [{
      service: 'plex',
      step: 'ready',
      success: false,
      message: (err as Error).message
    }];
  }

  for (const library of libraries) {
    const step = `library-${library.type}`;
    try {
      const { created } = await ensurePlexLibrary(setup.baseUrl, setup.token, library);
      results.push({
        service: 'plex',
        step,
        success: true,
        message: created
          ? `Created "${library.name}" library at ${library.location}`
          : `A ${library.type} library already covers ${library.location}`
      });
    } catch (err) {
      results.push({ service: 'plex', step, success: false, message: (err as Error).message });
    }
  }

  // Tell each *arr to notify Plex (and trigger a library scan) on import.
  if (setup.arrTargets?.length && setup.networkHost) {
    for (const target of setup.arrTargets) {
      try {
        const { created } = await ensureMediaServerNotification(
          { baseUrl: target.baseUrl, apiKey: target.apiKey },
          { kind: 'plex', name: 'Plex', host: setup.networkHost.host, port: setup.networkHost.port, credential: setup.token }
        );
        results.push({
          service: 'plex',
          step: `notify-${target.service}`,
          success: true,
          message: created ? `${target.service} will refresh Plex on import` : `${target.service} already notifies Plex`
        });
      } catch (err) {
        results.push({ service: 'plex', step: `notify-${target.service}`, success: false, message: (err as Error).message });
      }
    }
  }

  return results;
}
