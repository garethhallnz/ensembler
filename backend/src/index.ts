import express, { Request, Response } from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { SUPPORTED_SERVICES, getServiceConfig } from './services/serviceConfig';
import { configDir, configFile, composeFile, writeFileAtomic } from './services/paths';
import { execAsync, execFileAsync } from './services/exec';
import { isDockerRunning, composeUp, composeStop, composeRestart, composeLogs, getContainerStatus } from './services/docker';
import { getEffectiveImage, writeComposeFile } from './services/compose';
import {
  checkServiceUpdate,
  fetchAvailableVersions,
  refreshUpdateCache,
  applyAvailableUpdates,
  updateService,
  getAvailableUpdates,
  recordServiceUpdate,
  startUpdateScheduler,
} from './services/updates';
import { runSystemChecks } from './services/systemChecks';
import { resetStopServices, resetCleanFilesAndData } from './services/reset';
import { getServiceVersion } from './services/versions';
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

// Reject any request for an unknown :serviceName before it reaches a handler.
// Every service-scoped route operates on a service from the catalog, so this one
// guard both validates input and stops an untrusted path segment from ever
// reaching a docker command.
app.param('serviceName', (req, res, next, name) => {
  if (!getServiceConfig(name)) {
    return res.status(404).json({ success: false, code: 'messages.service.notFound', message: 'Service not found.' });
  }
  next();
});

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
      return res.status(400).json({ success: false, code: 'messages.common.invalidInput', message: 'Invalid input' });
    }
  
    const results = paths.map(p => {
      try {
        if (!fs.existsSync(p)) {
          fs.mkdirSync(p, { recursive: true });
        }
      } catch {
        // Don't leak raw fs error text to the client; return a stable code the UI localizes.
        return { path: p, valid: false, code: 'messages.paths.createFailed', message: 'Could not create this folder.' };
      }
      try {
        fs.accessSync(p, fs.constants.W_OK);
      } catch {
        return { path: p, valid: false, code: 'messages.paths.notWritable', message: 'This folder is not writable.' };
      }
      return { path: p, valid: true };
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
    return res.status(400).json({ success: false, code: 'messages.common.invalidInput', message: 'Invalid input' });
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
    res.status(500).json({ success: false, code: 'messages.ports.validateFailed', message: 'Failed to validate ports.', error: (err as Error).message });
  }
});

app.get('/api/docker/status', async (req: Request, res: Response) => {
  try {
    // Liveness via the CLI so it works on every OS (see isDockerRunning).
    if (!(await isDockerRunning())) {
      return res.json({ docker: false, compose: false, code: 'messages.docker.notRunning', message: 'Docker not running or not installed.' });
    }
    // Docker Compose check: try to run 'docker compose version' via child_process
    exec('docker compose version', (err, stdout) => {
      if (err) {
        return res.json({ docker: true, compose: false, code: 'messages.docker.composeNotFound', message: 'Docker Compose not found or not working.' });
      }
      res.json({ docker: true, compose: true, composeVersion: stdout.trim() });
    });
  } catch {
    res.json({ docker: false, compose: false, code: 'messages.docker.notRunning', message: 'Docker not running or not installed.' });
  }
});

app.get('/api/system/checks', async (req: Request, res: Response) => {
  const checks = await runSystemChecks();
  res.json({ success: true, checks });
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
    writeFileAtomic(configFile, JSON.stringify(newConfig, null, 2));

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
            await execFileAsync('docker', ['compose', '-f', path.join(configDir, 'docker-compose.yml'), 'stop', serviceName]);
            console.log(`Stopped ${serviceName}`);

            // Remove the container
            await execFileAsync('docker', ['compose', '-f', path.join(configDir, 'docker-compose.yml'), 'rm', '-f', serviceName]);
            console.log(`Removed ${serviceName} container`);
          } catch (err) {
            console.warn(`Failed to cleanup ${serviceName}:`, err);
            // Continue with other services even if one fails
          }
        }
      }
    }

    res.json({ success: true, code: 'messages.config.saved', message: 'Configuration saved successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.config.saveFailed', message: 'Failed to save configuration.', error: (err as Error).message });
  }
});

app.post('/api/docker/autostart', async (req: Request, res: Response) => {
  const platform = os.platform();
  let startCmd = '';
  if (platform === 'darwin') {
    startCmd = 'open --background -a Docker';
  } else if (platform === 'win32') {
    startCmd = 'start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"';
  } else if (platform === 'linux') {
    startCmd = 'systemctl start docker';
  } else {
    return res.status(400).json({ success: false, code: 'messages.docker.autostartUnsupportedOs', message: 'Unsupported OS for auto-start.' });
  }
  try {
    exec(startCmd, async (err) => {
      if (err) {
        return res.status(500).json({ success: false, code: 'messages.docker.autostartFailed', message: 'Failed to start Docker automatically.' });
      }
      // Wait and re-check Docker status
      setTimeout(async () => {
        if (await isDockerRunning()) {
          res.json({ success: true, code: 'messages.docker.started', message: 'Docker started successfully.' });
        } else {
          res.status(500).json({ success: false, code: 'messages.docker.startCheckFailed', message: 'Docker did not start successfully.' });
        }
      }, 5000);
    });
  } catch {
    res.status(500).json({ success: false, code: 'messages.docker.startError', message: 'Error attempting to start Docker.' });
  }
});

