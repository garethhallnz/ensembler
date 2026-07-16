import fs from 'fs';
import path from 'path';

// The running Ensembler version. Electron passes it via ENSEMBLER_APP_VERSION
// when it spawns the backend (mirroring ENSEMBLER_DATA_DIR); when the backend
// runs standalone for local dev, nothing sets that variable, so it reads the
// root package.json instead. The backend never imports Electron.
function readCurrentVersion(): string {
  if (process.env.ENSEMBLER_APP_VERSION) {
    return process.env.ENSEMBLER_APP_VERSION;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Strictly-newer comparison of dotted numeric versions. A leading `v` and any
// pre-release/build suffix (e.g. `-rc.1`) are ignored — the numeric release is
// compared segment by segment, so 1.10.0 correctly beats 1.9.0.
export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const next = a[i] ?? 0;
    const prev = b[i] ?? 0;
    if (next !== prev) return next > prev;
  }
  return false;
}

export type AppUpdateStatus = {
  currentVersion: string;
  // null when GitHub couldn't be reached — surfaced as "couldn't determine",
  // never as "up to date", so a network blip doesn't hide a real update.
  latestVersion: string | null;
  hasUpdate: boolean;
  releaseUrl: string | null;
  lastChecked: string | null;
};

// Overridable via ENSEMBLER_RELEASES_URL for local testing (point it at a repo
// that has releases to exercise the "update available" path). Defaults to the
// real repo, so it's a no-op in production.
const RELEASES_URL = process.env.ENSEMBLER_RELEASES_URL
  ?? 'https://api.github.com/repos/garethhallnz/ensembler/releases/latest';
// Don't re-hit GitHub more than this often unless a check is forced (the manual
// "Check for updates" button forces it). Keeps launch + banner cheap.
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;

const store: { status: AppUpdateStatus | null; checkedAt: number } = { status: null, checkedAt: 0 };

// Query the GitHub Releases API for the latest published release and compare it
// to the running version. Best-effort: a network failure leaves latestVersion
// null rather than throwing. Result is cached for CHECK_TTL_MS unless `force`.
export async function checkForAppUpdate(force = false): Promise<AppUpdateStatus> {
  const now = Date.now();
  if (!force && store.status && now - store.checkedAt < CHECK_TTL_MS) {
    return store.status;
  }

  const currentVersion = readCurrentVersion();
  let latestVersion: string | null = null;
  let releaseUrl: string | null = null;
  try {
    // GitHub rejects requests without a User-Agent with 403.
    const resp = await fetch(RELEASES_URL, {
      headers: { 'User-Agent': 'Ensembler', Accept: 'application/vnd.github+json' },
    });
    if (resp.ok) {
      const data = await resp.json() as { tag_name?: string; html_url?: string };
      if (data.tag_name) {
        latestVersion = data.tag_name.replace(/^v/, '');
        releaseUrl = data.html_url ?? null;
      }
    }
  } catch {
    // Leave latestVersion null — treated as undeterminable, not up-to-date.
  }

  const status: AppUpdateStatus = {
    currentVersion,
    latestVersion,
    hasUpdate: latestVersion ? isNewerVersion(latestVersion, currentVersion) : false,
    releaseUrl,
    lastChecked: new Date().toISOString(),
  };
  store.status = status;
  store.checkedAt = now;
  return status;
}
