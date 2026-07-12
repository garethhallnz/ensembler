import { useEffect, useState } from 'react';
import { HiExclamation, HiX } from 'react-icons/hi';

interface DockerMemoryCheck {
  ok: boolean;
  allocatedGiB: number | null;
  recommendedGiB: number;
}

interface DiskCheck {
  ok: boolean;
  freeGiB: number | null;
  recommendedGiB: number;
}

interface SystemChecks {
  dockerMemory: DockerMemoryCheck;
  disk: DiskCheck;
}

// Advisory environment warnings (low Docker memory, low disk) surfaced at the
// top of the dashboard. Only renders when something is actually low, and can be
// dismissed for the session so it never nags.
export default function SystemChecksBanner() {
  const [checks, setChecks] = useState<SystemChecks | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('http://localhost:3001/api/system/checks');
        if (!res.ok) return;
        const data = await res.json();
        if (data.success) setChecks(data.checks);
      } catch {
        /* silent — these checks are advisory */
      }
    })();
  }, []);

  if (dismissed || !checks) return null;

  const warnings: string[] = [];
  if (!checks.dockerMemory.ok && checks.dockerMemory.allocatedGiB !== null) {
    warnings.push(
      `Docker has only ${checks.dockerMemory.allocatedGiB} GB of memory. Media services (especially Plex) run better with ${checks.dockerMemory.recommendedGiB} GB or more — raise it in your container runtime's settings (Docker Desktop → Settings → Resources).`
    );
  }
  if (!checks.disk.ok && checks.disk.freeGiB !== null) {
    warnings.push(
      `Only ${checks.disk.freeGiB} GB free where media is stored. Downloads can fail when space runs out — free up space or point services at a larger drive.`
    );
  }

  if (warnings.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <HiExclamation className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Check your setup</h3>
          <ul className="mt-1 space-y-1 text-sm text-gray-700 dark:text-gray-200 list-disc list-inside">
            {warnings.map(warning => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <HiX className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
