import express, { Request, Response } from 'express';
import { Docker } from 'node-docker-api';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SUPPORTED_SERVICES, getServiceConfig, getServiceImages, getDefaultPorts } from './services/serviceConfig';

const app = express();
const port = 3001;

// CORS middleware to allow frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
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

// Platform-specific configuration directory
const getConfigDir = () => {
  if (process.platform === 'win32') {
    return path.join(os.homedir(), '.media-center');
  } else {
    return path.join(os.homedir(), '.media-center');
  }
};

const configDir = getConfigDir();
const configFile = path.join(configDir, 'config.json');
const execAsync = promisify(exec);

// Store for tracking last update check times
const updateCheckStore = {
  lastServiceCheck: new Date(),
  lastDockerCheck: new Date(),
  availableUpdates: {} as { [key: string]: { current: string, latest: string } }
};

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
            await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} stop ${serviceName}`);
            console.log(`Stopped ${serviceName}`);
            
            // Remove the container
            await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} rm -f ${serviceName}`);
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

            composeServices += `      - ${hostPath}:${containerPath}\n`;
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

    const composeContent = `services:\n${composeServices}`;
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
      return res.status(404).json({ success: false, message: 'config.json not found.' });
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
    await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} up -d ${serviceName} --remove-orphans --force-recreate`);
    res.json({ success: true, message: `${serviceName} started successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to start ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/stop', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} stop ${serviceName}`);
    res.json({ success: true, message: `${serviceName} stopped successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to stop ${serviceName}.`, error: (err as Error).message });
  }
});

app.post('/api/services/:serviceName/restart', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} restart ${serviceName}`);
    res.json({ success: true, message: `${serviceName} restarted successfully.` });
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to restart ${serviceName}.`, error: (err as Error).message });
  }
});

app.get('/api/services/:serviceName/logs', async (req: Request, res: Response) => {
  const { serviceName } = req.params;
  try {
    const { stdout } = await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} logs --tail=50 ${serviceName}`);
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
    // Use --remove-orphans to clean up any containers from services that are no longer in the compose file
    await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} up -d --remove-orphans`);
    res.json({ success: true, message: 'All enabled services started successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to start services.', error: (err as Error).message });
  }
});

app.post('/api/services/stop-all', async (req: Request, res: Response) => {
  try {
    await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} stop`);
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

app.post('/api/config/reset', async (req: Request, res: Response) => {
  try {
    // Stop all services first
    if (fs.existsSync(composeFile)) {
      try {
        await execAsync(`docker compose -f ${composeFile} down`);
      } catch (err) {
        console.warn('Failed to stop services:', err);
      }
    }

    // Delete configuration files
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
    }
    
    if (fs.existsSync(composeFile)) {
      fs.unlinkSync(composeFile);
    }

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

    try {
      // Get current local image ID and creation date
      const { stdout: currentImageInfo } = await execAsync(`docker image inspect ${imageName} --format "{{.Id}},{{.Created}}"`);
      const [currentImageId, currentCreated] = currentImageInfo.trim().split(',');
      
      // Pull latest image metadata only (not the full image)
      await execAsync(`docker pull ${imageName} --quiet`);
      
      // Get the updated image info after pull
      const { stdout: updatedImageInfo } = await execAsync(`docker image inspect ${imageName} --format "{{.Id}},{{.Created}}"`);
      const [updatedImageId, updatedCreated] = updatedImageInfo.trim().split(',');
      
      // Compare image IDs to determine if there's an update
      const hasUpdate = currentImageId !== updatedImageId;
      
      const currentVersion = currentCreated.split('T')[0];
      const latestVersion = updatedCreated.split('T')[0];
      
      updateCheckStore.availableUpdates[serviceName] = {
        current: currentVersion,
        latest: hasUpdate ? latestVersion : currentVersion
      };
      
      res.json({ 
        success: true, 
        hasUpdate,
        currentVersion: currentVersion,
        latestVersion: latestVersion,
        updateAvailable: hasUpdate ? `Update available (${latestVersion})` : 'Up to date'
      });
    } catch (err) {
      console.error(`Error checking updates for ${serviceName}:`, err);
      // Try to get current version info even if update check fails
      try {
        const { stdout: currentInfo } = await execAsync(`docker image inspect ${imageName} --format "{{.Created}}"`);
        const currentVersion = currentInfo.trim().split('T')[0];
        
        res.json({ 
          success: true, 
          hasUpdate: false,
          currentVersion: currentVersion,
          latestVersion: 'unknown',
          updateAvailable: 'Unable to check for updates',
          error: (err as Error).message
        });
      } catch (inspectErr) {
        res.json({ 
          success: false, 
          hasUpdate: false,
          currentVersion: 'unknown',
          latestVersion: 'unknown',
          updateAvailable: 'Service not installed or Docker not available',
          error: (err as Error).message
        });
      }
    }
  } catch (err) {
    res.status(500).json({ success: false, message: `Failed to check updates for ${serviceName}.`, error: (err as Error).message });
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
    await execAsync(`docker compose -f ${composeFile} pull ${serviceName}`);
    await execAsync(`docker compose -f ${composeFile} up -d ${serviceName}`);
    
    res.json({ success: true, message: `${serviceName} updated successfully.` });
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
const scheduleWeeklyUpdateChecks = () => {
  const checkInterval = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  
  setInterval(async () => {
    try {
      console.log('Running weekly update checks...');
      
      // Check Docker updates
      const dockerResponse = await fetch('http://localhost:3001/api/docker/check-updates');
      const dockerData = await dockerResponse.json() as any;
      
      if (dockerData.success && (dockerData.docker?.updateAvailable || dockerData.compose?.updateAvailable)) {
        console.log('Docker updates available:', dockerData);
        // In a real implementation, you might want to notify the UI or send a notification
      }
      
      // Check service updates
      if (fs.existsSync(configFile)) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        const selectedServices = Object.keys(config.selectedServices).filter((key: string) => config.selectedServices[key]);
        
        for (const serviceName of selectedServices) {
          const response = await fetch(`http://localhost:3001/api/services/${serviceName}/check-updates`);
          const data = await response.json() as any;
          
          if (data.success && data.hasUpdate) {
            console.log(`Update available for ${serviceName}:`, data);
            // In a real implementation, you might want to notify the UI or send a notification
          }
        }
      }
      
      updateCheckStore.lastServiceCheck = new Date();
    } catch (err) {
      console.error('Error during weekly update check:', err);
    }
  }, checkInterval);
};

// Start the weekly update check scheduler
scheduleWeeklyUpdateChecks();

app.listen(port, () => console.log(`Backend listening on port ${port}`));

export default app;