app.post('/api/config/generate-compose', (req: Request, res: Response) => {
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    writeComposeFile(config);
    res.json({ success: true, code: 'messages.compose.generated', message: 'Docker Compose files generated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.compose.generateFailed', message: 'Failed to generate Docker Compose files.', error: (err as Error).message });
  }
});

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
      serviceStatus[serviceName] = await getContainerStatus(serviceName);
    }

    res.json({ success: true, serviceStatus });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.statusFailed', message: 'Failed to get service status.', error: (err as Error).message });
  }
});

// Service control endpoints
app.post('/api/services/:serviceName/start', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await composeUp(serviceName, true);
    res.json({ success: true, code: 'messages.service.started', params: { name: serviceName }, message: `${serviceName} started successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.startFailed', params: { name: serviceName }, message: `Failed to start ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/stop', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await composeStop(serviceName);
    res.json({ success: true, code: 'messages.service.stopped', params: { name: serviceName }, message: `${serviceName} stopped successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.stopFailed', params: { name: serviceName }, message: `Failed to stop ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/restart', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await composeRestart(serviceName);
    res.json({ success: true, code: 'messages.service.restarted', params: { name: serviceName }, message: `${serviceName} restarted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.restartFailed', params: { name: serviceName }, message: `Failed to restart ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/logs', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    const { stdout } = await composeLogs(serviceName);
    res.json({ success: true, logs: stdout });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.logsFailed', params: { name: serviceName }, message: `Failed to get logs for ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/version', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    const version = await getServiceVersion(serviceName);
    res.json({ success: true, version });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.versionFailed', params: { name: serviceName }, message: `Failed to get version for ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/start-all', async (req: Request, res: Response) => {
  try {
    // composeUp cleans up orphans and self-heals container-name conflicts.
    await composeUp();
    res.json({ success: true, code: 'messages.service.startAllSucceeded', message: 'All enabled services started successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.startAllFailed', message: 'Failed to start services.', error: (err as Error).message });
  }
});

app.post('/api/services/setup-connections', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const result = await setupConnections(config, configDir);

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
          code: 'messages.setup.bazarrRestartFailed',
          params: { error: (err as Error).message },
          message: `Seeded config but failed to restart Bazarr: ${(err as Error).message}`
        });
        result.success = false;
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.setup.connectionsFailed', message: 'Failed to set up service connections.', error: (err as Error).message });
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
  } catch {
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
  } catch {
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
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const result = await setupPlexConnections(config, configDir);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.setup.plexFailed', message: 'Failed to set up Plex.', error: (err as Error).message });
  }
});

app.post('/api/services/stop-all', async (req: Request, res: Response) => {
  try {
    await composeStop();
    res.json({ success: true, code: 'messages.service.stopAllSucceeded', message: 'All services stopped successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.stopAllFailed', message: 'Failed to stop all services.', error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/launch-url', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      console.error('config.json not found at', configFile);
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const serviceConfig = getServiceConfig(serviceName);

    if (!serviceConfig) {
      console.error('Service config not found for', serviceName);
      return res.status(404).json({ success: false, code: 'messages.service.notFound', message: 'Service not found.' });
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
    res.status(500).json({ success: false, code: 'messages.service.launchUrlFailed', message: 'Failed to get launch URL.', error: (err as Error).message });
  }
});

// Advanced Settings endpoints
app.get('/api/config/current', (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    res.json(config);
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.config.currentFailed', message: 'Failed to get current configuration.', error: (err as Error).message });
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
    res.status(500).json({ success: false, code: 'messages.service.configFailed', message: 'Failed to get service configuration.', error: (err as Error).message });
  }
});

app.post('/api/services/validate-selection', (req: Request, res: Response) => {
  try {
    const { selectedServices } = req.body;
    if (!selectedServices || !Array.isArray(selectedServices)) {
      return res.status(400).json({ success: false, code: 'messages.service.invalidSelectionFormat', message: 'Invalid selectedServices format.' });
    }
    
    
    // Check if at least Sonarr or Radarr is selected
    const hasRequiredService = selectedServices.includes('sonarr') || selectedServices.includes('radarr');
    if (!hasRequiredService) {
      return res.status(400).json({
        success: false,
        code: 'messages.service.selectionRequiresArr',
        message: 'You must select at least Sonarr or Radarr.'
      });
    }
    
    res.json({ success: true, code: 'messages.service.selectionValid', message: 'Service selection is valid.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.selectionValidateFailed', message: 'Failed to validate service selection.', error: (err as Error).message });
  }
});

// Stepped reset endpoints so the UI can show progress one phase at a time,
// matching the setup flow. The combined endpoint below runs both.
app.post('/api/config/reset/stop-services', async (req: Request, res: Response) => {
  try {
    await resetStopServices();
    res.json({ success: true, code: 'messages.reset.servicesStopped', message: 'Services stopped and removed.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.reset.stopServicesFailed', message: 'Failed to stop services.', error: (err as Error).message });
  }
});

app.post('/api/config/reset/clean', async (req: Request, res: Response) => {
  try {
    resetCleanFilesAndData();
    res.json({ success: true, code: 'messages.reset.cleaned', message: 'Configuration and data removed.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.reset.cleanFailed', message: 'Failed to remove configuration and data.', error: (err as Error).message });
  }
});

app.post('/api/config/reset', async (req: Request, res: Response) => {
  try {
    await resetStopServices();
    resetCleanFilesAndData();
    res.json({ success: true, code: 'messages.reset.completed', message: 'All settings reset successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.reset.failed', message: 'Failed to reset settings.', error: (err as Error).message });
  }
});

// Recent pinnable versions for the config UI's version picker.
app.get('/api/services/:serviceName/versions', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  const serviceConfig = getServiceConfig(serviceName);
  if (!serviceConfig) {
    return res.status(404).json({ success: false, code: 'messages.service.notFound', message: 'Service not found.' });
  }
  try {
    const versions = await fetchAvailableVersions(serviceConfig.image);
    res.json({ success: true, versions });
  } catch {
    // Best-effort — the UI still offers "Latest" if the registry is unreachable.
    res.json({ success: true, versions: [] });
  }
});

// Update check endpoints
app.get('/api/services/:serviceName/check-updates', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const serviceConfig = getServiceConfig(serviceName);
    if (!serviceConfig) {
      return res.status(404).json({ success: false, code: 'messages.service.notFound', message: 'Service not found.' });
    }

    const imageName = getEffectiveImage(serviceName, config);

    // Cheap digest comparison — no image pull.
    const hasUpdate = await checkServiceUpdate(imageName);
    recordServiceUpdate(serviceName, hasUpdate);

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
    res.status(500).json({ success: false, code: 'messages.service.checkUpdatesFailed', params: { name: serviceName }, message: `Failed to check updates for ${serviceName}.`, error: (err as Error).message });
  }
});

// Instant read of cached update status for all services (no docker calls).
app.get('/api/services/updates', (req: Request, res: Response) => {
  const { updates, lastChecked } = getAvailableUpdates();
  res.json({ success: true, updates, lastChecked });
});

// Refresh the update cache on demand (cheap digest checks). Backs the
// dashboard's "Check for updates" action.
app.post('/api/services/updates/check', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    await refreshUpdateCache();
    const { updates, lastChecked } = getAvailableUpdates();
    res.json({ success: true, updates, lastChecked });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.checkUpdatesAllFailed', message: 'Failed to check for updates.', error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/update', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    
    // Pull + recreate the service, then refresh the cached update status so the
    // dashboard's stale "update available" prompt clears after a successful run.
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const hasUpdate = await updateService(serviceName, config);

    res.json({ success: true, code: 'messages.service.updated', params: { name: serviceName }, message: `${serviceName} updated successfully.`, hasUpdate });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.updateFailed', params: { name: serviceName }, message: `Failed to update ${serviceName}.`, error: (err as Error).message });
  }
});

