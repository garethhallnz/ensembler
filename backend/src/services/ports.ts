import net from 'net';

// True if nothing is currently answering on the port.
//
// We detect by connecting, not by binding: a trial bind to 0.0.0.0 succeeds
// (via SO_REUSEADDR) even when another process holds 127.0.0.1:port — which is
// exactly where reverse proxies and dev tooling listen — so it would miss the
// conflicts we care about. Connecting to 127.0.0.1 reaches any such listener,
// and a Docker port publish would collide with it just the same.
export function isPortFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const done = (free: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => done(false)); // something is listening
    socket.once('timeout', () => done(true));
    socket.once('error', () => done(true)); // ECONNREFUSED → nothing there
    socket.connect(port, '127.0.0.1');
  });
}

export interface PortConflict {
  service: string;
  port: number;
  // Next free port at or above the requested one, or null if none found
  suggestion: number | null;
}

// Find the next free port >= start, skipping any port already spoken for by
// another selected service, so a suggestion never collides with the rest of
// the selection.
async function suggestPort(start: number, taken: Set<number>): Promise<number | null> {
  for (let port = Math.max(start, 1024); port <= 65535; port++) {
    if (taken.has(port)) {
      continue;
    }
    if (await isPortFree(port)) {
      return port;
    }
  }
  return null;
}

// Validate the requested host ports against what is actually bound on the
// machine. `ownPorts` maps a host port to the name of a container Ensembler
// already runs there — those are not conflicts (re-running the wizard while
// a service is up must not flag that service's own port).
export async function findPortConflicts(
  requested: { service: string; port: number }[],
  ownPorts: Map<number, string> = new Map()
): Promise<PortConflict[]> {
  const requestedPorts = new Set(requested.map(r => r.port));
  const conflicts: PortConflict[] = [];

  for (const { service, port } of requested) {
    if (ownPorts.get(port) === service) {
      continue; // Ensembler's own container already holds this port
    }
    if (await isPortFree(port)) {
      continue;
    }
    const suggestion = await suggestPort(port + 1, requestedPorts);
    conflicts.push({ service, port, suggestion });
  }

  return conflicts;
}

// Parse `docker ps --format '{{.Names}}\t{{.Ports}}'` output into a map of
// published host port -> container name.
export function parseContainerPorts(dockerPsOutput: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const line of dockerPsOutput.split('\n')) {
    const [name, ports] = line.split('\t');
    if (!name || !ports) {
      continue;
    }
    // Matches host-published ports like "0.0.0.0:8989->8989/tcp" or
    // "127.0.0.1:9091->9091/tcp"
    for (const match of ports.matchAll(/(?:\d+\.\d+\.\d+\.\d+|\[::\]):(\d+)->/g)) {
      map.set(Number(match[1]), name.trim());
    }
  }
  return map;
}
