import { useEffect, useState } from 'react';
import { getServiceMonitor, type ServiceMonitor } from '../requests/services';

// Polls per-service health/alert status while there are services, refetching
// whenever the set of services changes and every 30s otherwise. Errors are
// swallowed so a transient failure keeps the last good value.
export function useServiceAlerts(serviceKeys: string[]): ServiceMonitor {
  const [serviceAlerts, setServiceAlerts] = useState<ServiceMonitor>({});
  // Join the keys into a stable dep so the effect re-runs when the set changes,
  // not on every new array identity from the parent.
  const serviceSetKey = serviceKeys.join(',');

  useEffect(() => {
    if (serviceSetKey === '') return;
    let cancelled = false;
    const fetchAlerts = async () => {
      try {
        const alerts = await getServiceMonitor();
        if (!cancelled) setServiceAlerts(alerts);
      } catch (error) {
        console.error('Error fetching service alerts:', error);
      }
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [serviceSetKey]);

  return serviceAlerts;
}
