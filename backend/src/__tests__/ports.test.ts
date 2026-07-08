import net from 'net';
import { isPortFree, findPortConflicts, parseContainerPorts } from '../services/ports';

// Bind a real socket so the availability check has something to collide with
const listeners: net.Server[] = [];
const occupy = (port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      listeners.push(server);
      resolve();
    });
  });

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      server.close(() => resolve(port));
    });
  });

afterEach(() => {
  while (listeners.length) {
    listeners.pop()!.close();
  }
});

describe('isPortFree', () => {
  it('reports an occupied port as not free', async () => {
    const port = await freePort();
    await occupy(port);
    expect(await isPortFree(port)).toBe(false);
  });

  it('reports an unbound port as free', async () => {
    const port = await freePort();
    expect(await isPortFree(port)).toBe(true);
  });
});

describe('findPortConflicts', () => {
  it('returns no conflicts when all ports are free', async () => {
    const p1 = await freePort();
    const p2 = await freePort();
    const conflicts = await findPortConflicts([
      { service: 'sonarr', port: p1 },
      { service: 'radarr', port: p2 }
    ]);
    expect(conflicts).toEqual([]);
  });

  it('flags an occupied port and suggests a free one', async () => {
    const taken = await freePort();
    await occupy(taken);
    const conflicts = await findPortConflicts([{ service: 'transmission', port: taken }]);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].service).toBe('transmission');
    expect(conflicts[0].port).toBe(taken);
    expect(conflicts[0].suggestion).not.toBeNull();
    expect(conflicts[0].suggestion).toBeGreaterThan(taken);
    expect(await isPortFree(conflicts[0].suggestion!)).toBe(true);
  });

  it('does not flag a port held by Dockarr\'s own container for that service', async () => {
    const taken = await freePort();
    await occupy(taken);
    const ownPorts = new Map<number, string>([[taken, 'sonarr']]);

    const conflicts = await findPortConflicts([{ service: 'sonarr', port: taken }], ownPorts);
    expect(conflicts).toEqual([]);
  });

  it('still flags a port held by a different container', async () => {
    const taken = await freePort();
    await occupy(taken);
    const ownPorts = new Map<number, string>([[taken, 'radarr']]);

    const conflicts = await findPortConflicts([{ service: 'sonarr', port: taken }], ownPorts);
    expect(conflicts).toHaveLength(1);
  });

  it('never suggests a port already claimed by another selected service', async () => {
    const taken = await freePort();
    await occupy(taken);
    // The very next port is reserved by another selected service
    const conflicts = await findPortConflicts([
      { service: 'a', port: taken },
      { service: 'b', port: taken + 1 }
    ]);
    const aConflict = conflicts.find(c => c.service === 'a');
    expect(aConflict?.suggestion).not.toBe(taken + 1);
  });
});

describe('parseContainerPorts', () => {
  it('maps published host ports to container names', () => {
    const output = [
      'sonarr\t0.0.0.0:8989->8989/tcp, :::8989->8989/tcp',
      'transmission\t127.0.0.1:9091->9091/tcp',
      'plex\t1900/udp, 0.0.0.0:32400->32400/tcp'
    ].join('\n');

    const map = parseContainerPorts(output);
    expect(map.get(8989)).toBe('sonarr');
    expect(map.get(9091)).toBe('transmission');
    expect(map.get(32400)).toBe('plex');
  });

  it('ignores containers with no published ports and blank lines', () => {
    const output = 'internal\t\n\nweb\t0.0.0.0:80->80/tcp';
    const map = parseContainerPorts(output);
    expect(map.has(80)).toBe(true);
    expect(map.size).toBe(1);
  });
});
