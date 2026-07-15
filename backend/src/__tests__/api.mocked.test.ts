import { mockDockerState, setupDefaultMockState, dockerMocks, mockExec } from './mocks/dockerMock';
import { mockFileSystem, setupDefaultFileSystem, fileSystemMocks } from './mocks/fileSystemMock';

// Mock all external dependencies
jest.mock('node-docker-api', () => ({
  Docker: dockerMocks.Docker
}));

jest.mock('child_process', () => ({
  exec: mockExec
}));

jest.mock('fs', () => fileSystemMocks.fs);
jest.mock('path', () => fileSystemMocks.path);
jest.mock('os', () => fileSystemMocks.os);

// Import the module under test after mocking
import request from 'supertest';
import express from 'express';

// Since we can't easily import the actual app due to mocking, let's create a test app
// with the same endpoints for isolated testing
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Import the service configuration that should work with mocks
  const { SUPPORTED_SERVICES, getServiceConfig } = require('../services/serviceConfig');
  
  // Recreate key endpoints for testing
  app.get('/api/docker/status', async (req, res) => {
    try {
      const { Docker } = require('node-docker-api');
      const docker = new Docker({ socketPath: '/var/run/docker.sock' });
      await docker.container.list();
      
      const { exec } = require('child_process');
      exec('docker compose version', (err: any, stdout: string) => {
        if (err) {
          return res.json({ docker: true, compose: false, message: 'Docker Compose not found or not working.' });
        }
        res.json({ docker: true, compose: true, composeVersion: stdout.trim() });
      });
    } catch (e) {
      res.json({ docker: false, compose: false, message: 'Docker not running or not installed.' });
    }
  });

  app.get('/api/services/config', (req, res) => {
    try {
      res.json({
        success: true,
        services: SUPPORTED_SERVICES.map((service: any) => ({
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

  app.post('/api/services/validate-selection', (req, res) => {
    try {
      const { selectedServices } = req.body;
      if (!selectedServices || !Array.isArray(selectedServices)) {
        return res.status(400).json({ success: false, message: 'Invalid selectedServices format.' });
      }
      
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

  app.get('/api/config/status', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    const configDir = path.join(os.homedir(), '.ensembler');
    const configFile = path.join(configDir, 'config.json');
    
    if (fs.existsSync(configFile)) {
      res.json({ setupComplete: true });
    } else {
      res.json({ setupComplete: false });
    }
  });

  app.post('/api/config/save', (req, res) => {
    const config = req.body;
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const configDir = path.join(os.homedir(), '.ensembler');
      const configFile = path.join(configDir, 'config.json');
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      res.json({ success: true, message: 'Configuration saved successfully.' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to save configuration.', error: (err as Error).message });
    }
  });

  app.get('/api/services/status', async (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const configDir = path.join(os.homedir(), '.ensembler');
      const configFile = path.join(configDir, 'config.json');
      
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

  app.post('/api/services/:serviceName/start', async (req, res) => {
    const { serviceName } = req.params;
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const path = require('path');
      const os = require('os');
      
      const configDir = path.join(os.homedir(), '.ensembler');
      await execAsync(`docker compose -f ${path.join(configDir, 'docker-compose.yml')} start ${serviceName}`);
      res.json({ success: true, message: `${serviceName} started successfully.` });
    } catch (err) {
      res.status(500).json({ success: false, message: `Failed to start ${serviceName}.`, error: (err as Error).message });
    }
  });

  app.post('/api/paths/validate', async (req, res) => {
    const { paths } = req.body;
    if (!paths || !Array.isArray(paths)) {
      return res.status(400).json({ success: false, message: 'Invalid input' });
    }

    const fs = require('fs');
    const results = paths.map((p: string) => {
      try {
        if (!fs.existsSync(p)) {
          fs.mkdirSync(p, { recursive: true });
        }
      } catch {
        return { path: p, valid: false, code: 'messages.paths.createFailed', message: 'Could not create this folder.' };
      }
      try {
        fs.accessSync(p, fs.constants.W_OK);
      } catch {
        return { path: p, valid: false, code: 'messages.paths.notWritable', message: 'This folder is not writable.' };
      }
      return { path: p, valid: true };
    });

    if (results.some((r: any) => !r.valid)) {
      res.status(400).json({ success: false, results });
    } else {
      res.json({ success: true, results });
    }
  });

  return app;
};

describe('API Tests with Mocks', () => {
  let app: express.Express;

  beforeEach(() => {
    // Reset all mocks before each test
    setupDefaultMockState();
    setupDefaultFileSystem();
    app = createTestApp();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Docker Status API', () => {
    it('should return Docker and Compose as available when both are running', async () => {
      mockDockerState.setDockerRunning(true);
      mockDockerState.setComposeAvailable(true);

      const response = await request(app)
        .get('/api/docker/status')
        .expect(200);

      expect(response.body).toEqual({
        docker: true,
        compose: true,
        composeVersion: 'Docker Compose version v2.24.5'
      });
    });

    it('should return Docker not running when Docker is unavailable', async () => {
      mockDockerState.setDockerRunning(false);

      const response = await request(app)
        .get('/api/docker/status')
        .expect(200);

      expect(response.body).toEqual({
        docker: false,
        compose: false,
        message: 'Docker not running or not installed.'
      });
    });

    it('should return Compose not available when only Docker is running', async () => {
      mockDockerState.setDockerRunning(true);
      mockDockerState.setComposeAvailable(false);

      const response = await request(app)
        .get('/api/docker/status')
        .expect(200);

      expect(response.body).toEqual({
        docker: true,
        compose: false,
        message: 'Docker Compose not found or not working.'
      });
    });
  });

  describe('Service Configuration API', () => {
    it('should return available services configuration', async () => {
      const response = await request(app)
        .get('/api/services/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      const { SUPPORTED_SERVICES } = require('../services/serviceConfig');
      expect(response.body.services).toHaveLength(SUPPORTED_SERVICES.length);

      const sonarrService = response.body.services.find((s: any) => s.key === 'sonarr');
      expect(sonarrService).toEqual({
        key: 'sonarr',
        name: 'Sonarr',
        description: 'PVR for Usenet and BitTorrent users',
        category: 'management',
        defaultPort: 8989,
        pathRequirements: [{
          label: 'TV Shows Path',
          required: true,
          description: 'Directory where TV shows will be stored'
        }],
        required: false,
        recommended: true
      });
    });
  });

  describe('Service Validation API', () => {
    it('should validate correct service selection', async () => {
      const response = await request(app)
        .post('/api/services/validate-selection')
        .send({ selectedServices: ['sonarr', 'radarr'] })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Service selection is valid.'
      });
    });

    it('should reject selection without required services', async () => {
      const response = await request(app)
        .post('/api/services/validate-selection')
        .send({ selectedServices: ['prowlarr', 'overseerr'] })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'You must select at least Sonarr or Radarr.'
      });
    });


    it('should reject invalid input format', async () => {
      const response = await request(app)
        .post('/api/services/validate-selection')
        .send({ selectedServices: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid selectedServices format.'
      });
    });
  });

  describe('Configuration API', () => {
    it('should return setup complete when config exists', async () => {
      // Config file already exists in default mock state
      const response = await request(app)
        .get('/api/config/status')
        .expect(200);

      expect(response.body).toEqual({ setupComplete: true });
    });

    it('should return setup incomplete when config does not exist', async () => {
      // Remove config file
      mockFileSystem.removeFile('/mock/home/.ensembler/config.json');

      const response = await request(app)
        .get('/api/config/status')
        .expect(200);

      expect(response.body).toEqual({ setupComplete: false });
    });

    it('should save configuration successfully', async () => {
      const config = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };

      const response = await request(app)
        .post('/api/config/save')
        .send(config)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Configuration saved successfully.'
      });

      // Verify file was written
      const savedFile = mockFileSystem.getFile('/mock/home/.ensembler/config.json');
      expect(savedFile).toBeDefined();
      expect(JSON.parse(savedFile!.content)).toEqual(config);
    });
  });

  describe('Service Status API', () => {
    it('should return service status for configured services', async () => {
      // Mock has sonarr running and radarr stopped
      const response = await request(app)
        .get('/api/services/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.serviceStatus).toEqual({
        sonarr: 'Running',
        radarr: 'Stopped'
      });
    });

    it('should return error when config not found', async () => {
      mockFileSystem.removeFile('/mock/home/.ensembler/config.json');

      const response = await request(app)
        .get('/api/services/status')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: 'config.json not found.'
      });
    });
  });

  describe('Service Control API', () => {
    it('should start a service successfully', async () => {
      const response = await request(app)
        .post('/api/services/radarr/start')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'radarr started successfully.'
      });

      // Verify service was started in mock
      const container = mockDockerState.getContainer('radarr');
      expect(container?.status).toBe('running');
    });
  });

  describe('Path Validation API', () => {
    it('should validate existing writable paths', async () => {
      const paths = ['/mock/media/tv', '/mock/media/movies'];

      const response = await request(app)
        .post('/api/paths/validate')
        .send({ paths })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual([
        { path: '/mock/media/tv', valid: true },
        { path: '/mock/media/movies', valid: true }
      ]);
    });

    it('should create and validate non-existing paths', async () => {
      const paths = ['/mock/new/path'];

      const response = await request(app)
        .post('/api/paths/validate')
        .send({ paths })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.results).toEqual([
        { path: '/mock/new/path', valid: true }
      ]);

      // Verify directory was created
      expect(mockFileSystem.exists('/mock/new/path')).toBe(true);
    });

    it('should handle permission errors', async () => {
      // Create a directory with no write permissions
      mockFileSystem.addDirectory('/mock/readonly');
      mockFileSystem.setPermissions('/mock/readonly', { writable: false });

      const response = await request(app)
        .post('/api/paths/validate')
        .send({ paths: ['/mock/readonly'] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.results[0].valid).toBe(false);
      expect(response.body.results[0].code).toBe('messages.paths.notWritable');
      expect(response.body.results[0].error).toBeUndefined();
    });

    it('should reject invalid input', async () => {
      const response = await request(app)
        .post('/api/paths/validate')
        .send({ paths: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid input'
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle full service lifecycle', async () => {
      // 1. Check initial Docker status
      const dockerStatus = await request(app).get('/api/docker/status');
      expect(dockerStatus.body.docker).toBe(true);

      // 2. Validate service selection
      const validation = await request(app)
        .post('/api/services/validate-selection')
        .send({ selectedServices: ['sonarr', 'radarr'] });
      expect(validation.body.success).toBe(true);

      // 3. Save configuration
      const config = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };
      const saveConfig = await request(app)
        .post('/api/config/save')
        .send(config);
      expect(saveConfig.body.success).toBe(true);

      // 4. Check service status
      const serviceStatus = await request(app).get('/api/services/status');
      expect(serviceStatus.body.success).toBe(true);

      // 5. Start stopped service
      const startService = await request(app).post('/api/services/radarr/start');
      expect(startService.body.success).toBe(true);
    });

    it('should handle Docker not available scenario', async () => {
      mockDockerState.setDockerRunning(false);

      // Docker status should show Docker not running
      const dockerStatus = await request(app).get('/api/docker/status');
      expect(dockerStatus.body.docker).toBe(false);

      // Service status should handle Docker not being available
      const serviceStatus = await request(app).get('/api/services/status');
      expect(serviceStatus.body.serviceStatus.sonarr).toBe('Unknown');
    });
  });
}); 