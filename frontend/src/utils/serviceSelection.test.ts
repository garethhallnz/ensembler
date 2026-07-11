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
  it('deselects the others when a "choose one" media server is picked', () => {
    const next = toggleService({ plex: true }, services, 'jellyfin');
    expect(next.jellyfin).toBe(true);
    expect(next.plex).toBe(false);
    expect(next.emby).toBeFalsy();
  });

  it('enforces single-select for download clients and indexers too', () => {
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
      { key: 'plex', category: 'media', required: true },
      { key: 'jellyfin', category: 'media' },
    ];
    const next = toggleService({ plex: true }, withRequired, 'jellyfin');
    expect(next.jellyfin).toBe(true);
    expect(next.plex).toBe(true);
  });
});
