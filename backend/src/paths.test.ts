import request from 'supertest';
import express from 'express';
import fs from 'fs';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  accessSync: jest.fn(),
}));

const app = express();
app.use(express.json());

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

  if (results.some(r => !r.valid)) {
    res.status(400).json({ success: false, results });
  } else {
    res.json({ success: true, results });
  }
});

describe('POST /api/paths/validate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return success if all paths are valid', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.accessSync as jest.Mock).mockReturnThis();
    const res = await request(app).post('/api/paths/validate').send({ paths: ['/valid/path'] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should create directory if it does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.accessSync as jest.Mock).mockReturnThis();
    const res = await request(app).post('/api/paths/validate').send({ paths: ['/new/path'] });
    expect(fs.mkdirSync).toHaveBeenCalledWith('/new/path', { recursive: true });
    expect(res.status).toBe(200);
  });

  it('should return a localizable code (not raw fs text) if path is not writable', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.accessSync as jest.Mock).mockImplementation(() => { throw new Error('Permission denied'); });
    const res = await request(app).post('/api/paths/validate').send({ paths: ['/invalid/path'] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.results[0].code).toBe('messages.paths.notWritable');
    expect(res.body.results[0].error).toBeUndefined();
  });
});
