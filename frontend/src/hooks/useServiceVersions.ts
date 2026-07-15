import { useCallback, useEffect, useState } from 'react';
import { getServiceVersion, getPinnedVersions } from '../requests/services';

// Owns the muted per-card version badges: the best-effort running version per
// service and which services are pinned to a specific tag. Refetches when the
// service set changes; `refresh(keys)` lets mutation handlers update specific
// services after an update.
export function useServiceVersions(serviceKeys: string[]) {
  const [serviceVersions, setServiceVersions] = useState<Record<string, string>>({});
  const [pinnedVersions, setPinnedVersions] = useState<Record<string, string>>({});

  const refresh = useCallback(async (keys: string[]) => {
    const entries = await Promise.all(keys.map(async key => {
      try {
        return [key, await getServiceVersion(key)] as const;
      } catch {
        return [key, ''] as const;
      }
    }));
    const found = entries.filter(([, v]) => v && v !== 'Not installed');
    if (found.length > 0) setServiceVersions(prev => ({ ...prev, ...Object.fromEntries(found) }));

    try {
      setPinnedVersions(await getPinnedVersions());
    } catch {
      // Leave pinned as-is — the badge just falls back to the "latest" marker.
    }
  }, []);

  const serviceSetKey = serviceKeys.join(',');
  useEffect(() => {
    if (serviceSetKey === '') return;
    refresh(serviceSetKey.split(','));
  }, [serviceSetKey, refresh]);

  return { serviceVersions, pinnedVersions, refresh };
}
