import fs from 'fs';
import path from 'path';
import { dump as dumpYaml } from 'js-yaml';
import { getServiceConfig } from './serviceConfig';
import { configDir, composeFile } from './paths';

export interface EnsemblerConfig {
  selectedServices: Record<string, boolean>;
  environment?: { puid?: number | string; pgid?: number | string; tz?: string };
  paths: Record<string, string[] | undefined>;
  ports?: Record<string, number | string>;
  versions?: Record<string, string>;
}

// The image a service should run, honouring an optional pinned tag
// (config.versions[key]). Falls back to the service's default (:latest) image.
// Pinning to a specific tag also means update checks compare against that tag,
// so a pinned service stops reporting "update available".
export function getEffectiveImage(serviceKey: string, config: { versions?: { [key: string]: string } }): string {
  const serviceConfig = getServiceConfig(serviceKey);
  if (!serviceConfig) return '';
  const pinnedTag = config?.versions?.[serviceKey];
  if (!pinnedTag) return serviceConfig.image;
  return `${serviceConfig.image.replace(/:[^:/]+$/, '')}:${pinnedTag}`;
}

// Build the docker-compose.yml content for the given config. Serialised via a
// real YAML writer so every config value (paths, TZ, env) is emitted as an
// escaped scalar and can never inject compose directives. `name` pins the
// Compose project so it doesn't depend on the config-dir path (otherwise Compose
// derives it from the directory name, orphaning containers when the dir is
// moved/renamed). lineWidth: -1 disables wrapping so long host paths stay on one line.
export function generateComposeFile(config: EnsemblerConfig): string {
  const services: Record<string, unknown> = {};
  const environmentConfig = config.environment ?? {};
  // Respect a legitimate 0 (root) for PUID/PGID — `??`, not `||`.
  const puid = environmentConfig.puid ?? 1000;
  const pgid = environmentConfig.pgid ?? 1000;
  const tz = environmentConfig.tz ?? 'UTC';

  Object.keys(config.selectedServices).forEach((serviceKey: string) => {
    if (!config.selectedServices[serviceKey]) return;
    const serviceConfig = getServiceConfig(serviceKey);
    if (!serviceConfig) return;

    const environment = [`PUID=${puid}`, `PGID=${pgid}`, `TZ=${tz}`];
    if (serviceConfig.environmentVars) {
      Object.entries(serviceConfig.environmentVars).forEach(([key, value]) => {
        environment.push(`${key}=${value}`);
      });
    }

    const volumes = serviceConfig.volumes.map((volume) => {
      let hostPath = volume.hostPath;
      const containerPath = volume.containerPath;

      // Replace placeholders
      if (hostPath.includes('{configDir}')) {
        hostPath = hostPath.replace('{configDir}', configDir);
      }
      if (hostPath.includes('{paths.tv}') && config.paths.sonarr?.[0]) {
        hostPath = hostPath.replace('{paths.tv}', config.paths.sonarr[0]);
      } else if (hostPath.includes('{paths.movies}') && config.paths.radarr?.[0]) {
        hostPath = hostPath.replace('{paths.movies}', config.paths.radarr[0]);
      } else if (hostPath.includes('{paths.downloads}') && config.paths.transmission?.[0]) {
        hostPath = hostPath.replace('{paths.downloads}', config.paths.transmission[0]);
      }

      // Handle service-specific paths
      if (serviceKey === 'plex') {
        if (containerPath === '/tv' && config.paths.plex?.[0]) {
          hostPath = config.paths.plex[0];
        } else if (containerPath === '/movies' && config.paths.plex?.[1]) {
          hostPath = config.paths.plex[1];
        }
      } else if (serviceKey === 'emby') {
        if (containerPath === '/tv' && config.paths.emby?.[0]) {
          hostPath = config.paths.emby[0];
        } else if (containerPath === '/movies' && config.paths.emby?.[1]) {
          hostPath = config.paths.emby[1];
        }
      } else if (serviceKey === 'jellyfin') {
        if (containerPath === '/tv' && config.paths.jellyfin?.[0]) {
          hostPath = config.paths.jellyfin[0];
        } else if (containerPath === '/movies' && config.paths.jellyfin?.[1]) {
          hostPath = config.paths.jellyfin[1];
        }
      } else if (serviceKey === 'deluge') {
        if (containerPath === '/downloads' && config.paths.deluge?.[0]) {
          hostPath = config.paths.deluge[0];
        }
      } else if (serviceKey === 'bazarr') {
        if (containerPath === '/tv' && config.paths.bazarr?.[0]) {
          hostPath = config.paths.bazarr[0];
        } else if (containerPath === '/movies' && config.paths.bazarr?.[1]) {
          hostPath = config.paths.bazarr[1];
        }
      }

      // Never emit an empty or still-templated host path: fall back to a folder
      // under the config dir so the container always has a valid mount source.
      if (!hostPath || hostPath.includes('{')) {
        hostPath = path.join(configDir, serviceKey, (containerPath.replace(/[^a-zA-Z0-9]/g, '') || 'data'));
      }

      return `${hostPath}:${containerPath}`;
    });

    const ports = [`${config.ports?.[serviceKey] ?? serviceConfig.defaultPort}:${serviceConfig.internalPort}`];
    if (serviceConfig.additionalPorts) {
      serviceConfig.additionalPorts.forEach((additionalPort) => {
        ports.push(`${additionalPort}:${additionalPort}`);
        ports.push(`${additionalPort}:${additionalPort}/udp`);
      });
    }

    services[serviceKey] = {
      image: getEffectiveImage(serviceKey, config),
      container_name: serviceKey,
      environment,
      volumes,
      ports,
      restart: 'unless-stopped',
    };
  });

  return dumpYaml({ name: 'ensembler', services }, { lineWidth: -1 });
}

// Generate and write docker-compose.yml. Compose is regenerated from config, so
// a plain write is fine (a torn file self-heals on the next generate).
export function writeComposeFile(config: EnsemblerConfig): void {
  fs.writeFileSync(composeFile, generateComposeFile(config));
}
