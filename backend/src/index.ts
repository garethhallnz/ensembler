import express, { Request, Response } from 'express';
import { Docker } from 'node-docker-api';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SUPPORTED_SERVICES, getServiceConfig, getServiceImages, getDefaultPorts } from './services/serviceConfig';
import { setupConnections, setupPlexConnections } from './services/setup/orchestrator';
import { tryReadArrApiKey } from './services/setup/apiKeyReader';
import { readPlexToken, getPlexLibraries, plexLibrariesConfigured, DEFAULT_PLEX_LIBRARIES } from './services/setup/plexSetup';
import { findPortConflicts, parseContainerPorts } from './services/ports';

const app = express();
const port = Number(process.env.PORT) || 3001;

// CORS middleware to allow frontend requests. This is a localhost-only backend
// with no cookies/credentials, and the frontend origin varies (dev server port,
// or file:// in the packaged app), so allow any origin rather than pinning one.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Configuration directory. The Electron main process passes the OS-native
// per-user data directory (app.getPath('userData')) via ENSEMBLER_DATA_DIR when
// it launches the backend, so packaged installs store data where each platform
// expects it:
//   macOS   ~/Library/Application Support/Ensembler
//   Windows %APPDATA%\Ensembler
//   Linux   ~/.config/Ensembler
// When the backend runs standalone for local dev (`npm run backend`), nothing
// sets that variable, so it falls back to a simple ~/.ensembler. The backend
// never imports Electron — this keeps the separate-process dev flow working.
const getConfigDir = () => {
  if (process.env.ENSEMBLER_DATA_DIR) {
    return process.env.ENSEMBLER_DATA_DIR;
  }
  return path.join(os.homedir(), '.ensembler');
};

const configDir = getConfigDir();
const configFile = path.join(configDir, 'config.json');
const execAsync = promisify(exec);

// Bring one service (or all, when service is omitted) up, self-healing against
// a stale container that already holds the fixed container_name — left over
// from an interrupted run, a crash, or an older install. Without this, `up`
// hard-fails with "container name is already in use" and a non-technical user
// has no way to recover. On that specific conflict we remove the offending
// container(s) — their data lives in mounted volumes, so recreation is lossless
// — and retry once.
async function composeUp(service?: string, forceRecreate = false): Promise<void> {
  const composeFile = path.join(configDir, 'docker-compose.yml');
  const flags = `${forceRecreate ? ' --force-recreate' : ''} --remove-orphans`;
  const cmd = `docker compose -f "${composeFile}" up -d${service ? ` ${service}` : ''}${flags}`;
  try {
    await execAsync(cmd);
  } catch (err) {
    const e = err as { message?: string; stderr?: string };
    const text = `${e.message ?? ''}\n${e.stderr ?? ''}`;
    const conflicts = [...text.matchAll(/container name "\/?([^"]+)" is already in use/gi)].map(m => m[1]);
    if (conflicts.length === 0) throw err; // a different failure — surface it
    await Promise.all(conflicts.map(name => execAsync(`docker rm -f ${name}`).catch(() => undefined)));
    await execAsync(cmd); // retry once with the names freed
  }
}

// Cache of update status per service. hasUpdate is null when it can't be
// determined (image not pulled, registry unreachable). Populated by a cheap
// background digest comparison — never by pulling images.
const updateCheckStore = {
  lastServiceCheck: new Date(),
  lastDockerCheck: new Date(),
  availableUpdates: {} as { [key: string]: { hasUpdate: boolean | null } }
};

