import fs from 'fs';
import os from 'os';
import path from 'path';
import { readArrApiKey, tryReadArrApiKey } from '../services/setup/apiKeyReader';
import {
  waitForArrReady,
  ensureRootFolder,
  ensureTransmissionDownloadClient,
  ensureMediaServerNotification,
  setupArrService
} from '../services/setup/arrSetup';
import { ensureApplication, setupProwlarr } from '../services/setup/prowlarrSetup';
import { readPlexToken, ensurePlexLibrary, setupPlex } from '../services/setup/plexSetup';
import { isLibraryCovered, ensureApiKey, setupJellyfin } from '../services/setup/jellyfinSetup';
import { setYamlValue, seedBazarrConfig } from '../services/setup/bazarrSetup';
import { setupConnections, setupPlexConnections } from '../services/setup/orchestrator';
import { UserConfig } from '../services/setup/types';

const jsonResponse = (data: unknown, status = 200, headers: { [key: string]: string } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  json: async () => data,
  text: async () => JSON.stringify(data)
}) as unknown as Response;

// What a real Transmission RPC endpoint answers with
const transmissionRpcResponse = () =>
  jsonResponse({}, 409, { 'x-transmission-session-id': 'mock-session-id' });

describe('Service connection setup', () => {
  let tempDir: string;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensembler-setup-test-'));
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const writeConfigXml = (serviceKey: string, apiKey: string) => {
    const dir = path.join(tempDir, serviceKey, 'config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.xml'),
      `<Config>\n  <ApiKey>${apiKey}</ApiKey>\n  <Port>8989</Port>\n</Config>`
    );
  };

  describe('readArrApiKey', () => {
    it('reads the API key from config.xml', async () => {
      writeConfigXml('sonarr', 'abc123def456');

      const apiKey = await readArrApiKey(tempDir, 'sonarr', 1000, 10);
      expect(apiKey).toBe('abc123def456');
    });

    it('times out when config.xml never appears', async () => {
      await expect(readArrApiKey(tempDir, 'sonarr', 50, 10))
        .rejects.toThrow(/Timed out waiting for API key/);
    });

    it('times out when config.xml has no API key yet', async () => {
      const dir = path.join(tempDir, 'sonarr', 'config');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.xml'), '<Config></Config>');

      await expect(readArrApiKey(tempDir, 'sonarr', 50, 10))
        .rejects.toThrow(/Timed out waiting for API key/);
    });
  });

  describe('tryReadArrApiKey (one-shot, non-polling)', () => {
    it('returns the key immediately when present', () => {
      writeConfigXml('prowlarr', 'prowlarr-key');
      expect(tryReadArrApiKey(tempDir, 'prowlarr')).toBe('prowlarr-key');
    });

    it('returns null immediately when config.xml is absent', () => {
      expect(tryReadArrApiKey(tempDir, 'prowlarr')).toBeNull();
    });
  });

  describe('waitForArrReady', () => {
    it('resolves once the status endpoint answers', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse({ version: '4.0' }));

      await waitForArrReady({ baseUrl: 'http://localhost:8989', apiKey: 'key' }, 1000, 10);

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8989/api/v3/system/status',
        expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'key' }) })
      );
    });

    it('throws when the service never becomes ready', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));

      await expect(
        waitForArrReady({ baseUrl: 'http://localhost:8989', apiKey: 'key' }, 50, 10)
      ).rejects.toThrow(/did not become ready/);
    });
  });

  describe('ensureRootFolder', () => {
    const options = { baseUrl: 'http://localhost:8989', apiKey: 'key' };

    it('creates the root folder when missing', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1, path: '/tv' }));

      const result = await ensureRootFolder(options, '/tv');

      expect(result.created).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8989/api/v3/rootfolder',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ path: '/tv' }) })
      );
    });

    it('does not recreate an existing root folder', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, path: '/tv' }]));

      const result = await ensureRootFolder(options, '/tv');

      expect(result.created).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureTransmissionDownloadClient', () => {
    const options = { baseUrl: 'http://localhost:8989', apiKey: 'key' };

    it('adds Transmission when no client is configured', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      const result = await ensureTransmissionDownloadClient(options, { host: 'transmission', port: 9091 });

      expect(result.created).toBe(true);
      const postCall = fetchMock.mock.calls[1];
      const payload = JSON.parse(postCall[1].body);
      expect(payload.implementation).toBe('Transmission');
      expect(payload.fields).toContainEqual({ name: 'host', value: 'transmission' });
      expect(payload.fields).toContainEqual({ name: 'port', value: 9091 });
      // v3 contract: removal flags present, no categories
      expect(payload.removeCompletedDownloads).toBe(true);
      expect(payload.categories).toBeUndefined();
    });

    it('uses the Prowlarr v1 contract when targeting Prowlarr', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      await ensureTransmissionDownloadClient(
        { baseUrl: 'http://localhost:9696', apiKey: 'key', apiBase: '/api/v1' },
        { host: 'transmission', port: 9091 },
        'prowlarr'
      );

      const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
      // prowlarr contract: categories required, removal flags absent
      expect(payload.categories).toEqual([]);
      expect(payload.removeCompletedDownloads).toBeUndefined();
    });

    it('does not duplicate an existing Transmission client', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, implementation: 'Transmission' }]));

      const result = await ensureTransmissionDownloadClient(options, { host: 'transmission', port: 9091 });

      expect(result.created).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('ensureMediaServerNotification', () => {
    const options = { baseUrl: 'http://localhost:8989', apiKey: 'key' };

    it('adds a Plex notification with the auth token and library-update on', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      const result = await ensureMediaServerNotification(options, {
        kind: 'plex', name: 'Plex', host: 'plex', port: 32400, credential: 'plex-token'
      });

      expect(result.created).toBe(true);
      const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(payload.implementation).toBe('PlexServer');
      expect(payload.configContract).toBe('PlexServerSettings');
      expect(payload.onDownload).toBe(true);
      expect(payload.fields).toContainEqual({ name: 'authToken', value: 'plex-token' });
      expect(payload.fields).toContainEqual({ name: 'updateLibrary', value: true });
    });

    it('adds a Jellyfin notification with the api key via MediaBrowser', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      await ensureMediaServerNotification(options, {
        kind: 'jellyfin', name: 'Jellyfin', host: 'jellyfin', port: 8096, credential: 'jf-key'
      });

      const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(payload.implementation).toBe('MediaBrowser');
      expect(payload.fields).toContainEqual({ name: 'apiKey', value: 'jf-key' });
    });

    it('does not duplicate a notification already pointing at the same host', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([
        { implementation: 'PlexServer', fields: [{ name: 'host', value: 'plex' }] }
      ]));

      const result = await ensureMediaServerNotification(options, {
        kind: 'plex', name: 'Plex', host: 'plex', port: 32400, credential: 'plex-token'
      });

      expect(result.created).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupArrService', () => {
    it('reports a ready failure without attempting further steps', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));

      const results = await setupArrService({
        serviceKey: 'sonarr',
        baseUrl: 'http://localhost:8989',
        apiKey: 'key',
        rootFolder: '/tv',
        readyTimeoutMs: 50
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ service: 'sonarr', step: 'ready', success: false });
    });

    it('continues to the download client step when root folder fails', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}))               // system/status
        .mockResolvedValueOnce(jsonResponse({}, 500))          // GET rootfolder fails
        .mockResolvedValueOnce(jsonResponse([]))               // GET downloadclient
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));       // POST downloadclient

      const results = await setupArrService({
        serviceKey: 'sonarr',
        baseUrl: 'http://localhost:8989',
        apiKey: 'key',
        rootFolder: '/tv',
        transmission: { host: 'transmission', port: 9091 }
      });

      expect(results).toEqual([
        expect.objectContaining({ step: 'root-folder', success: false }),
        expect.objectContaining({ step: 'download-client', success: true })
      ]);
    });
  });

  describe('ensureApplication', () => {
    const options = { baseUrl: 'http://localhost:9696', apiKey: 'prowlarr-key', apiBase: '/api/v1' };

    it('registers Sonarr as a synced application', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse([]))
        .mockResolvedValueOnce(jsonResponse({ id: 1 }));

      const result = await ensureApplication(options, 'http://prowlarr:9696', {
        implementation: 'Sonarr',
        baseUrl: 'http://sonarr:8989',
        apiKey: 'sonarr-key'
      });

      expect(result.created).toBe(true);
      const [url, init] = fetchMock.mock.calls[1];
      expect(url).toBe('http://localhost:9696/api/v1/applications');
      const payload = JSON.parse(init.body);
      expect(payload.implementation).toBe('Sonarr');
      expect(payload.configContract).toBe('SonarrSettings');
      expect(payload.syncLevel).toBe('fullSync');
      expect(payload.fields).toContainEqual({ name: 'prowlarrUrl', value: 'http://prowlarr:9696' });
      expect(payload.fields).toContainEqual({ name: 'baseUrl', value: 'http://sonarr:8989' });
      expect(payload.fields).toContainEqual({ name: 'apiKey', value: 'sonarr-key' });
    });

    it('does not duplicate an existing application', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, implementation: 'Sonarr' }]));

      const result = await ensureApplication(options, 'http://prowlarr:9696', {
        implementation: 'Sonarr',
        baseUrl: 'http://sonarr:8989',
        apiKey: 'sonarr-key'
      });

      expect(result.created).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupProwlarr', () => {
    it('wires applications and the download client', async () => {
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/applications')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        if (url.includes('/downloadclient')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const results = await setupProwlarr({
        baseUrl: 'http://localhost:9696',
        apiKey: 'prowlarr-key',
        prowlarrNetworkUrl: 'http://prowlarr:9696',
        applications: [
          { implementation: 'Sonarr', baseUrl: 'http://sonarr:8989', apiKey: 'sonarr-key' },
          { implementation: 'Radarr', baseUrl: 'http://radarr:7878', apiKey: 'radarr-key' }
        ],
        transmission: { host: 'transmission', port: 9091 }
      });

      expect(results).toEqual([
        expect.objectContaining({ service: 'prowlarr', step: 'app-sonarr', success: true }),
        expect.objectContaining({ service: 'prowlarr', step: 'app-radarr', success: true }),
        expect.objectContaining({ service: 'prowlarr', step: 'download-client', success: true })
      ]);
      // All Prowlarr calls go through /api/v1, never /api/v3
      const urls = fetchMock.mock.calls.map(c => c[0]);
      expect(urls.every((u: string) => u.includes('/api/v1/'))).toBe(true);
    });

    it('reports a ready failure without attempting wiring', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));

      const results = await setupProwlarr({
        baseUrl: 'http://localhost:9696',
        apiKey: 'prowlarr-key',
        prowlarrNetworkUrl: 'http://prowlarr:9696',
        applications: [{ implementation: 'Sonarr', baseUrl: 'http://sonarr:8989', apiKey: 'sonarr-key' }],
        readyTimeoutMs: 50
      });

      expect(results).toEqual([
        expect.objectContaining({ service: 'prowlarr', step: 'ready', success: false })
      ]);
    });
  });

  describe('readPlexToken', () => {
    const writePreferences = (attrs: string) => {
      const dir = path.join(tempDir, 'plex', 'config', 'Library', 'Application Support', 'Plex Media Server');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Preferences.xml'), `<?xml version="1.0"?>\n<Preferences ${attrs}/>`);
    };

    it('returns the token once the user has signed in', () => {
      writePreferences('MachineIdentifier="abc" PlexOnlineToken="plex-token-123"');
      expect(readPlexToken(tempDir)).toBe('plex-token-123');
    });

    it('returns null before sign-in (no token attribute yet)', () => {
      writePreferences('MachineIdentifier="abc"');
      expect(readPlexToken(tempDir)).toBeNull();
    });

    it('returns null when Preferences.xml does not exist', () => {
      expect(readPlexToken(tempDir)).toBeNull();
    });
  });

  describe('ensurePlexLibrary', () => {
    const library = {
      name: 'TV Shows',
      type: 'show' as const,
      location: '/tv',
      agent: 'tv.plex.agents.series',
      scanner: 'Plex TV Series'
    };

    it('creates the library when missing', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ MediaContainer: { Directory: [] } }))
        .mockResolvedValueOnce(jsonResponse({}, 200));

      const result = await ensurePlexLibrary('http://localhost:32400', 'token', library);

      expect(result.created).toBe(true);
      const [url, init] = fetchMock.mock.calls[1];
      expect(init.method).toBe('POST');
      expect(url).toContain('/library/sections?');
      expect(url).toContain('type=show');
      expect(url).toContain('location=%2Ftv');
      expect(url).toContain('agent=tv.plex.agents.series');
      expect(init.headers['X-Plex-Token']).toBe('token');
    });

    it('skips when a library of the same type already covers the path, whatever its name', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({
        MediaContainer: { Directory: [{ type: 'show', title: 'My Telly', Location: [{ path: '/tv' }] }] }
      }));

      const result = await ensurePlexLibrary('http://localhost:32400', 'token', library);

      expect(result.created).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupPlex', () => {
    it('creates both default libraries', async () => {
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/identity')) return jsonResponse({});
        if (url.includes('/library/sections')) {
          return init?.method === 'POST'
            ? jsonResponse({})
            : jsonResponse({ MediaContainer: { Directory: [] } });
        }
        return jsonResponse({}, 404);
      });

      const results = await setupPlex({ baseUrl: 'http://localhost:32400', token: 'token' });

      expect(results).toEqual([
        expect.objectContaining({ service: 'plex', step: 'library-show', success: true }),
        expect.objectContaining({ service: 'plex', step: 'library-movie', success: true })
      ]);
    });

    it('reports a ready failure without attempting library creation', async () => {
      fetchMock.mockRejectedValue(new Error('connection refused'));

      const results = await setupPlex({
        baseUrl: 'http://localhost:32400',
        token: 'token',
        readyTimeoutMs: 50
      });

      expect(results).toEqual([
        expect.objectContaining({ service: 'plex', step: 'ready', success: false })
      ]);
    });
  });

  describe('jellyfin isLibraryCovered', () => {
    const lib = { name: 'TV Shows', collectionType: 'tvshows' as const, path: '/tv' };

    it('matches by collection type and path regardless of name', () => {
      expect(isLibraryCovered([{ CollectionType: 'tvshows', Locations: ['/tv'] }], lib)).toBe(true);
    });

    it('does not match a different type on the same path', () => {
      expect(isLibraryCovered([{ CollectionType: 'movies', Locations: ['/tv'] }], lib)).toBe(false);
    });

    it('does not match the right type on a different path', () => {
      expect(isLibraryCovered([{ CollectionType: 'tvshows', Locations: ['/media/tv'] }], lib)).toBe(false);
    });
  });

  describe('setupJellyfin', () => {
    const credentials = { username: 'admin', password: 'secret123' };

    // Wizard not yet completed, no libraries — fresh install
    const freshServer = () => {
      let configured = false;
      return async (url: string, init?: { method?: string }) => {
        if (url.includes('/System/Info/Public')) {
          return jsonResponse({ StartupWizardCompleted: configured });
        }
        if (url.includes('/Startup/Complete')) {
          configured = true;
          return jsonResponse({}, 204);
        }
        if (url.includes('/Startup/')) return jsonResponse({}, 204);
        if (url.includes('/Users/AuthenticateByName')) return jsonResponse({ AccessToken: 'token-abc' });
        if (url.includes('/Library/VirtualFolders')) {
          return init?.method === 'POST' ? jsonResponse({}, 204) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      };
    };

    it('completes first-run setup and creates both libraries', async () => {
      fetchMock.mockImplementation(freshServer());

      const results = await setupJellyfin({
        baseUrl: 'http://localhost:8096',
        credentials
      });

      expect(results).toContainEqual(expect.objectContaining({ step: 'account', success: true }));
      expect(results).toContainEqual(expect.objectContaining({ step: 'library-tvshows', success: true }));
      expect(results).toContainEqual(expect.objectContaining({ step: 'library-movies', success: true }));

      // The admin account is created with exactly the supplied credentials
      const userCall = fetchMock.mock.calls.find(
        c => c[0].includes('/Startup/User') && c[1]?.method === 'POST'
      );
      expect(JSON.parse(userCall[1].body)).toEqual({ Name: 'admin', Password: 'secret123' });
    });

    it('skips account creation when Jellyfin is already configured', async () => {
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: true });
        if (url.includes('/Users/AuthenticateByName')) return jsonResponse({ AccessToken: 'token-abc' });
        if (url.includes('/Library/VirtualFolders')) {
          return init?.method === 'POST' ? jsonResponse({}, 204) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const results = await setupJellyfin({ baseUrl: 'http://localhost:8096', credentials });

      expect(results.find(r => r.step === 'account')).toBeUndefined();
      expect(fetchMock.mock.calls.some(c => c[0].includes('/Startup/'))).toBe(false);
      expect(results).toContainEqual(expect.objectContaining({ step: 'library-tvshows', success: true }));
    });

    it('does not recreate libraries that already cover the paths', async () => {
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: true });
        if (url.includes('/Users/AuthenticateByName')) return jsonResponse({ AccessToken: 'token-abc' });
        if (url.includes('/Library/VirtualFolders')) {
          if (init?.method === 'POST') throw new Error('should not create');
          return jsonResponse([
            { CollectionType: 'tvshows', Locations: ['/tv'] },
            { CollectionType: 'movies', Locations: ['/movies'] }
          ]);
        }
        return jsonResponse({}, 404);
      });

      const results = await setupJellyfin({ baseUrl: 'http://localhost:8096', credentials });
      expect(results.filter(r => r.step.startsWith('library')).every(r => r.success)).toBe(true);
      expect(fetchMock.mock.calls.filter(c => c[0].includes('/Library/VirtualFolders') && c[1]?.method === 'POST')).toHaveLength(0);
    });

    it('reports a pending step when no credentials are supplied', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: false });
        return jsonResponse({}, 404);
      });

      const results = await setupJellyfin({ baseUrl: 'http://localhost:8096' });
      expect(results).toEqual([
        expect.objectContaining({ service: 'jellyfin', step: 'sign-in', success: false })
      ]);
    });

    it('mints an API key and registers notifications for arr targets', async () => {
      let keyCreated = false;
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: true });
        if (url.includes('/Users/AuthenticateByName')) return jsonResponse({ AccessToken: 'tok' });
        if (url.includes('/Library/VirtualFolders')) {
          return init?.method === 'POST' ? jsonResponse({}, 204) : jsonResponse([]);
        }
        if (url.includes('/Auth/Keys')) {
          if (init?.method === 'POST') { keyCreated = true; return jsonResponse({}, 204); }
          return jsonResponse({ Items: keyCreated ? [{ AccessToken: 'jf-api-key', AppName: 'Ensembler' }] : [] });
        }
        // arr endpoints
        if (url.includes('/notification')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const results = await setupJellyfin({
        baseUrl: 'http://localhost:8096',
        credentials,
        arrTargets: [{ service: 'sonarr', baseUrl: 'http://localhost:8989', apiKey: 'sonarr-key' }],
        networkHost: { host: 'jellyfin', port: 8096 }
      });

      expect(results).toContainEqual(expect.objectContaining({ step: 'notify-sonarr', success: true }));
      // The notification carries the minted key, not the admin password
      const notifPost = fetchMock.mock.calls.find(c => c[0].includes('/notification') && c[1]?.method === 'POST');
      const payload = JSON.parse(notifPost[1].body);
      expect(payload.fields).toContainEqual({ name: 'apiKey', value: 'jf-api-key' });
    });
  });

  describe('ensureApiKey', () => {
    it('reuses an existing Ensembler key', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ Items: [{ AccessToken: 'existing', AppName: 'Ensembler' }] }));
      const key = await ensureApiKey('http://localhost:8096', 'tok');
      expect(key).toBe('existing');
      expect(fetchMock).toHaveBeenCalledTimes(1); // no POST needed
    });

    it('mints a new key when none exists', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ Items: [] }))
        .mockResolvedValueOnce(jsonResponse({}, 204))
        .mockResolvedValueOnce(jsonResponse({ Items: [{ AccessToken: 'fresh', AppName: 'Ensembler' }] }));
      const key = await ensureApiKey('http://localhost:8096', 'tok');
      expect(key).toBe('fresh');
    });
  });

  describe('bazarr setYamlValue', () => {
    // Mirrors Bazarr's config: repeated keys (apikey) across sections
    const sample = () => [
      'general:',
      '  use_sonarr: false',
      '  use_radarr: false',
      'plex:',
      "  apikey: ''",
      '  ip: 127.0.0.1',
      'sonarr:',
      "  apikey: ''",
      '  ip: 127.0.0.1',
      '  port: 8989',
      'radarr:',
      "  apikey: ''",
      '  ip: 127.0.0.1'
    ];

    it('updates a key only within the named section', () => {
      const lines = sample();
      const changed = setYamlValue(lines, 'sonarr', 'apikey', "'abc'");
      expect(changed).toBe(true);
      // plex apikey (same key name, earlier section) is untouched
      expect(lines[4]).toBe("  apikey: ''");
      expect(lines[7]).toBe("  apikey: 'abc'");
    });

    it('updates the general use flag', () => {
      const lines = sample();
      setYamlValue(lines, 'general', 'use_sonarr', 'true');
      expect(lines[1]).toBe('  use_sonarr: true');
    });

    it('returns false when the value is already set', () => {
      const lines = sample();
      expect(setYamlValue(lines, 'sonarr', 'ip', '127.0.0.1')).toBe(false);
    });
  });

  describe('seedBazarrConfig', () => {
    const writeBazarrConfig = (content: string) => {
      const dir = path.join(tempDir, 'bazarr', 'config', 'config');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'config.yaml'), content);
    };
    const readBazarrConfig = () =>
      fs.readFileSync(path.join(tempDir, 'bazarr', 'config', 'config', 'config.yaml'), 'utf-8');

    const baseConfig = [
      'general:',
      '  use_sonarr: false',
      '  use_radarr: false',
      'sonarr:',
      "  apikey: ''",
      '  ip: 127.0.0.1',
      '  port: 8989',
      'radarr:',
      "  apikey: ''",
      '  ip: 127.0.0.1',
      '  port: 7878',
      ''
    ].join('\n');

    it('seeds Sonarr and Radarr connections and flags a restart', () => {
      writeBazarrConfig(baseConfig);
      const result = seedBazarrConfig(tempDir, [
        { service: 'sonarr', host: 'sonarr', port: 8989, apiKey: 'sk' },
        { service: 'radarr', host: 'radarr', port: 7878, apiKey: 'rk' }
      ]);

      expect(result.success).toBe(true);
      expect(result.needsRestart).toBe(true);
      const out = readBazarrConfig();
      expect(out).toContain("ip: 'sonarr'");
      expect(out).toContain("apikey: 'sk'");
      expect(out).toContain("ip: 'radarr'");
      expect(out).toContain("apikey: 'rk'");
      expect(out).toContain('use_sonarr: true');
      expect(out).toContain('use_radarr: true');
    });

    it('is idempotent — no restart when already seeded', () => {
      writeBazarrConfig(baseConfig);
      const conns = [{ service: 'sonarr', host: 'sonarr', port: 8989, apiKey: 'sk' }];
      seedBazarrConfig(tempDir, conns);
      const second = seedBazarrConfig(tempDir, conns);
      expect(second.needsRestart).toBe(false);
      expect(second.message).toContain('already connected');
    });

    it('fails gracefully when the config file is missing', () => {
      const result = seedBazarrConfig(tempDir, [{ service: 'sonarr', host: 'sonarr', port: 8989, apiKey: 'sk' }]);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('setupConnections', () => {
    const config: UserConfig = {
      selectedServices: { sonarr: true, transmission: true },
      paths: { sonarr: ['/host/tv'], transmission: ['/host/downloads'] },
      ports: { sonarr: 8989, transmission: 9091 },
      environment: { tz: 'UTC', puid: 1000, pgid: 1000 }
    };

    it('wires enabled services together', async () => {
      writeConfigXml('sonarr', 'sonarr-key');

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/transmission/rpc')) return transmissionRpcResponse();
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder')) {
          return url.endsWith('/rootfolder') && fetchMock.mock.calls.some(c => c[1]?.method === 'POST')
            ? jsonResponse({ id: 1 })
            : jsonResponse([]);
        }
        if (url.includes('/downloadclient')) return jsonResponse([]);
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(config, tempDir, { keyTimeoutMs: 100, readyTimeoutMs: 100 });

      const steps = result.results.map(r => `${r.service}:${r.step}:${r.success}`);
      expect(steps).toContain('transmission:ready:true');
      expect(steps).toContain('sonarr:root-folder:true');
      expect(steps).toContain('sonarr:download-client:true');
      expect(result.success).toBe(true);
    });

    it('retries until Transmission comes up instead of failing on the first attempt', async () => {
      writeConfigXml('sonarr', 'sonarr-key');

      let transmissionAttempts = 0;
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/transmission/rpc')) {
          transmissionAttempts += 1;
          // Simulate the container port not listening yet on the first attempts
          if (transmissionAttempts < 3) throw new Error('connection refused');
          return jsonResponse({}, 401);
        }
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder')) return jsonResponse([]);
        if (url.includes('/downloadclient')) return jsonResponse([]);
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(config, tempDir, { keyTimeoutMs: 100, readyTimeoutMs: 10000 });

      expect(transmissionAttempts).toBeGreaterThanOrEqual(3);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'transmission', step: 'ready', success: true })
      );
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'sonarr', step: 'download-client', success: true })
      );
    }, 15000);

    it('rejects a port squatter that is not really Transmission', async () => {
      writeConfigXml('sonarr', 'sonarr-key');

      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        // Something else (e.g. a reverse proxy) answers on Transmission's port
        // with plain HTTP and no Transmission session header
        if (url.includes('/transmission/rpc')) return jsonResponse('not found', 404);
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(config, tempDir, { keyTimeoutMs: 100, readyTimeoutMs: 100 });

      expect(result.success).toBe(false);
      const transmissionResult = result.results.find(r => r.service === 'transmission');
      expect(transmissionResult).toMatchObject({ step: 'ready', success: false });
      expect(transmissionResult!.message).toContain('does not appear to be Transmission');
      // No download client should be wired against the impostor
      expect(result.results.find(r => r.step === 'download-client')).toBeUndefined();
    });

    it('warns about unreachable Transmission but still configures Sonarr', async () => {
      writeConfigXml('sonarr', 'sonarr-key');

      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/transmission/rpc')) throw new Error('connection refused');
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder')) return jsonResponse([]);
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(config, tempDir, { keyTimeoutMs: 100, readyTimeoutMs: 100 });

      expect(result.success).toBe(false);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'transmission', step: 'ready', success: false })
      );
      // Sonarr is still configured; no download client step since Transmission was unreachable
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'sonarr', step: 'root-folder', success: true })
      );
      expect(result.results.find(r => r.service === 'sonarr' && r.step === 'download-client')).toBeUndefined();
    });

    it('reports a missing API key without blocking other services', async () => {
      // No config.xml written for sonarr
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/transmission/rpc')) return transmissionRpcResponse();
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(config, tempDir, { keyTimeoutMs: 50, readyTimeoutMs: 50 });

      expect(result.success).toBe(false);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'sonarr', step: 'api-key', success: false })
      );
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'transmission', step: 'ready', success: true })
      );
    });

    it('wires Prowlarr to the arrs using their API keys and network addresses', async () => {
      writeConfigXml('sonarr', 'sonarr-key');
      writeConfigXml('prowlarr', 'prowlarr-key');

      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/transmission/rpc')) return transmissionRpcResponse();
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder') || url.includes('/applications') || url.includes('/downloadclient')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(
        {
          ...config,
          selectedServices: { sonarr: true, transmission: true, prowlarr: true },
          ports: { sonarr: 8989, transmission: 9091, prowlarr: 9696 }
        },
        tempDir,
        { keyTimeoutMs: 100, readyTimeoutMs: 100 }
      );

      expect(result.success).toBe(true);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'prowlarr', step: 'app-sonarr', success: true })
      );
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'prowlarr', step: 'download-client', success: true })
      );
      // Radarr is not enabled, so Prowlarr must not register it
      expect(result.results.find(r => r.step === 'app-radarr')).toBeUndefined();

      // The application registration must hand Prowlarr the arr's key and
      // its address on the container network
      const appPost = fetchMock.mock.calls.find(
        c => c[0].includes('/api/v1/applications') && c[1]?.method === 'POST'
      );
      const payload = JSON.parse(appPost[1].body);
      expect(payload.fields).toContainEqual({ name: 'baseUrl', value: 'http://sonarr:8989' });
      expect(payload.fields).toContainEqual({ name: 'apiKey', value: 'sonarr-key' });
      expect(payload.fields).toContainEqual({ name: 'prowlarrUrl', value: 'http://prowlarr:9696' });
    });

    it('skips Prowlarr wiring when its API key cannot be read', async () => {
      writeConfigXml('sonarr', 'sonarr-key');
      // No prowlarr config.xml

      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/transmission/rpc')) return transmissionRpcResponse();
        if (url.includes('/system/status')) return jsonResponse({});
        if (url.includes('/rootfolder') || url.includes('/downloadclient')) {
          return init?.method === 'POST' ? jsonResponse({ id: 1 }) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(
        {
          ...config,
          selectedServices: { sonarr: true, transmission: true, prowlarr: true },
          ports: { sonarr: 8989, transmission: 9091, prowlarr: 9696 }
        },
        tempDir,
        { keyTimeoutMs: 50, readyTimeoutMs: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'prowlarr', step: 'api-key', success: false })
      );
      // Sonarr wiring still completes
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'sonarr', step: 'download-client', success: true })
      );
    });

    it('reports Plex sign-in as pending when no token exists yet', async () => {
      const result = await setupConnections(
        { ...config, selectedServices: { plex: true } },
        tempDir,
        { keyTimeoutMs: 50, readyTimeoutMs: 50 }
      );

      expect(result.success).toBe(false);
      expect(result.results).toEqual([
        expect.objectContaining({ service: 'plex', step: 'sign-in', success: false })
      ]);
      expect(result.results[0].message).toContain('one-time sign-in');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('creates Plex libraries once the sign-in token exists', async () => {
      const dir = path.join(tempDir, 'plex', 'config', 'Library', 'Application Support', 'Plex Media Server');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Preferences.xml'), '<Preferences PlexOnlineToken="plex-token"/>');

      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/identity')) return jsonResponse({});
        if (url.includes('/library/sections')) {
          return init?.method === 'POST'
            ? jsonResponse({})
            : jsonResponse({ MediaContainer: { Directory: [] } });
        }
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(
        { ...config, selectedServices: { plex: true }, ports: { plex: 32400 } },
        tempDir,
        { keyTimeoutMs: 50, readyTimeoutMs: 100 }
      );

      expect(result.success).toBe(true);
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'plex', step: 'library-show', success: true })
      );
      expect(result.results).toContainEqual(
        expect.objectContaining({ service: 'plex', step: 'library-movie', success: true })
      );
    });

    it('setupPlexConnections runs only Plex, not other services', async () => {
      const dir = path.join(tempDir, 'plex', 'config', 'Library', 'Application Support', 'Plex Media Server');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'Preferences.xml'), '<Preferences PlexOnlineToken="plex-token"/>');

      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/identity')) return jsonResponse({});
        if (url.includes('/library/sections')) {
          return init?.method === 'POST' ? jsonResponse({}) : jsonResponse({ MediaContainer: { Directory: [] } });
        }
        return jsonResponse({}, 404);
      });

      const result = await setupPlexConnections(
        {
          ...config,
          selectedServices: { sonarr: true, transmission: true, plex: true },
          ports: { plex: 32400 }
        },
        tempDir,
        { readyTimeoutMs: 100 }
      );

      expect(result.success).toBe(true);
      // Only Plex steps — no transmission/sonarr wiring despite being enabled
      expect(result.results.every(r => r.service === 'plex')).toBe(true);
      const calledUrls = fetchMock.mock.calls.map(c => c[0]);
      expect(calledUrls.some((u: string) => u.includes('/transmission/'))).toBe(false);
      expect(calledUrls.some((u: string) => u.includes(':8989'))).toBe(false);
    });

    it('sets up Jellyfin using transiently-passed credentials', async () => {
      let configured = false;
      fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: configured });
        if (url.includes('/Startup/Complete')) { configured = true; return jsonResponse({}, 204); }
        if (url.includes('/Startup/')) return jsonResponse({}, 204);
        if (url.includes('/Users/AuthenticateByName')) return jsonResponse({ AccessToken: 'tok' });
        if (url.includes('/Library/VirtualFolders')) {
          return init?.method === 'POST' ? jsonResponse({}, 204) : jsonResponse([]);
        }
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(
        { ...config, selectedServices: { jellyfin: true }, ports: { jellyfin: 8096 } },
        tempDir,
        { readyTimeoutMs: 100 },
        { jellyfin: { username: 'admin', password: 'pw12' } }
      );

      expect(result.success).toBe(true);
      expect(result.results).toContainEqual(expect.objectContaining({ service: 'jellyfin', step: 'account', success: true }));
      expect(result.results).toContainEqual(expect.objectContaining({ service: 'jellyfin', step: 'library-movies', success: true }));
    });

    it('reports Jellyfin pending when enabled but no credentials passed', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/System/Info/Public')) return jsonResponse({ StartupWizardCompleted: false });
        return jsonResponse({}, 404);
      });

      const result = await setupConnections(
        { ...config, selectedServices: { jellyfin: true }, ports: { jellyfin: 8096 } },
        tempDir,
        { readyTimeoutMs: 100 }
      );

      expect(result.success).toBe(false);
      expect(result.results).toContainEqual(expect.objectContaining({ service: 'jellyfin', step: 'sign-in', success: false }));
    });

    it('does nothing when no automatable services are enabled', async () => {
      const result = await setupConnections(
        { ...config, selectedServices: { jackett: true } },
        tempDir
      );

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
