import fs from 'fs';
import { getServiceConfig } from './serviceConfig';
import { configFile } from './paths';
import { execAsync, dockerCompose } from './exec';
import { getEffectiveImage } from './compose';

// Cache of update status per service. hasUpdate is null when it can't be
// determined (image not pulled, registry unreachable). Populated by a cheap
// background digest comparison — never by pulling images. Module-private: read
// and written only through the functions below.
const updateCheckStore = {
  lastServiceCheck: new Date(),
  availableUpdates: {} as { [key: string]: { hasUpdate: boolean | null } }
};

// Digest of the locally-pulled image for a tag (the manifest the tag resolved
// to when pulled). Null if the image isn't present or has no repo digest.
async function getLocalImageDigest(image: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`docker image inspect ${image} --format "{{index .RepoDigests 0}}"`);
    const match = stdout.trim().match(/@(sha256:[a-f0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Digest the tag currently points at in the registry — read from metadata only
// (no layer download), unlike `docker pull`.
async function getRemoteImageDigest(image: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`docker buildx imagetools inspect ${image}`);
    const match = stdout.match(/Digest:\s*(sha256:[a-f0-9]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// True/false when both digests are known, null when the comparison can't be made.
export async function checkServiceUpdate(image: string): Promise<boolean | null> {
  const [local, remote] = await Promise.all([getLocalImageDigest(image), getRemoteImageDigest(image)]);
  if (!local || !remote) {
    return null;
  }
  return local !== remote;
}

// Recent release versions published for a service's image, for the version
// picker. LinuxServer tags the same release several ways (4.0.19,
// 4.0.19.2979-ls319, version-…, plus per-arch copies), so we keep only numeric
// release tags and collapse them to one clean entry per release. Best-effort:
// returns [] if the registry can't be reached.
const MAX_VERSIONS = 12;

// Choose the friendliest real tag for a release: a plain numeric tag (e.g.
// "4.0.19") when one exists, else the newest tag in the group. Always a real,
// pullable tag — never a synthesised string.
function pickReleaseTag(tags: string[]): string {
  const pureNumeric = tags.filter(t => /^\d+(?:\.\d+){1,3}$/.test(t));
  if (pureNumeric.length) return pureNumeric.sort((a, b) => a.length - b.length)[0];
  return tags[0];
}

export async function fetchAvailableVersions(image: string): Promise<string[]> {
  const withoutTag = image.replace(/:[^:/]+$/, '');
  const parts = withoutTag.split('/');
  // Drop a registry host (has a dot or port) so lscr.io/linuxserver/sonarr →
  // linuxserver/sonarr, the Docker Hub repo these images mirror to.
  const repo = parts[0].includes('.') || parts[0].includes(':') ? parts.slice(1).join('/') : withoutTag;

  // Group tags by release. The newest 100 tags are dominated by per-arch and
  // dev variants of the current release, so page a little to surface enough
  // history for a rollback.
  const releaseTags = new Map<string, string[]>();
  const releaseOrder: string[] = [];
  let url: string | null = `https://hub.docker.com/v2/repositories/${repo}/tags/?page_size=100&ordering=last_updated`;

  for (let page = 0; page < 5 && url && releaseOrder.length < MAX_VERSIONS; page++) {
    const resp = await fetch(url);
    if (!resp.ok) break;
    const data = await resp.json() as { results?: { name: string }[]; next?: string | null };
    for (const { name } of data.results ?? []) {
      if (!/^\d/.test(name)) continue; // skips latest, develop, version-*, arch-* (non-numeric-leading)
      if (/develop|nightly|beta|alpha|edge|unstable|-rc/i.test(name)) continue;
      const numeric = name.match(/^\d+(?:\.\d+)*/)?.[0] ?? name;
      const releaseKey = numeric.split('.').slice(0, 3).join('.'); // 4.0.19.2979 / 4.1.3-r0 → 4.0.19 / 4.1.3
      if (!releaseTags.has(releaseKey)) {
        releaseTags.set(releaseKey, []);
        releaseOrder.push(releaseKey);
      }
      releaseTags.get(releaseKey)!.push(name);
    }
    url = data.next ?? null;
  }

  return releaseOrder.slice(0, MAX_VERSIONS).map(key => pickReleaseTag(releaseTags.get(key)!));
}

// Snapshot of the cached update status (no docker calls).
export function getAvailableUpdates(): { updates: { [key: string]: { hasUpdate: boolean | null } }; lastChecked: Date } {
  return { updates: updateCheckStore.availableUpdates, lastChecked: updateCheckStore.lastServiceCheck };
}

// Record a single service's checked status into the cache.
export function recordServiceUpdate(serviceName: string, hasUpdate: boolean | null): void {
  updateCheckStore.availableUpdates[serviceName] = { hasUpdate };
}

// Refresh the cached update status for all enabled services (cheap digest
// checks). Shared by the manual endpoint and the background scheduler.
export async function refreshUpdateCache(): Promise<void> {
  if (!fs.existsSync(configFile)) {
    return;
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  const enabled = Object.keys(config.selectedServices || {}).filter((k: string) => config.selectedServices[k]);
  // Check services concurrently — each registry query is independent, so this
  // is bounded by the slowest single check rather than their sum.
  await Promise.all(enabled.map(async (key) => {
    const serviceConfig = getServiceConfig(key);
    if (!serviceConfig) {
      return;
    }
    updateCheckStore.availableUpdates[key] = { hasUpdate: await checkServiceUpdate(getEffectiveImage(key, config)) };
  }));
  updateCheckStore.lastServiceCheck = new Date();
}

// Pull + recreate every enabled service with a pending update. Each runs on its
// own so one failure doesn't abort the rest. Relies on the cached update status,
// so callers should refresh it first if they need current results.
export async function applyAvailableUpdates(): Promise<{ updated: string[]; failed: { service: string; error?: string }[] }> {
  const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  const enabled = Object.keys(config.selectedServices || {}).filter((k: string) => config.selectedServices[k]);
  const targets = enabled.filter(key => updateCheckStore.availableUpdates[key]?.hasUpdate === true);

  const results: { service: string; success: boolean; error?: string }[] = [];
  for (const key of targets) {
    try {
      await dockerCompose(['pull', key]);
      await dockerCompose(['up', '-d', key]);
      const svc = getServiceConfig(key);
      updateCheckStore.availableUpdates[key] = { hasUpdate: svc ? await checkServiceUpdate(getEffectiveImage(key, config)) : false };
      results.push({ service: key, success: true });
    } catch (err) {
      results.push({ service: key, success: false, error: (err as Error).message });
    }
  }
  return {
    updated: results.filter(r => r.success).map(r => r.service),
    failed: results.filter(r => !r.success).map(r => ({ service: r.service, error: r.error })),
  };
}

// Daily update-check scheduler (runs shortly after startup, then every 24h).
// When the user has opted into auto-update, it also applies any updates found.
export function startUpdateScheduler(): void {
  const checkInterval = 24 * 60 * 60 * 1000; // daily

  const run = async () => {
    try {
      await refreshUpdateCache();
      const autoUpdateEnabled = fs.existsSync(configFile)
        && JSON.parse(fs.readFileSync(configFile, 'utf-8')).autoUpdate === true;
      if (autoUpdateEnabled) {
        const { updated, failed } = await applyAvailableUpdates();
        if (updated.length) console.log(`Auto-update applied: ${updated.join(', ')}`);
        if (failed.length) console.error(`Auto-update failed: ${failed.map(f => f.service).join(', ')}`);
      }
    } catch (err) {
      console.error('Error during scheduled update check:', err);
    }
  };

  // Prime the cache shortly after startup, then daily.
  setTimeout(run, 10000);
  setInterval(run, checkInterval);
}