// Digest of the locally-pulled image for a tag (the manifest the tag resolved
// to when pulled). Null if the image isn't present or has no repo digest.
async function getLocalImageDigest(image: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`docker image inspect ${image} --format "{{index .RepoDigests 0}}"`);
    const match = stdout.trim().match(/@(sha256:[a-f0-9]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Digest the tag currently points at in the registry — read from metadata only
// (no layer download), unlike `docker pull`.
async function getRemoteImageDigest(image: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`docker buildx imagetools inspect ${image}`);
    const match = stdout.match(/Digest:\s*(sha256:[a-f0-9]+)/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// True/false when both digests are known, null when the comparison can't be made.
async function checkServiceUpdate(image: string): Promise<boolean | null> {
  const [local, remote] = await Promise.all([getLocalImageDigest(image), getRemoteImageDigest(image)]);
  if (!local || !remote) {
    return null;
  }
  return local !== remote;
}

// Refresh the cached update status for all enabled services (cheap digest
// checks). Shared by the manual endpoint and the background scheduler.
async function refreshUpdateCache(): Promise<void> {
  if (!fs.existsSync(configFile)) {
    return;
  }
  const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  const enabled = Object.keys(config.selectedServices || {}).filter((k: string) => config.selectedServices[k]);
  // Check services concurrently — each registry query is independent, so this
  // is bounded by the slowest single check rather than their sum.
  await Promise.all(enabled.map(async (key) => {
    const serviceConfig = getServiceConfig(key);
    if (!serviceConfig) {
      return;
    }
    updateCheckStore.availableUpdates[key] = { hasUpdate: await checkServiceUpdate(serviceConfig.image) };
  }));
  updateCheckStore.lastServiceCheck = new Date();
}

app.get('/', (req: Request, res: Response) => res.send('Backend running'));

app.get('/api/config/status', (req: Request, res: Response) => {
  if (fs.existsSync(configFile)) {
    res.json({ setupComplete: true });
  } else {
    res.json({ setupComplete: false });
  }
});

app.post('/api/paths/validate', (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }
  
    const results = paths.map(p => {
      try {
        if (!fs.existsSync(p)) {
          fs.mkdirSync(p, { recursive: true });
        }
        fs.accessSync(p, fs.constants.W_OK);
        return { path: p, valid: true };
      } catch (err) {
        return { path: p, valid: false, error: (err as Error).message };
      }
    });
  
    if (results.some(r => !r.valid)) {
      res.status(400).json({ success: false, results });
    } else {
      res.json({ success: true, results });
    }
  });

// Check that the host ports the user picked are actually free before we
// generate a compose file that would fail to start. Ports already held by
// Ensembler's own running containers are not conflicts.
app.post('/api/ports/validate', async (req: Request, res: Response) => {
  const { ports } = req.body;
  if (!ports || typeof ports !== 'object') {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }

  const requested = Object.entries(ports).map(([service, port]) => ({
    service,
    port: Number(port)
  }));

  let ownPorts = new Map<number, string>();
  try {
    const { stdout } = await execAsync('docker ps --format "{{.Names}}\t{{.Ports}}"');
    ownPorts = parseContainerPorts(stdout);
  } catch {
    // Docker not running/available — treat all ports as owned by nobody
  }

  try {
    const conflicts = await findPortConflicts(requested, ownPorts);
    res.json({ success: conflicts.length === 0, conflicts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to validate ports.', error: (err as Error).message });
  }
});

app.get('/api/docker/status', async (req: Request, res: Response) => {
  try {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    // Try to list containers to check if Docker is running
    await docker.container.list();
    // Docker Compose check: try to run 'docker compose version' via child_process
    exec('docker compose version', (err, stdout) => {
      if (err) {
        return res.json({ docker: true, compose: false, message: 'Docker Compose not found or not working.' });
      }
      res.json({ docker: true, compose: true, composeVersion: stdout.trim() });
    });
  } catch (e) {
    res.json({ docker: false, compose: false, message: 'Docker not running or not installed.' });
  }
});

app.post('/api/config/save', async (req: Request, res: Response) => {
  const newConfig = req.body;
  try {
    // Read existing config to compare service changes
    let previousConfig = null;
    if (fs.existsSync(configFile)) {
      try {
        previousConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      } catch (err) {
        console.warn('Could not read previous config:', err);
      }
    }

    // Save new configuration
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));

    // Handle service cleanup if there's a previous config
    if (previousConfig && previousConfig.selectedServices) {
      const previousServices = Object.keys(previousConfig.selectedServices).filter(
        key => previousConfig.selectedServices[key]
      );
      const newServices = Object.keys(newConfig.selectedServices).filter(
        key => newConfig.selectedServices[key]
      );
      
      // Find services that were removed
      const removedServices = previousServices.filter(service => !newServices.includes(service));
      
      if (removedServices.length > 0) {
        console.log('Stopping and removing disabled services:', removedServices);
        
        // Stop and remove containers for disabled services
        for (const serviceName of removedServices) {
          try {
            // Stop the service
            await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" stop ${serviceName}`);
            console.log(`Stopped ${serviceName}`);
            
            // Remove the container
            await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" rm -f ${serviceName}`);
            console.log(`Removed ${serviceName} container`);
          } catch (err) {
            console.warn(`Failed to cleanup ${serviceName}:`, err);
            // Continue with other services even if one fails
          }
        }
      }
    }

    res.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save configuration.', error: (err as Error).message });
  }
});

app.post('/api/docker/autostart', async (req: Request, res: Response) => {
  const platform = os.platform();
  let startCmd = '';
  if (platform === 'darwin') {
    startCmd = 'open --background -a Docker';
  } else if (platform === 'win32') {
    startCmd = 'start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"';
  } else if (platform === 'linux') {
    startCmd = 'systemctl start docker';
  } else {
    return res.status(400).json({ success: false, message: 'Unsupported OS for auto-start.' });
  }
  try {
    exec(startCmd, async (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to start Docker automatically.' });
      }
      // Wait and re-check Docker status
      setTimeout(async () => {
        try {
          const docker = new Docker({ socketPath: '/var/run/docker.sock' });
          await docker.container.list();
          res.json({ success: true, message: 'Docker started successfully.' });
        } catch {
          res.status(500).json({ success: false, message: 'Docker did not start successfully.' });
        }
      }, 5000);
    });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Error attempting to start Docker.' });
  }
});

app.post('/api/config/generate-compose', (req: Request, res: Response) => {
  const configFile = path.join(configDir, 'config.json');
  const composeFile = path.join(configDir, 'docker-compose.yml');

  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

    let composeServices = '';
    Object.keys(config.selectedServices).forEach((serviceKey: string) => {
      if (config.selectedServices[serviceKey]) {
        const serviceConfig = getServiceConfig(serviceKey);
        
        if (serviceConfig) {
          composeServices += `  ${serviceKey}:\n`;
          composeServices += `    image: ${serviceConfig.image}\n`;
          composeServices += `    container_name: ${serviceKey}\n`;
          composeServices += `    environment:\n`;
          composeServices += `      - PUID=${config.environment.puid || 1000}\n`;
          composeServices += `      - PGID=${config.environment.pgid || 1000}\n`;
          composeServices += `      - TZ=${config.environment.tz || 'UTC'}\n`;
          
          // Add service-specific environment variables
          if (serviceConfig.environmentVars) {
            Object.entries(serviceConfig.environmentVars).forEach(([key, value]) => {
              composeServices += `      - ${key}=${value}\n`;
            });
          }
          composeServices += `    volumes:\n`;
          
          // Generate volumes based on service configuration
          serviceConfig.volumes.forEach((volume) => {
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

            // Never emit an empty or still-templated host path: an empty path
            // or a leading "{" produces invalid YAML (a flow-mapping) and breaks
            // the whole compose file. Fall back to a folder under the config dir
            // so the file is always valid and the container can start.
            if (!hostPath || hostPath.includes('{')) {
              hostPath = path.join(configDir, serviceKey, (containerPath.replace(/[^a-zA-Z0-9]/g, '') || 'data'));
            }

            // Quote the mapping so host paths containing spaces (e.g. macOS
            // "Application Support") stay a single valid YAML scalar.
            composeServices += `      - "${hostPath}:${containerPath}"\n`;
          });
          
          composeServices += `    ports:\n`;
          const port = config.ports[serviceKey] || serviceConfig.defaultPort;
          composeServices += `      - ${port}:${serviceConfig.internalPort}\n`;
          
          // Add additional ports if specified
          if (serviceConfig.additionalPorts) {
            serviceConfig.additionalPorts.forEach((additionalPort) => {
              composeServices += `      - ${additionalPort}:${additionalPort}\n`;
              composeServices += `      - ${additionalPort}:${additionalPort}/udp\n`;
            });
          }
          
          composeServices += `    restart: unless-stopped\n\n`;
        }
      }
    });

    // Pin the Compose project name so it never depends on the config directory
    // path. Without this, Compose derives the project from the directory name,
    // so moving/renaming the config dir orphans the existing containers under
    // the old project — start then hits container-name conflicts and stop/
    // restart silently no-op against the new (empty) project.
    const composeContent = `name: ensembler\n\nservices:\n${composeServices}`;
    fs.writeFileSync(composeFile, composeContent);

    res.json({ success: true, message: 'Docker Compose files generated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate Docker Compose files.', error: (err as Error).message });
  }
});

