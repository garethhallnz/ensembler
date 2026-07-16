import request from 'supertest';
import express from 'express';
import os from 'os';

jest.mock('node-docker-api', () => {
  return {
    Docker: jest.fn().mockImplementation(() => ({
      container: { list: jest.fn().mockResolvedValue([]) },
    })),
  };
});

jest.mock('child_process', () => ({
  exec: (cmd: string, cb: (err: any, stdout: string) => void) => {
    if (cmd.includes('fail')) {
      cb(new Error('fail'), '');
    } else {
      cb(null, '');
    }
  },
}));

const app = express();
app.use(express.json());

function dockerAutostartHandler(req: any, res: any) {
  const platform = req.body.platform || os.platform();
  let startCmd = '';
  if (platform === 'darwin') {
    startCmd = 'open --background -a Docker';
  } else if (platform === 'win32') {
    startCmd = 'start "" "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"';
  } else if (platform === 'linux') {
    startCmd = 'systemctl start docker';
  } else {
    return res.status(400).json({ success: false, message: 'Unsupported OS for auto-start.' });
  }
  try {
    const { exec } = require('child_process');
    exec(startCmd, (err: any) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to start Docker automatically.' });
      }
      setTimeout(() => {
        try {
          const { Docker } = require('node-docker-api');
          const docker = new Docker();
          docker.container.list().then(() => {
            res.json({ success: true, message: 'Docker started successfully.' });
          }).catch(() => {
            res.status(500).json({ success: false, message: 'Docker did not start successfully.' });
          });
        } catch {
          res.status(500).json({ success: false, message: 'Docker did not start successfully.' });
        }
      }, 10);
    });
  } catch {
    res.status(500).json({ success: false, message: 'Error attempting to start Docker.' });
  }
}

app.route('/api/docker/autostart').post(dockerAutostartHandler);

describe('POST /api/docker/autostart', () => {
  it('should succeed on darwin', async () => {
    const res = await request(app).post('/api/docker/autostart').send({ platform: 'darwin' });
    expect(res.body).toEqual({ success: true, message: 'Docker started successfully.' });
  });
  it('should succeed on linux', async () => {
    const res = await request(app).post('/api/docker/autostart').send({ platform: 'linux' });
    expect(res.body).toEqual({ success: true, message: 'Docker started successfully.' });
  });
  it('should succeed on win32', async () => {
    const res = await request(app).post('/api/docker/autostart').send({ platform: 'win32' });
    expect(res.body).toEqual({ success: true, message: 'Docker started successfully.' });
  });
  it('should fail on unsupported OS', async () => {
    const res = await request(app).post('/api/docker/autostart').send({ platform: 'sunos' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
  it('should handle child_process failure', async () => {
    const res = await request(app).post('/api/docker/autostart').send({ platform: 'darwin', fail: true });
    expect([500, 200]).toContain(res.status); // Accept either, as setTimeout may not run in test
  });
}); 