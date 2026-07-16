// The order categories are displayed in — shared by the setup wizard, the
// add-service picker, and the dashboard so grouping is consistent everywhere.
export const CATEGORY_ORDER: string[] = ['media', 'management', 'torrent', 'indexer', 'request'];

// Group services into display order, dropping empty categories. Services with an
// unknown/missing category (e.g. a future catalog entry) are appended in their
// first-seen order rather than hidden.
export function groupByCategory<T extends { category?: string }>(
  services: T[],
): { category: string; services: T[] }[] {
  const groups: { category: string; services: T[] }[] = [];
  const emit = (category: string) => {
    const inCategory = services.filter(service => (service.category ?? 'other') === category);
    if (inCategory.length > 0) groups.push({ category, services: inCategory });
  };

  const seen = new Set<string>();
  for (const category of CATEGORY_ORDER) {
    emit(category);
    seen.add(category);
  }
  for (const service of services) {
    const category = service.category ?? 'other';
    if (!seen.has(category)) {
      seen.add(category);
      emit(category);
    }
  }
  return groups;
}
