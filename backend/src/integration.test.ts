import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd: string, callback: (err: any, stdout: string) => void) => {
    if (cmd.includes('docker ps')) {
      callback(null, 'Up 5 minutes');
    } else if (cmd.includes('docker compose version')) {
      callback(null, 'Docker Compose version v2.23.3');
    } else if (cmd.includes('docker compose') && cmd.includes('logs')) {
      callback(null, 'Mock log output for service');
    } else {
      callback(null, 'success');
    }
  }),
}));

jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn((fn) => {
    return jest.fn((cmd: string) => {
      return new Promise((resolve, reject) => {
        if (cmd.includes('docker ps')) {
          resolve({ stdout: 'Up 5 minutes', stderr: '' });
        } else if (cmd.includes('docker compose') && cmd.includes('logs')) {
          resolve({ stdout: 'Mock log output for service', stderr: '' });
        } else if (cmd.includes('docker image inspect')) {
          resolve({ stdout: '2024-01-01T00:00:00Z', stderr: '' });
        } else {
          resolve({ stdout: 'success', stderr: '' });
        }
      });
    });
  }),
}));

// Import the app after mocking
import app from './index';

describe('Integration Tests - Frontend-Backend Communication', () => {
  const configDir = path.join(os.homedir(), '.ensembler');
  const configFile = path.join(configDir, 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Management', () => {
    it('should handle complete configuration flow', async () => {
      // Mock config doesn't exist initially
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      // Check status - should indicate setup not complete
      const statusRes = await request(app).get('/api/config/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.setupComplete).toBe(false);

      // Save configuration
      const config = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

      const saveRes = await request(app)
        .post('/api/config/save')
        .send(config);
      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);

      // Generate compose files
      const composeRes = await request(app)
        .post('/api/config/generate-compose');
      expect(composeRes.status).toBe(200);
      expect(composeRes.body.success).toBe(true);

      // Check status - should now indicate setup complete
      const statusRes2 = await request(app).get('/api/config/status');
      expect(statusRes2.status).toBe(200);
      expect(statusRes2.body.setupComplete).toBe(true);
    });

    it('should handle configuration retrieval and update', async () => {
      const config = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

      // Get current config
      const getRes = await request(app).get('/api/config/current');
      expect(getRes.status).toBe(200);
      expect(getRes.body.selectedServices).toEqual(config.selectedServices);

      // Update config
      const updatedConfig = {
        ...config,
        ports: { sonarr: 9989, radarr: 8878 }
      };

      const updateRes = await request(app)
        .post('/api/config/save')
        .send(updatedConfig);
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
    });
  });

  describe('Service Management', () => {
    it('should handle service status and control flow', async () => {
      const config = {
        selectedServices: { sonarr: true, radarr: true },
        paths: { sonarr: ['/tv'], radarr: ['/movies'] },
        ports: { sonarr: 8989, radarr: 7878 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

      // Get service status
      const statusRes = await request(app).get('/api/services/status');
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.serviceStatus).toHaveProperty('sonarr');
      expect(statusRes.body.serviceStatus).toHaveProperty('radarr');

      // Start a service
      const startRes = await request(app)
        .post('/api/services/sonarr/start');
      expect(startRes.status).toBe(200);
      expect(startRes.body.success).toBe(true);

      // Stop a service
      const stopRes = await request(app)
        .post('/api/services/sonarr/stop');
      expect(stopRes.status).toBe(200);
      expect(stopRes.body.success).toBe(true);

      // Restart a service
      const restartRes = await request(app)
        .post('/api/services/sonarr/restart');
      expect(restartRes.status).toBe(200);
      expect(restartRes.body.success).toBe(true);
    });

    it('should handle service information retrieval', async () => {
      const config = {
        selectedServices: { sonarr: true },
        paths: { sonarr: ['/tv'] },
        ports: { sonarr: 8989 },
        environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(config));

      // Get service version
      const versionRes = await request(app).get('/api/services/sonarr/version');
      expect(versionRes.status).toBe(200);
      expect(versionRes.body.success).toBe(true);
      expect(versionRes.body.version).toBeDefined();

      // Get service logs
      const logsRes = await request(app).get('/api/services/sonarr/logs');
      expect(logsRes.status).toBe(200);
      expect(logsRes.body.success).toBe(true);
      expect(logsRes.body.logs).toBeDefined();

      // Get launch URL
      const urlRes = await request(app).get('/api/services/sonarr/launch-url');
      expect(urlRes.status).toBe(200);
      expect(urlRes.body.success).toBe(true);
      expect(urlRes.body.url).toBe('http://localhost:8989');
    });
  });

  describe('Docker Operations', () => {
    it('should handle Docker status check', async () => {
      const res = await request(app).get('/api/docker/status');
      expect(res.status).toBe(200);
      expect(res.body.docker).toBeDefined();
      expect(res.body.compose).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const res = await request(app).get('/api/services/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.serviceStatus).toEqual({});
    });

    it('should handle invalid service names', async () => {
      const res = await request(app).get('/api/services/invalid-service/version');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Service not found.');
    });
  });
}); 