const composeFile = path.join(configDir, 'docker-compose.yml');

app.get('/api/services/status', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      // No setup yet — that is not an error, just nothing configured. Return an
      // empty status with 200 (rather than 404) so clients that poll this
      // endpoint don't log a failed request on every tick before setup.
      return res.json({ success: true, serviceStatus: {} });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const selectedServices = Object.keys(config.selectedServices).filter((key: string) => config.selectedServices[key]);

    const serviceStatus: { [key: string]: string } = {};
    for (const serviceName of selectedServices) {
      try {
        const { stdout } = await execAsync(`docker ps --filter "name=${serviceName}" --format "{{.Status}}"`);
        if (stdout.trim() === '') {
          serviceStatus[serviceName] = 'Stopped';
        } else if (stdout.includes('Up')) {
          serviceStatus[serviceName] = 'Running';
        } else {
          serviceStatus[serviceName] = 'Starting';
        }
      } catch (err) {
        serviceStatus[serviceName] = 'Unknown';
      }
    }

    res.json({ success: true, serviceStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get service status.', error: (err as Error).message });
  }
});

// Service control endpoints
app.post('/api/services/:serviceName/start', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await composeUp(serviceName, true);
    res.json({ success: true, message: `${serviceName} started successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to start ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/stop', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" stop ${serviceName}`);
    res.json({ success: true, message: `${serviceName} stopped successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to stop ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/restart', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" restart ${serviceName}`);
    res.json({ success: true, message: `${serviceName} restarted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to restart ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/logs', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    const { stdout } = await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" logs --tail=50 ${serviceName}`);
    res.json({ success: true, logs: stdout });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get logs for ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/version', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    const serviceConfig = getServiceConfig(serviceName);
    if (!serviceConfig) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    // Helper to exec inside container
    async function execInContainer(container: string, cmd: string) {
      try {
        const { stdout } = await execAsync(`docker exec ${container} sh -c "${cmd}"`);
        return stdout.trim();
      } catch (e) {
        return null;
      }
    }

    // Helper to get image label
    async function getImageLabel(container: string, label: string) {
      try {
        const { stdout: imageNameOut } = await execAsync(
          `docker inspect --format='{{.Config.Image}}' ${container}`
        );
        const imageName = imageNameOut.trim();
        if (!imageName) return null;
        const { stdout: labelOut } = await execAsync(
          `docker image inspect ${imageName} --format='{{ index .Config.Labels "${label}" }}'`
        );
        return labelOut.trim() || null;
      } catch {
        return null;
      }
    }

    let version: string | null = null;
    // Try to get version from image label for LinuxServer.io images
    switch (serviceName) {
      case 'sonarr':
      case 'radarr':
      case 'prowlarr':
      case 'overseerr':
      case 'plex':
      case 'transmission': {
        version = await getImageLabel(serviceName, 'org.opencontainers.image.version');
        break;
      }
      default:
        break;
    }

    // If not found in label, try API/exec as before
    if (!version) {
      switch (serviceName) {
        case 'sonarr': {
          const output = await execInContainer('sonarr', 'curl -s http://localhost:8989/api/v3/system/status');
          if (output) {
            try {
              const json = JSON.parse(output);
              version = json.version || null;
            } catch {}
          }
          break;
        }
        case 'radarr': {
          const output = await execInContainer('radarr', 'curl -s http://localhost:7878/api/v3/system/status');
          if (output) {
            try {
              const json = JSON.parse(output);
              version = json.version || null;
            } catch {}
          }
          break;
        }
        case 'prowlarr': {
          const output = await execInContainer('prowlarr', 'curl -s http://localhost:9696/api/v1/system/status');
          if (output) {
            try {
              const json = JSON.parse(output);
              version = json.version || null;
            } catch {}
          }
          break;
        }
        case 'overseerr': {
          const output = await execInContainer('overseerr', 'curl -s http://localhost:5055/api/v1/status');
          if (output) {
            try {
              const json = JSON.parse(output);
              version = json.version || null;
            } catch {}
          }
          break;
        }
        case 'plex': {
          version = await execInContainer('plex', 'cat /version.txt');
          if (!version) {
            version = await execInContainer('plex', 'dpkg-query -W plexmediaserver');
            if (version) {
              version = version.split('\t')[1] || version;
            }
          }
          break;
        }
        case 'transmission': {
          version = await execInContainer('transmission', 'transmission-daemon --version');
          if (version) {
            const match = version.match(/(\d+\.\d+(?:\.\d+)?)/);
            version = match ? match[1] : version;
          }
          break;
        }
        default:
          break;
      }
    }

    if (version) {
      return res.json({ success: true, version });
    }

    // Fallback: use image creation date
    try {
      const { stdout: containerImage } = await execAsync(
        `docker inspect --format='{{.Config.Image}}' ${serviceName}`
      );
      const imageName = containerImage.trim();
      if (!imageName) {
        return res.json({ success: true, version: 'Not installed' });
      }
      const { stdout } = await execAsync(
        `docker image inspect ${imageName} --format "{{.Created}}"`
      );
      const dateVersion = stdout.trim().split('T')[0];
      return res.json({ success: true, version: dateVersion });
    } catch (err) {
      return res.json({ success: true, version: 'Not installed' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to get version for ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/start-all', async (req: Request, res: Response) => {
  try {
    // composeUp cleans up orphans and self-heals container-name conflicts.
    await composeUp();
    res.json({ success: true, message: 'All enabled services started successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to start services.', error: (err as Error).message });
  }
});

app.post('/api/services/setup-connections', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    // Jellyfin admin credentials arrive in the request body from the wizard and
    // are used transiently — never written to config.json or anywhere on disk.
    const jellyfin = req.body?.jellyfin;
    const secrets = jellyfin?.username && jellyfin?.password
      ? { jellyfin: { username: jellyfin.username, password: jellyfin.password } }
      : {};
    const result = await setupConnections(config, configDir, {}, secrets);

    // Any step that seeded on-disk config (Bazarr) needs its container
    // restarted to take effect.
    if (result.results.some(r => r.needsRestart)) {
      try {
        await execAsync(`docker compose -f "${composeFile}" restart bazarr`);
      } catch (err) {
        result.results.push({
          service: 'bazarr',
          step: 'restart',
          success: false,
          message: `Seeded config but failed to restart Bazarr: ${(err as Error).message}`
        });
        result.success = false;
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to set up service connections.', error: (err as Error).message });
  }
});

// Tells the dashboard whether the user still needs to add an indexer in
// Prowlarr (the one remaining manual setup step). hasIndexers is null when
// the answer is unknown (Prowlarr disabled, not started, or unreachable).
app.get('/api/services/prowlarr/indexer-status', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.json({ success: true, enabled: false, hasIndexers: null });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (!config.selectedServices?.prowlarr) {
      return res.json({ success: true, enabled: false, hasIndexers: null });
    }

    const apiKey = tryReadArrApiKey(configDir, 'prowlarr');
    if (!apiKey) {
      // Prowlarr hasn't written its config yet — status unknown, not "no indexers"
      return res.json({ success: true, enabled: true, hasIndexers: null });
    }
    const prowlarrPort = config.ports?.prowlarr || getServiceConfig('prowlarr')!.defaultPort;
    const response = await fetch(`http://localhost:${prowlarrPort}/api/v1/indexer`, {
      headers: { 'X-Api-Key': apiKey }
    });
    if (!response.ok) {
      throw new Error(`Prowlarr responded with ${response.status}`);
    }
    const indexers = await response.json() as unknown[];
    res.json({ success: true, enabled: true, hasIndexers: indexers.length > 0 });
  } catch (err) {
    res.json({ success: true, enabled: true, hasIndexers: null });
  }
});

// Drives the dashboard's Plex banner: whether the user still needs to do the
// one-time plex.tv sign-in, and whether the default libraries exist yet.
// Values are null when unknown (Plex disabled, not started, or unreachable).
app.get('/api/services/plex/setup-status', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.json({ success: true, enabled: false, signedIn: null, librariesConfigured: null });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (!config.selectedServices?.plex) {
      return res.json({ success: true, enabled: false, signedIn: null, librariesConfigured: null });
    }

    const token = readPlexToken(configDir);
    if (!token) {
      return res.json({ success: true, enabled: true, signedIn: false, librariesConfigured: false });
    }

    const plexPort = config.ports?.plex || getServiceConfig('plex')!.defaultPort;
    try {
      const sections = await getPlexLibraries(`http://localhost:${plexPort}`, token);
      const librariesConfigured = plexLibrariesConfigured(sections, DEFAULT_PLEX_LIBRARIES);
      res.json({ success: true, enabled: true, signedIn: true, librariesConfigured });
    } catch {
      res.json({ success: true, enabled: true, signedIn: true, librariesConfigured: null });
    }
  } catch (err) {
    res.json({ success: true, enabled: true, signedIn: null, librariesConfigured: null });
  }
});

// Overseerr configures itself through its own wizard (which auto-discovers
// Sonarr/Radarr/Plex and requires a Plex sign-in only the user can do). This
// tells the dashboard whether that wizard still needs finishing. initialized
// is null when unknown (disabled, not started, or unreachable).
app.get('/api/services/overseerr/setup-status', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.json({ success: true, enabled: false, initialized: null });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    if (!config.selectedServices?.overseerr) {
      return res.json({ success: true, enabled: false, initialized: null });
    }
    const port = config.ports?.overseerr || getServiceConfig('overseerr')!.defaultPort;
    const response = await fetch(`http://localhost:${port}/api/v1/settings/public`);
    if (!response.ok) {
      throw new Error(`Overseerr responded with ${response.status}`);
    }
    const data = await response.json() as { initialized?: boolean };
    res.json({ success: true, enabled: true, initialized: data.initialized === true });
  } catch {
    res.json({ success: true, enabled: true, initialized: null });
  }
});

