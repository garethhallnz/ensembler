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
  readFileSync: jest.fn(),
}));

const app = express();
app.use(express.json());

const configDir = path.join(os.homedir(), '.media-center');
const configFile = path.join(configDir, 'config.json');
const envFile = path.join(configDir, '.env');
const composeFile = path.join(configDir, 'docker-compose.yml');

interface ServiceConfig {
  image: string;
  ports: string[];
  volumes: string[];
}

interface ServiceConfigs {
  [key: string]: ServiceConfig;
}

app.post('/api/config/generate-compose', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

    const envVars = {
      TZ: config.environment.tz || 'UTC',
      PUID: config.environment.puid || 1000,
      PGID: config.environment.pgid || 1000,
    };

    let envContent = `TZ=${envVars.TZ}\nPUID=${envVars.PUID}\nPGID=${envVars.PGID}\n`;
    fs.writeFileSync(envFile, envContent);

    let composeServices = '';
    Object.keys(config.selectedServices).forEach(serviceKey => {
      if (config.selectedServices[serviceKey]) {
        const serviceConfig: ServiceConfigs = {
          sonarr: {
            image: 'lscr.io/linuxserver/sonarr',
            ports: [`${config.ports.sonarr || 8989}:8989`],
            volumes: [
              `${config.paths.sonarr?.[0] || '/tv'}:/tv`,
              `${configDir}/sonarr/config:/config`,
            ],
          },
          radarr: {
            image: 'lscr.io/linuxserver/radarr',
            ports: [`${config.ports.radarr || 7878}:7878`],
            volumes: [
              `${config.paths.radarr?.[0] || '/movies'}:/movies`,
              `${configDir}/radarr/config:/config`,
            ],
          },
          plex: {
            image: 'lscr.io/linuxserver/plex',
            ports: [`${config.ports.plex || 32400}:32400`],
            volumes: [
              `${config.paths.plex?.[0] || '/tv'}:/tv`,
              `${config.paths.plex?.[1] || '/movies'}:/movies`,
              `${configDir}/plex/config:/config`,
            ],
          },
          transmission: {
            image: 'lscr.io/linuxserver/transmission',
            ports: [`${config.ports.transmission || 9091}:9091`],
            volumes: [
              `${config.paths.transmission?.[0] || '/downloads'}:/downloads`,
              `${configDir}/transmission/config:/config`,
            ],
          },
          prowlarr: {
            image: 'lscr.io/linuxserver/prowlarr',
            ports: [`${config.ports.prowlarr || 9696}:9696`],
            volumes: [
              `${configDir}/prowlarr/config:/config`,
            ],
          },
          overseerr: {
            image: 'sctx/overseerr',
            ports: [`${config.ports.overseerr || 5055}:5055`],
            volumes: [
              `${configDir}/overseerr/config:/config`,
            ],
          },
        };

        const currentServiceConfig = serviceConfig[serviceKey];
        if (currentServiceConfig) {
          composeServices += `  ${serviceKey}:\n`;
          composeServices += `    image: ${currentServiceConfig.image}\n`;
          composeServices += `    container_name: ${serviceKey}\n`;
          composeServices += `    environment:\n`;
          composeServices += `      - PUID=\${PUID}\n`;
          composeServices += `      - PGID=\${PGID}\n`;
          composeServices += `      - TZ=\${TZ}\n`;
          composeServices += `    volumes:\n`;
          currentServiceConfig.volumes.forEach((volume: string) => {
            composeServices += `      - ${volume}\n`;
          });
          composeServices += `    ports:\n`;
          currentServiceConfig.ports.forEach((port: string) => {
            composeServices += `      - ${port}\n`;
          });
          composeServices += `    restart: unless-stopped\n\n`;
        }
      }
    });

    const composeContent = `version: '3.8'\n\nservices:\n${composeServices}`;
    fs.writeFileSync(composeFile, composeContent);

    res.json({ success: true, message: 'Docker Compose files generated successfully.' });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, message: 'Failed to generate Docker Compose files.', error: errorMessage });
  }
});

describe('POST /api/config/generate-compose', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should generate .env and docker-compose.yml files', async () => {
    const mockConfig = {
      selectedServices: { sonarr: true, plex: true },
      paths: { sonarr: ['/data/tv'], plex: ['/data/tv', '/data/movies'] },
      ports: { sonarr: 8989, plex: 32400 },
      environment: { tz: 'America/New_York', puid: 1000, pgid: 1000 },
    };
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    const res = await request(app).post('/api/config/generate-compose');

    expect(fs.writeFileSync).toHaveBeenNthCalledWith(1,
      envFile,
      'TZ=America/New_York\nPUID=1000\nPGID=1000\n'
    );

    const expectedComposeContent = `version: '3.8'\n\nservices:\n  sonarr:\n    image: lscr.io/linuxserver/sonarr\n    container_name: sonarr\n    environment:\n      - PUID=\${PUID}\n      - PGID=\${PGID}\n      - TZ=\${TZ}\n    volumes:\n      - /data/tv:/tv\n      - ${configDir}/sonarr/config:/config\n    ports:\n      - 8989:8989\n    restart: unless-stopped\n\n  plex:\n    image: lscr.io/linuxserver/plex\n    container_name: plex\n    environment:\n      - PUID=\${PUID}\n      - PGID=\${PGID}\n      - TZ=\${TZ}\n    volumes:\n      - /data/tv:/tv\n      - /data/movies:/movies\n      - ${configDir}/plex/config:/config\n    ports:\n      - 32400:32400\n    restart: unless-stopped\n\n`;

    expect(fs.writeFileSync).toHaveBeenNthCalledWith(2, composeFile, expectedComposeContent);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Docker Compose files generated successfully.' });
  });

  it('should handle errors during file generation', async () => {
    (fs.readFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Read error');
    });

    const res = await request(app).post('/api/config/generate-compose');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Failed to generate Docker Compose files.', error: 'Read error' });
  });
});
