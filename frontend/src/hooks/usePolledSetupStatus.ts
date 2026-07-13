import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../requests/client';

interface UsePolledSetupStatusOptions<T> {
  // Status endpoint to poll (relative path passed to apiFetch).
  endpoint: string;
  // Derive the "needs attention" flag from the response.
  map: (data: T) => boolean;
  // Re-poll immediately whenever this value changes (e.g. the service's status),
  // in addition to the fixed interval.
  dep: unknown;
  intervalMs?: number;
  // Optional side effect run on each successful poll — used by Plex to auto-wire
  // its libraries once the user has signed in.
  onData?: (data: T) => void;
}

// Polls a service's setup-status endpoint and returns whether it still needs
// manual attention. Owns the cancellation flag, interval, and cleanup so the
// three near-identical dashboard effects collapse to one call each.
export function usePolledSetupStatus<T = unknown>({
  endpoint, map, dep, intervalMs = 15000, onData,
}: UsePolledSetupStatusOptions<T>): boolean {
  const [needsAttention, setNeedsAttention] = useState(false);
  // Refs so passing inline map/onData doesn't reset the interval every render.
  const mapRef = useRef(map);
  const onDataRef = useRef(onData);
  mapRef.current = map;
  onDataRef.current = onData;

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiFetch(endpoint);
        const data = await res.json() as T;
        if (cancelled) return;
        setNeedsAttention(mapRef.current(data));
        onDataRef.current?.(data);
      } catch {
        if (!cancelled) setNeedsAttention(false);
      }
    };
    check();
    const interval = setInterval(check, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [endpoint, dep, intervalMs]);

  return needsAttention;
}