// Runs only the Plex library setup — used by the dashboard once it detects the
// user has signed in, so it need not re-run the full multi-service wiring.
app.post('/api/services/plex/setup', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const result = await setupPlexConnections(config, configDir);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to set up Plex.', error: (err as Error).message });
  }
});

app.post('/api/services/stop-all', async (req: Request, res: Response) => {
  try {
    await execAsync(`docker compose -f "${path.join(configDir, 'docker-compose.yml')}" stop`);
    res.json({ success: true, message: 'All services stopped successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to stop all services.', error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/launch-url', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      console.error('config.json not found at', configFile);
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const serviceConfig = getServiceConfig(serviceName);

    console.log('Launch URL Request:');
    console.log('  Service Name:', serviceName);
    console.log('  Config File:', configFile);
    console.log('  Config Data:', config);
    console.log('  Service Config:', serviceConfig);

    if (!serviceConfig) {
      console.error('Service config not found for', serviceName);
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }
    
    const port = config.ports[serviceName] || serviceConfig.defaultPort;
    console.log('  Port used:', port);

    let url = `http://localhost:${port}`;
    if (serviceConfig.launchUrl) {
      url += serviceConfig.launchUrl;
    }
    res.json({ success: true, url });
  } catch (err) {
    console.error('Error getting launch URL:', err);
    res.status(500).json({ success: false, message: 'Failed to get launch URL.', error: (err as Error).message });
  }
});

// Advanced Settings endpoints
app.get('/api/config/current', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    res.json(config);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get current configuration.', error: (err as Error).message });
  }
});

