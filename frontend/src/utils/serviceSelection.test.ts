import { describe, it, expect } from 'vitest';
import { toggleService } from './serviceSelection';

const services = [
  { key: 'plex', category: 'media' },
  { key: 'jellyfin', category: 'media' },
  { key: 'emby', category: 'media' },
  { key: 'sonarr', category: 'management' },
  { key: 'radarr', category: 'management' },
  { key: 'transmission', category: 'torrent' },
  { key: 'deluge', category: 'torrent' },
  { key: 'prowlarr', category: 'indexer' },
  { key: 'jackett', category: 'indexer' },
];

describe('toggleService', () => {
  it('allows multiple media servers to be selected together', () => {
    const next = toggleService({ plex: true }, services, 'jellyfin');
    expect(next.plex).toBe(true);
    expect(next.jellyfin).toBe(true);
    const withEmby = toggleService(next, services, 'emby');
    expect(withEmby.plex).toBe(true);
    expect(withEmby.jellyfin).toBe(true);
    expect(withEmby.emby).toBe(true);
  });

  it('enforces single-select for download clients and indexers', () => {
    expect(toggleService({ transmission: true }, services, 'deluge').transmission).toBe(false);
    expect(toggleService({ prowlarr: true }, services, 'jackett').prowlarr).toBe(false);
  });

  it('allows multiple services in the "management" category', () => {
    const next = toggleService({ sonarr: true }, services, 'radarr');
    expect(next.sonarr).toBe(true);
    expect(next.radarr).toBe(true);
  });

  it('turns a selected service off when toggled again', () => {
    expect(toggleService({ plex: true }, services, 'plex').plex).toBe(false);
  });

  it('never deselects a required service in a single-select category', () => {
    const withRequired = [
      { key: 'transmission', category: 'torrent', required: true },
      { key: 'deluge', category: 'torrent' },
    ];
    const next = toggleService({ transmission: true }, withRequired, 'deluge');
    expect(next.deluge).toBe(true);
    expect(next.transmission).toBe(true);
  });
});
