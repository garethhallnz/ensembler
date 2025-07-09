import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Docker } from 'node-docker-api';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('node-docker-api', () => ({
  Docker: jest.fn().mockImplementation(() => ({
    container: {
      list: jest.fn(),
    },
  })),
}));

const app = express();
app.use(express.json());

const configDir = path.join(os.homedir(), '.media-center');
const composeFile = path.join(configDir, 'docker-compose.yml');

app.get('/api/services/status', async (req, res) => {
  try {
    if (!fs.existsSync(composeFile)) {
      return res.status(404).json({ success: false, message: 'docker-compose.yml not found.' });
    }

    const docker = new Docker({});
    const containers = await docker.container.list({ all: true });

    const serviceStatus: { [key: string]: string } = {};
    // In a real scenario, you'd parse docker-compose.yml to get service names
    // and then match them with container names/labels. For this mock, we'll assume
    // service names are directly related to container names.
    const mockServiceNames = ['sonarr', 'radarr', 'plex', 'transmission', 'prowlarr', 'overseerr'];

    mockServiceNames.forEach(serviceName => {
      const container = containers.find((c: any) => c.data && c.data.Names && c.data.Names[0].includes(serviceName));
      if (container && container.data) {
        serviceStatus[serviceName] = (container.data as any).State || 'unknown';
      } else {
        serviceStatus[serviceName] = 'Stopped';
      }
    });

    res.json({ success: true, serviceStatus });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Failed to get service status.', error: errorMessage });
  }
});

describe('GET /api/services/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return service statuses if docker-compose.yml exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (Docker as jest.Mock).mockImplementation(() => ({
      container: {
        list: jest.fn().mockResolvedValue([
          { data: { Names: ['/sonarr'], State: 'running' } },
          { data: { Names: ['/plex'], State: 'exited' } },
        ]),
      },
    }));

    const res = await request(app).get('/api/services/status');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.serviceStatus).toEqual({
      sonarr: 'running',
      radarr: 'Stopped',
      plex: 'exited',
      transmission: 'Stopped',
      prowlarr: 'Stopped',
      overseerr: 'Stopped',
    });
  });

  it('should return 404 if docker-compose.yml does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/services/status');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'docker-compose.yml not found.' });
  });

  it('should handle errors during docker container listing', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (Docker as jest.Mock).mockImplementation(() => ({
      container: {
        list: jest.fn().mockRejectedValue(new Error('Docker error')),
      },
    }));

    const res = await request(app).get('/api/services/status');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Failed to get service status.');
    expect(res.body.error).toBe('Docker error');
  });
});
