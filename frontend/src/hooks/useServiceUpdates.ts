import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getServiceUpdates,
  checkServiceUpdates,
  getServiceUpdateStatus,
  type ServiceUpdates,
  type AutoUpdateResult,
} from '../requests/services';

const AUTO_CHECK_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Owns per-service update availability + the read/check actions. Pure data: the
// actions return results or throw, so callers add their own toasts/UX. The
// mutation handlers (apply update / update all) live in the component and call
// refresh() afterwards.
export function useServiceUpdates(serviceKeys: string[]) {
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdates>({});
  const [updateChecking, setUpdateChecking] = useState<Record<string, boolean>>({});
  const [recentlyChecked, setRecentlyChecked] = useState<Record<string, boolean>>({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [lastAutoUpdate, setLastAutoUpdate] = useState<AutoUpdateResult | null>(null);
  const autoCheckedRef = useRef(false);
  // "Up to date" fade-out timers, cleared on unmount so they can't setState after.
  const fadeTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => { fadeTimers.current.forEach(clearTimeout); }, []);

  // Read the cached update status; a first, stale cache also triggers one cheap
  // background digest check so availability surfaces without user action.
  const refresh = useCallback(async () => {
    try {
      const { updates, lastChecked, lastAutoUpdate: latestAutoUpdate } = await getServiceUpdates();
      setServiceUpdates(updates);
      setLastAutoUpdate(latestAutoUpdate);
      if (!autoCheckedRef.current) {
        autoCheckedRef.current = true;
        const last = lastChecked ? new Date(lastChecked).getTime() : 0;
        if (Date.now() - last > AUTO_CHECK_TTL_MS) {
          void (async () => {
            try {
              setServiceUpdates(await checkServiceUpdates());
            } catch {
              /* silent: availability just won't refresh this time */
            }
          })();
        }
      }
    } catch (error) {
      console.error('Error fetching update status:', error);
    }
  }, []);

  // Re-check every service (digest only). Returns how many have an update.
  const checkAll = useCallback(async (): Promise<number> => {
    setCheckingAll(true);
    try {
      const updates = await checkServiceUpdates();
      setServiceUpdates(updates);
      return Object.values(updates).filter(u => u?.hasUpdate).length;
    } finally {
      setCheckingAll(false);
    }
  }, []);

  // Re-check one service; returns its availability (null = unknown).
  const checkOne = useCallback(async (serviceKey: string): Promise<boolean | null> => {
    setUpdateChecking(prev => ({ ...prev, [serviceKey]: true }));
    try {
      const hasUpdate = await getServiceUpdateStatus(serviceKey);
      setServiceUpdates(prev => ({ ...prev, [serviceKey]: { hasUpdate } }));
      if (!hasUpdate) {
        setRecentlyChecked(prev => ({ ...prev, [serviceKey]: true }));
        const timer = setTimeout(() => setRecentlyChecked(prev => ({ ...prev, [serviceKey]: false })), 4000);
        fadeTimers.current.push(timer);
      }
      return hasUpdate;
    } finally {
      setUpdateChecking(prev => ({ ...prev, [serviceKey]: false }));
    }
  }, []);

  const serviceSetKey = serviceKeys.join(',');
  useEffect(() => {
    if (serviceSetKey === '') return;
    refresh();
    // Poll the cached read (no docker calls) so update badges stay current and a
    // background auto-update result surfaces without the user reopening the app.
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [serviceSetKey, refresh]);

  return { serviceUpdates, updateChecking, recentlyChecked, checkingAll, lastAutoUpdate, refresh, checkAll, checkOne };
}
