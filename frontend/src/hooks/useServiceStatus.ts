import { useCallback, useEffect, useState } from 'react';
import { getServiceStatuses, getDockerStatus } from '../requests/services';
import { runtimeManager, type RuntimeStatus } from '../services/runtimeManager';

// Core dashboard status: which services are running, whether Docker is up, and
// the runtime-manager snapshot. Loads on mount, polls every 30s (using the
// runtime-manager's cached snapshot), and exposes refresh() for a full re-read
// with a fresh runtime check after an action.
export function useServiceStatus() {
  const [serviceStatus, setServiceStatus] = useState<Record<string, string>>({});
  const [dockerStatus, setDockerStatus] = useState<{ running: boolean; updates: string }>({
    running: true,
    updates: 'No updates available',
  });
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      setServiceStatus(await getServiceStatuses());
    } catch (error) {
      console.error('Error fetching service status:', error);
    }
  }, []);

  const fetchDocker = useCallback(async () => {
    try {
      const { docker, compose } = await getDockerStatus();
      const running = docker && compose;
      setDockerStatus({ running, updates: running ? 'Docker running' : 'Docker not running' });
    } catch (error) {
      console.error('Error fetching Docker status:', error);
    }
  }, []);

  // Full re-read with a fresh runtime check — for post-action refreshes.
  const refresh = useCallback(async () => {
    await fetchStatus();
    await fetchDocker();
    setRuntimeStatus(await runtimeManager.checkStatus());
  }, [fetchStatus, fetchDocker]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchStatus();
      await fetchDocker();
      setRuntimeStatus(runtimeManager.getStatus());
      setLoading(false);
    };
    load();

    // Re-poll so cards reflect containers that changed state out-of-band (e.g. a
    // crash or a manual stop). Uses the runtime-manager's cached snapshot.
    const interval = setInterval(() => {
      setRuntimeStatus(runtimeManager.getStatus());
      fetchStatus();
      fetchDocker();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchDocker]);

  return { serviceStatus, dockerStatus, runtimeStatus, loading, refresh };
}
