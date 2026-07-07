import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Comprehensive mocking setup
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  accessSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, callback: (err: any, stdout: string, stderr: string) => void) => {
    if (cmd.includes('docker ps')) {
      callback(null, 'Up 5 minutes', '');
    } else if (cmd.includes('docker compose version')) {
      callback(null, 'Docker Compose version v2.24.5', '');
    } else if (cmd.includes('docker compose') && cmd.includes('logs')) {
      callback(null, 'Mock log output for service', '');
    } else if (cmd.includes('docker image inspect')) {
      callback(null, '2024-01-01T00:00:00Z', '');
    } else if (cmd.includes('docker compose') && cmd.includes('start')) {
      callback(null, 'Service started successfully', '');
    } else if (cmd.includes('docker compose') && cmd.includes('stop')) {
      callback(null, 'Service stopped successfully', '');
    } else if (cmd.includes('docker compose') && cmd.includes('restart')) {
      callback(null, 'Service restarted successfully', '');
    } else if (cmd.includes('docker compose') && cmd.includes('pull')) {
      callback(null, 'Service updated successfully', '');
    } else {
      callback(null, 'success', '');
    }
  }),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => {
    return jest.fn((cmd: string) => {
      return new Promise((resolve) => {
        if (cmd.includes('docker ps')) {
          resolve({ stdout: 'Up 5 minutes', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('logs')) {
          resolve({ stdout: 'Mock log output for service', stderr: '' });
        } else if (cmd.includes('docker image inspect')) {
          resolve({ stdout: '2024-01-01T00:00:00Z', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('start')) {
          resolve({ stdout: 'Service started successfully', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('stop')) {
          resolve({ stdout: 'Service stopped successfully', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('restart')) {
          resolve({ stdout: 'Service restarted successfully', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('pull')) {
          resolve({ stdout: 'Service updated successfully', stderr: '' });
        } else {
          resolve({ stdout: 'success', stderr: '' });
        }
      });
    });
  }),
}));

jest.mock('node-docker-api', () => ({
  Docker: jest.fn().mockImplementation(() => ({
    container: {
      list: jest.fn().mockResolvedValue([
        { data: { Names: ['/sonarr'], State: 'running' } },
        { data: { Names: ['/radarr'], State: 'exited' } },
      ]),
    },
  })),
}));

// Import the app after mocking
import app from '../index';

describe('Comprehensive Integration Tests', () => {
  const configDir = path.join(os.homedir(), '.media-center');
  const configFile = path.join(configDir, 'config.json');
  const composeFile = path.join(configDir, 'docker-compose.yml');

  const mockConfig = {
    selectedServices: { sonarr: true, radarr: true, plex: true },
    paths: { sonarr: ['/tv'], radarr: ['/movies'], plex: ['/tv', '/movies'] },
    ports: { sonarr: 8989, radarr: 7878, plex: 32400 },
    environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock state - config exists
    (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath === configFile || filePath === composeFile) {
        return true;
      }
      return false;
    });
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
    // clearAllMocks() does not remove implementations set with mockImplementation,
    // so error-path tests would otherwise leak their throwing mocks into later tests
    (fs.writeFileSync as jest.Mock).mockImplementation(() => undefined);
    (fs.unlinkSync as jest.Mock).mockImplementation(() => undefined);
    (fs.accessSync as jest.Mock).mockImplementation(() => undefined);
  });

  describe('Basic Health Check', () => {
    it('should return backend running status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.text).toBe('Backend running');
    });
  });

  describe('Configuration Management', () => {
    describe('GET /api/config/status', () => {
      it('should return setup complete when config exists', async () => {
        const response = await request(app)
          .get('/api/config/status')
          .expect(200);

        expect(response.body).toEqual({ setupComplete: true });
      });

      it('should return setup incomplete when config does not exist', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const response = await request(app)
          .get('/api/config/status')
          .expect(200);

        expect(response.body).toEqual({ setupComplete: false });
      });
    });

    describe('POST /api/config/save', () => {
      it('should save configuration successfully', async () => {
        const response = await request(app)
          .post('/api/config/save')
          .send(mockConfig)
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Configuration saved successfully.'
        });
        expect(fs.writeFileSync).toHaveBeenCalledWith(configFile, JSON.stringify(mockConfig, null, 2));
      });

      it('should handle save errors', async () => {
        (fs.writeFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Write error');
        });

        const response = await request(app)
          .post('/api/config/save')
          .send(mockConfig)
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          message: 'Failed to save configuration.',
          error: 'Write error'
        });
      });
    });

    describe('GET /api/config/current', () => {
      it('should return current configuration', async () => {
        const response = await request(app)
          .get('/api/config/current')
          .expect(200);

        expect(response.body).toEqual(mockConfig);
      });

      it('should handle missing config file', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const response = await request(app)
          .get('/api/config/current')
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          message: 'config.json not found.'
        });
      });
    });

    describe('POST /api/config/generate-compose', () => {
      it('should generate Docker Compose files successfully', async () => {
        const response = await request(app)
          .post('/api/config/generate-compose')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Docker Compose files generated successfully.'
        });
        expect(fs.writeFileSync).toHaveBeenCalledWith(composeFile, expect.stringContaining('services:'));
        expect(fs.writeFileSync).toHaveBeenCalledWith(composeFile, expect.stringContaining('sonarr:'));
      });

      it('should handle generation errors', async () => {
        (fs.readFileSync as jest.Mock).mockImplementation(() => {
          throw new Error('Read error');
        });

        const response = await request(app)
          .post('/api/config/generate-compose')
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          message: 'Failed to generate Docker Compose files.',
          error: 'Read error'
        });
      });
    });

    describe('POST /api/config/reset', () => {
      it('should reset configuration successfully', async () => {
        const response = await request(app)
          .post('/api/config/reset')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'All settings reset successfully.'
        });
        expect(fs.unlinkSync).toHaveBeenCalledWith(configFile);
        expect(fs.unlinkSync).toHaveBeenCalledWith(composeFile);
      });

      it('should handle reset errors gracefully', async () => {
        (fs.unlinkSync as jest.Mock).mockImplementation(() => {
          throw new Error('Delete error');
        });

        const response = await request(app)
          .post('/api/config/reset')
          .expect(500);

        expect(response.body).toEqual({
          success: false,
          message: 'Failed to reset settings.',
          error: 'Delete error'
        });
      });
    });
  });

  describe('Path Validation', () => {
    describe('POST /api/paths/validate', () => {
      beforeEach(() => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.accessSync as jest.Mock).mockReturnValue(undefined);
      });

      it('should validate existing writable paths', async () => {
        const paths = ['/valid/path1', '/valid/path2'];

        const response = await request(app)
          .post('/api/paths/validate')
          .send({ paths })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.results).toEqual([
          { path: '/valid/path1', valid: true },
          { path: '/valid/path2', valid: true }
        ]);
      });

      it('should create non-existing paths', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const response = await request(app)
          .post('/api/paths/validate')
          .send({ paths: ['/new/path'] })
          .expect(200);

        expect(fs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true });
        expect(response.body.success).toBe(true);
      });

      it('should handle permission errors', async () => {
        (fs.accessSync as jest.Mock).mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const response = await request(app)
          .post('/api/paths/validate')
          .send({ paths: ['/readonly/path'] })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.results[0].valid).toBe(false);
        expect(response.body.results[0].error).toBe('Permission denied');
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
  });

  describe('Service Configuration', () => {
    describe('GET /api/services/config', () => {
      it('should return service configuration', async () => {
        const response = await request(app)
          .get('/api/services/config')
          .expect(200);

        expect(response.body.success).toBe(true);
        const { SUPPORTED_SERVICES } = require('../services/serviceConfig');
        expect(response.body.services).toHaveLength(SUPPORTED_SERVICES.length);


        const sonarrService = response.body.services.find((s: any) => s.key === 'sonarr');
        expect(sonarrService).toBeDefined();
        expect(sonarrService.name).toBe('Sonarr');
        expect(sonarrService.defaultPort).toBe(8989);
      });
    });

    describe('POST /api/services/validate-selection', () => {
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

      it('should accept selections with many services (no service limit)', async () => {
        const response = await request(app)
          .post('/api/services/validate-selection')
          .send({
            selectedServices: ['sonarr', 'radarr', 'plex', 'transmission', 'prowlarr', 'overseerr', 'jellyfin']
          })
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'Service selection is valid.'
        });
      });
    });
  });

  describe('Service Management', () => {
    describe('GET /api/services/status', () => {
      it('should return service status', async () => {
        const response = await request(app)
          .get('/api/services/status')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.serviceStatus).toBeDefined();
        expect(response.body.serviceStatus.sonarr).toBeDefined();
        expect(response.body.serviceStatus.radarr).toBeDefined();
        expect(response.body.serviceStatus.plex).toBeDefined();
      });

      it('should handle missing config', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const response = await request(app)
          .get('/api/services/status')
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          message: 'config.json not found.'
        });
      });
    });

    describe('Service Control Endpoints', () => {
      const services = ['sonarr', 'radarr', 'plex'];

      services.forEach(service => {
        describe(`${service} service control`, () => {
          it(`should start ${service} service`, async () => {
            const response = await request(app)
              .post(`/api/services/${service}/start`)
              .expect(200);

            expect(response.body).toEqual({
              success: true,
              message: `${service} started successfully.`
            });
          });

          it(`should stop ${service} service`, async () => {
            const response = await request(app)
              .post(`/api/services/${service}/stop`)
              .expect(200);

            expect(response.body).toEqual({
              success: true,
              message: `${service} stopped successfully.`
            });
          });

          it(`should restart ${service} service`, async () => {
            const response = await request(app)
              .post(`/api/services/${service}/restart`)
              .expect(200);

            expect(response.body).toEqual({
              success: true,
              message: `${service} restarted successfully.`
            });
          });

          it(`should get ${service} version`, async () => {
            const response = await request(app)
              .get(`/api/services/${service}/version`)
              .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.version).toBeDefined();
          });

          it(`should get ${service} logs`, async () => {
            const response = await request(app)
              .get(`/api/services/${service}/logs`)
              .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.logs).toBeDefined();
          });

          it(`should get ${service} launch URL`, async () => {
            const response = await request(app)
              .get(`/api/services/${service}/launch-url`)
              .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.url).toBeDefined();
            expect(response.body.url).toContain('localhost');
          });

          it(`should update ${service} service`, async () => {
            const response = await request(app)
              .post(`/api/services/${service}/update`)
              .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('updated successfully');
          });
        });
      });

      it('should handle invalid service names', async () => {
        const response = await request(app)
          .get('/api/services/invalid-service/version')
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          message: 'Service not found.'
        });
      });
    });

    describe('Global Service Control', () => {
      it('should start all services', async () => {
        const response = await request(app)
          .post('/api/services/start-all')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'All enabled services started successfully.'
        });
      });

      it('should stop all services', async () => {
        const response = await request(app)
          .post('/api/services/stop-all')
          .expect(200);

        expect(response.body).toEqual({
          success: true,
          message: 'All services stopped successfully.'
        });
      });
    });

    describe('Service Updates', () => {
      it('should check for service updates', async () => {
        const response = await request(app)
          .get('/api/services/sonarr/check-updates')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('hasUpdate');
        expect(response.body).toHaveProperty('currentVersion');
      });
    });

    describe('Service Monitoring', () => {
      it('should monitor service health', async () => {
        const response = await request(app)
          .get('/api/services/monitor')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.services).toBeDefined();
      });

      it('should handle missing config for monitoring', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const response = await request(app)
          .get('/api/services/monitor')
          .expect(404);

        expect(response.body).toEqual({
          success: false,
          message: 'config.json not found.'
        });
      });
    });
  });

  describe('Docker Operations', () => {
    describe('GET /api/docker/status', () => {
      it('should return Docker status', async () => {
        const response = await request(app)
          .get('/api/docker/status')
          .expect(200);

        expect(response.body.docker).toBeDefined();
        expect(response.body.compose).toBeDefined();
      });
    });

    describe('GET /api/docker/check-updates', () => {
      it('should check for Docker updates', async () => {
        const response = await request(app)
          .get('/api/docker/check-updates')
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in config file', async () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      const response = await request(app)
        .get('/api/config/current')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get current configuration.');
    });

    it('should handle Docker connection errors', async () => {
      const { Docker } = require('node-docker-api');
      Docker.mockImplementation(() => {
        throw new Error('Docker connection failed');
      });

      const response = await request(app)
        .get('/api/docker/status')
        .expect(200);

      expect(response.body.docker).toBe(false);
      expect(response.body.compose).toBe(false);
    });
  });

  describe('End-to-End Workflows', () => {
    it('should handle complete setup workflow', async () => {
      // 1. Check initial status
      const initialStatus = await request(app).get('/api/config/status');
      expect(initialStatus.body.setupComplete).toBe(true);

      // 2. Validate service selection
      const validation = await request(app)
        .post('/api/services/validate-selection')
        .send({ selectedServices: ['sonarr', 'radarr'] });
      expect(validation.body.success).toBe(true);

      // 3. Validate paths
      const pathValidation = await request(app)
        .post('/api/paths/validate')
        .send({ paths: ['/tv', '/movies'] });
      expect(pathValidation.body.success).toBe(true);

      // 4. Save configuration
      const saveConfig = await request(app)
        .post('/api/config/save')
        .send(mockConfig);
      expect(saveConfig.body.success).toBe(true);

      // 5. Generate Docker Compose files
      const generateCompose = await request(app)
        .post('/api/config/generate-compose');
      expect(generateCompose.body.success).toBe(true);

      // 6. Start services
      const startAll = await request(app)
        .post('/api/services/start-all');
      expect(startAll.body.success).toBe(true);

      // 7. Check service status
      const serviceStatus = await request(app)
        .get('/api/services/status');
      expect(serviceStatus.body.success).toBe(true);
    });

    it('should handle service management workflow', async () => {
      // 1. Check service status
      const status = await request(app).get('/api/services/status');
      expect(status.body.success).toBe(true);

      // 2. Start a specific service
      const startService = await request(app)
        .post('/api/services/sonarr/start');
      expect(startService.body.success).toBe(true);

      // 3. Check service logs
      const logs = await request(app)
        .get('/api/services/sonarr/logs');
      expect(logs.body.success).toBe(true);

      // 4. Get launch URL
      const launchUrl = await request(app)
        .get('/api/services/sonarr/launch-url');
      expect(launchUrl.body.success).toBe(true);

      // 5. Update service
      const updateService = await request(app)
        .post('/api/services/sonarr/update');
      expect(updateService.body.success).toBe(true);

      // 6. Restart service
      const restartService = await request(app)
        .post('/api/services/sonarr/restart');
      expect(restartService.body.success).toBe(true);
    });
  });
}); 