// Update every service that currently has a pending update; reports per-service
// outcomes. Also runs unattended from the daily scheduler when the user has
// enabled auto-update.
app.post('/api/services/updates/apply-all', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    const { updated, failed } = await applyAvailableUpdates();
    res.json({ success: failed.length === 0, updated, failed });
  } catch (err) {
    res.status(500).json({ success: false, code: 'messages.service.updateAllFailed', message: 'Failed to update services.', error: (err as Error).message });
  }
});

// Service failure monitoring endpoint
app.get('/api/services/monitor', async (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(configFile)) {
      return res.status(404).json({ success: false, code: 'messages.config.notFound', message: 'config.json not found.' });
    }
    
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    const selectedServices = Object.keys(config.selectedServices).filter((key: string) => config.selectedServices[key]);
    
    const serviceHealthChecks: Record<string, {
      running: boolean;
      healthy: boolean;
      status: string;
      alert: boolean;
    }> = {};
    
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
      } catch {
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
    res.status(500).json({ success: false, code: 'messages.service.monitorFailed', message: 'Failed to monitor services.', error: (err as Error).message });
  }
});

if (process.env.NODE_ENV !== 'test') {
  // Start the background update-check scheduler
  startUpdateScheduler();

  app.listen(port, () => console.log(`Backend listening on port ${port}`));
}

export default app;
