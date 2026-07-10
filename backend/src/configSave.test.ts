import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

const app = express();
app.use(express.json());

const configDir = path.join(os.homedir(), '.ensembler');
const configFile = path.join(configDir, 'config.json');

app.post('/api/config/save', (req, res) => {
  const config = req.body;
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    res.json({ success: true, message: 'Configuration saved successfully.' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Failed to save configuration.', error: errorMessage });
  }
});

describe('POST /api/config/save', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save the configuration to config.json', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const configData = { services: ['sonarr'], paths: { sonarr: ['/data/tv'] } };
    const res = await request(app).post('/api/config/save').send(configData);
    expect(fs.mkdirSync).toHaveBeenCalledWith(configDir, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(configFile, JSON.stringify(configData, null, 2));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Configuration saved successfully.' });
  });

  it('should return an error if saving fails', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Write error');
    });
    const configData = { services: ['sonarr'] };
    const res = await request(app).post('/api/config/save').send(configData);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Failed to save configuration.', error: 'Write error' });
  });
});