// Service configuration endpoints
app.get('/api/services/config', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      services: SUPPORTED_SERVICES.map(service => ({
        key: service.key,
        name: service.name,
        description: service.description,
        category: service.category,
        defaultPort: service.defaultPort,
        pathRequirements: service.pathRequirements,
        required: service.required,
        recommended: service.recommended
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get service configuration.', error: (err as Error).message });
  }
});

app.post('/api/services/validate-selection', (req: Request, res: Response) => {
  try {
    const { selectedServices } = req.body;
    if (!selectedServices || !Array.isArray(selectedServices)) {
      return res.status(400).json({ success: false, message: 'Invalid selectedServices format.' });
    }
    
    
    // Check if at least Sonarr or Radarr is selected
    const hasRequiredService = selectedServices.includes('sonarr') || selectedServices.includes('radarr');
    if (!hasRequiredService) {
      return res.status(400).json({ 
        success: false, 
        message: 'You must select at least Sonarr or Radarr.' 
      });
    }
    
    res.json({ success: true, message: 'Service selection is valid.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to validate service selection.', error: (err as Error).message });
  }
});

// Stop and remove all service containers. Tolerant of `down` failing (e.g.
// nothing is running) — that must not block the rest of a reset.
async function resetStopServices(): Promise<void> {
  if (fs.existsSync(composeFile)) {
    try {
      await execAsync(`docker compose -f "${composeFile}" down`);
    } catch (err) {
      console.warn('Failed to stop services during reset:', err);
    }
  }
}

// Delete Ensembler's config files and every service data directory present in
// configDir (settings, databases, API keys) so services start completely
// fresh. Enumerating the directory rather than the current service catalog
// means data for services since removed from Ensembler is also cleared. Media
// files live outside configDir and are never touched.
function resetCleanFilesAndData(): void {
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
  if (fs.existsSync(composeFile)) {
    fs.unlinkSync(composeFile);
  }
  if (fs.existsSync(configDir)) {
    for (const entry of fs.readdirSync(configDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        fs.rmSync(path.join(configDir, entry.name), { recursive: true, force: true });
      } catch (err) {
        console.warn(`Failed to remove service data for ${entry.name}:`, err);
      }
    }
  }
}

// Stepped reset endpoints so the UI can show progress one phase at a time,
// matching the setup flow. The combined endpoint below runs both.
app.post('/api/config/reset/stop-services', async (req: Request, res: Response) => {
  try {
    await resetStopServices();
    res.json({ success: true, message: 'Services stopped and removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to stop services.', error: (err as Error).message });
  }
});

app.post('/api/config/reset/clean', async (req: Request, res: Response) => {
  try {
    resetCleanFilesAndData();
    res.json({ success: true, message: 'Configuration and data removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove configuration and data.', error: (err as Error).message });
  }
});

app.post('/api/config/reset', async (req: Request, res: Response) => {
  try {
    await resetStopServices();
    resetCleanFilesAndData();
    res.json({ success: true, message: 'All settings reset successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset settings.', error: (err as Error).message });
  }
});

// Update check endpoints
app.get('/api/services/:serviceName/check-updates', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const serviceConfig = getServiceConfig(serviceName);
    if (!serviceConfig) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    const imageName = serviceConfig.image;

    // Cheap digest comparison — no image pull.
    const hasUpdate = await checkServiceUpdate(imageName);
    updateCheckStore.availableUpdates[serviceName] = { hasUpdate };

    // Best-effort current version (local image build date) for display.
    let currentVersion = 'unknown';
    try {
      const { stdout } = await execAsync(`docker image inspect ${imageName} --format "{{.Created}}"`);
      currentVersion = stdout.trim().split('T')[0] || 'unknown';
    } catch {
      // image may not be pulled yet
    }

    res.json({ success: true, hasUpdate, currentVersion });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to check updates for ${serviceName}.`, error: (err as Error).message });
  }
});

// Instant read of cached update status for all services (no docker calls).
app.get('/api/services/updates', (req: Request, res: Response) => {
  res.json({
    success: true,
    updates: updateCheckStore.availableUpdates,
    lastChecked: updateCheckStore.lastServiceCheck
  });
});

// Refresh the update cache on demand (cheap digest checks). Backs the
// dashboard's "Check for updates" action.
app.post('/api/services/updates/check', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    await refreshUpdateCache();
    res.json({
      success: true,
      updates: updateCheckStore.availableUpdates,
      lastChecked: updateCheckStore.lastServiceCheck
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check for updates.', error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/update', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    
    const composeFile = path.join(configDir, 'docker-compose.yml');
    
    // Pull latest image and restart service
    await execAsync(`docker compose -f "${composeFile}" pull ${serviceName}`);
    await execAsync(`docker compose -f "${composeFile}" up -d ${serviceName}`);

    // Refresh the cached update status now that the image is current. Without
    // this the dashboard keeps reading a stale "update available" from the
    // cache (GET /api/services/updates) and the prompt reappears after a
    // successful update.
    let hasUpdate: boolean | null = false;
    const svc = getServiceConfig(serviceName);
    if (svc) {
      hasUpdate = await checkServiceUpdate(svc.image);
      updateCheckStore.availableUpdates[serviceName] = { hasUpdate };
    }

    res.json({ success: true, message: `${serviceName} updated successfully.`, hasUpdate });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to update ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/docker/check-updates', async (req: Request, res: Response) => {
  try {
    // Check if it's been more than a week since last check
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const shouldCheck = updateCheckStore.lastDockerCheck < oneWeekAgo;
    
    if (shouldCheck) {
      try {
        // Check Docker version
        const { stdout: dockerVersion } = await execAsync('docker --version');
        const { stdout: composeVersion } = await execAsync('docker compose version');
        
        // In a real implementation, you would check against Docker's API for latest versions
        // For now, we'll mock the check
        const dockerUpdateAvailable = Math.random() > 0.8;
        const composeUpdateAvailable = Math.random() > 0.8;
        
        updateCheckStore.lastDockerCheck = new Date();
        
        res.json({ 
          success: true, 
          docker: {
            current: dockerVersion.trim(),
            updateAvailable: dockerUpdateAvailable,
            message: dockerUpdateAvailable ? 'Docker update available' : 'Docker is up to date'
          },
          compose: {
            current: composeVersion.trim(),
            updateAvailable: composeUpdateAvailable,
            message: composeUpdateAvailable ? 'Docker Compose update available' : 'Docker Compose is up to date'
          },
          lastChecked: updateCheckStore.lastDockerCheck
        });
      } catch (err) {
        res.json({ 
          success: true, 
          docker: { current: 'unknown', updateAvailable: false, message: 'Could not check Docker version' },
          compose: { current: 'unknown', updateAvailable: false, message: 'Could not check Docker Compose version' },
          lastChecked: updateCheckStore.lastDockerCheck
        });
      }
    } else {
      res.json({ 
        success: true, 
        message: 'Update check not needed (checked recently)',
        lastChecked: updateCheckStore.lastDockerCheck
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to check Docker updates.', error: (err as Error).message });
  }
});

// Service failure monitoring endpoint
app.get('/api/services/monitor', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, message: 'config.json not found.' });
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const selectedServices = Object.keys(config.selectedServices).filter((key: string) => config.selectedServices[key]);
    
    const serviceHealthChecks: { [key: string]: any } = {};
    
    for (const serviceName of selectedServices) {
      try {
        const { stdout: containerInfo } = await execAsync(`docker ps --filter "name=${serviceName}" --format "{{.Status}}"`);
        const isHealthy = containerInfo.includes('Up') && !containerInfo.includes('unhealthy');
        const isRunning = containerInfo.includes('Up');
        
        serviceHealthChecks[serviceName] = {
          running: isRunning,
          healthy: isHealthy,
          status: containerInfo.trim() || 'Not running',
          alert: !isRunning || !isHealthy
        };
      } catch (err) {
        serviceHealthChecks[serviceName] = {
          running: false,
          healthy: false,
          status: 'Error checking status',
          alert: true
        };
      }
    }
    
    res.json({ success: true, services: serviceHealthChecks });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to monitor services.', error: (err as Error).message });
  }
});

// Weekly update check scheduler (runs every time the server starts and then every week)
const scheduleUpdateChecks = () => {
  const checkInterval = 24 * 60 * 60 * 1000; // daily

  const run = async () => {
    try {
      await refreshUpdateCache();
    } catch (err) {
      console.error('Error during scheduled update check:', err);
    }
  };

  // Prime the cache shortly after startup, then daily.
  setTimeout(run, 10000);
  setInterval(run, checkInterval);
};

if (process.env.NODE_ENV !== 'test') {
  // Start the background update-check scheduler
  scheduleUpdateChecks();

  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

export default app;
