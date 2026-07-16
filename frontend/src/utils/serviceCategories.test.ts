import { describe, it, expect } from 'vitest';
import { groupByCategory } from './serviceCategories';

const svc = (key: string, category?: string) => ({ key, category });

describe('groupByCategory', () => {
  it('groups services in category order, skipping empty categories', () => {
    const groups = groupByCategory([
      svc('transmission', 'torrent'),
      svc('sonarr', 'management'),
      svc('plex', 'media'),
      svc('radarr', 'management'),
    ]);
    expect(groups.map(g => g.category)).toEqual(['media', 'management', 'torrent']);
    expect(groups[1].services.map(s => s.key)).toEqual(['sonarr', 'radarr']);
  });

  it('appends unknown/missing categories rather than hiding them', () => {
    const groups = groupByCategory([
      svc('plex', 'media'),
      svc('adguard', 'network'),
      svc('mystery'),
    ]);
    expect(groups.map(g => g.category)).toEqual(['media', 'network', 'other']);
    expect(groups[2].services.map(s => s.key)).toEqual(['mystery']);
  });
});
