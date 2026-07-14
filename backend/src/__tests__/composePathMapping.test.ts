import { load as loadYaml } from 'js-yaml';
import { generateComposeFile, type EnsemblerConfig } from '../services/compose';

// Locks in host→container path resolution for the services whose media/download
// paths are service-specific (plex/emby/jellyfin/deluge/bazarr). Precedence:
//   1. the service's own configured path (config.paths[serviceKey][index])
//   2. else the shared media path via the {paths.tv|movies|downloads} template
//      (config.paths.sonarr[0] / radarr[0] / transmission[0])
//   3. else a fallback folder under the config dir
// These services had NO test coverage before; this guards a later refactor of
// the per-service resolution ladder.

const volumesFor = (config: EnsemblerConfig, serviceKey: string): string[] => {
  const parsed = loadYaml(generateComposeFile(config)) as { services: Record<string, { volumes: string[] }> };
  return parsed.services[serviceKey].volumes;
};

const base = (over: Partial<EnsemblerConfig>): EnsemblerConfig => ({
  selectedServices: {},
  paths: {},
  ports: {},
  environment: { tz: 'UTC', puid: 1000, pgid: 1000 },
  ...over,
});

describe('compose path mapping — service-specific media paths', () => {
  it.each(['plex', 'emby', 'jellyfin'] as const)('maps %s tv→[0] and movies→[1]', (key) => {
    const volumes = volumesFor(
      base({ selectedServices: { [key]: true }, paths: { [key]: ['/media/shows', '/media/films'] } }),
      key,
    );
    expect(volumes).toContain('/media/shows:/tv');
    expect(volumes).toContain('/media/films:/movies');
  });

  it('maps deluge downloads→[0]', () => {
    const volumes = volumesFor(
      base({ selectedServices: { deluge: true }, paths: { deluge: ['/data/downloads'] } }),
      'deluge',
    );
    expect(volumes).toContain('/data/downloads:/downloads');
  });

  it('maps bazarr tv→[0] and movies→[1]', () => {
    const volumes = volumesFor(
      base({ selectedServices: { bazarr: true }, paths: { bazarr: ['/b/tv', '/b/movies'] } }),
      'bazarr',
    );
    expect(volumes).toContain('/b/tv:/tv');
    expect(volumes).toContain('/b/movies:/movies');
  });
});

describe('compose path mapping — precedence', () => {
  it('prefers the service-specific path over the shared media path', () => {
    const volumes = volumesFor(
      base({
        selectedServices: { plex: true },
        paths: { sonarr: ['/shared/tv'], radarr: ['/shared/movies'], plex: ['/plex/tv', '/plex/movies'] },
      }),
      'plex',
    );
    expect(volumes).toContain('/plex/tv:/tv');
    expect(volumes).toContain('/plex/movies:/movies');
  });

  it('falls back to the shared media path when the service has none', () => {
    const volumes = volumesFor(
      base({
        selectedServices: { plex: true },
        paths: { sonarr: ['/shared/tv'], radarr: ['/shared/movies'] },
      }),
      'plex',
    );
    expect(volumes).toContain('/shared/tv:/tv');
    expect(volumes).toContain('/shared/movies:/movies');
  });

  it('never emits an empty or still-templated host path', () => {
    const volumes = volumesFor(base({ selectedServices: { plex: true }, paths: {} }), 'plex');
    for (const v of volumes) {
      expect(v.startsWith(':')).toBe(false);
      expect(v).not.toMatch(/\{[a-zA-Z.]+\}/);
    }
  });
});
