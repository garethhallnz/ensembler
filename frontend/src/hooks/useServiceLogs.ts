import { useEffect, useState } from 'react';
import { getServiceLogs } from '../requests/services';

// Streams a service's logs while the drawer is open: fetch immediately, then
// poll every 2s. Keeps a per-service cache so reopening shows the last lines
// instantly; transient fetch errors are ignored (the next tick retries).
export function useServiceLogs(serviceName: string | null, open: boolean): string | undefined {
  const [logsByService, setLogsByService] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open || !serviceName) return;
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        const logs = await getServiceLogs(serviceName);
        if (!cancelled) setLogsByService(prev => ({ ...prev, [serviceName]: logs }));
      } catch {
        // Ignore transient errors while polling; the next tick retries.
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serviceName, open]);

  return serviceName ? logsByService[serviceName] : undefined;
}
