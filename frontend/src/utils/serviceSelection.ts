// Categories shown as "choose one" in the setup wizard are single-select:
// turning one on turns the other (non-required) services in that category off.
// "management" (Sonarr/Radarr/Bazarr) allows multiple. Kept pure and separate
// from the component so it can be unit-tested — a stack with two media servers
// or two download clients breaks the interconnection logic.
export const SINGLE_SELECT_CATEGORIES = ['media', 'torrent', 'indexer', 'request'];

export interface SelectableService {
  key: string;
  category: string;
  required?: boolean;
}

// Return the new selection map after toggling `key`.
export function toggleService(
  selected: Record<string, boolean>,
  services: SelectableService[],
  key: string,
): Record<string, boolean> {
  const service = services.find(s => s.key === key);
  const turningOn = !selected[key];
  const next: Record<string, boolean> = { ...selected, [key]: turningOn };

  if (turningOn && service && SINGLE_SELECT_CATEGORIES.includes(service.category)) {
    for (const other of services) {
      if (other.category === service.category && other.key !== key && !other.required) {
        next[other.key] = false;
      }
    }
  }
  return next;
}
