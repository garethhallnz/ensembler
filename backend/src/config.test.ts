
import request from 'supertest';
import express from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Mock fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

const app = express();
app.use(express.json());

const configDir = path.join(os.homedir(), '.ensembler');
const configFile = path.join(configDir, 'config.json');

app.get('/api/config/status', (req, res) => {
  if (fs.existsSync(configFile)) {
    res.json({ setupComplete: true });
  } else {
    res.json({ setupComplete: false });
  }
});

describe('GET /api/config/status', () => {
  it('should return setupComplete: true if config.json exists', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const res = await request(app).get('/api/config/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ setupComplete: true });
  });

  it('should return setupComplete: false if config.json does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const res = await request(app).get('/api/config/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ setupComplete: false });
  });
});
