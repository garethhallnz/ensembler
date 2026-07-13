import { execFileAsync, dockerCompose } from './exec';

// Docker liveness via the CLI, not a hardcoded socket. The docker CLI knows the
// right socket / named pipe for the current OS, whereas /var/run/docker.sock
// never exists on Windows — so a socket probe there always reports Docker down.
export async function isDockerRunning(): Promise<boolean> {
  try {
    await execFileAsync('docker', ['ps']);
    return true;
  } catch {
    return false;
  }
}

// Bring one service (or all, when service is omitted) up, self-healing against
// a stale container that already holds the fixed container_name — left over
// from an interrupted run, a crash, or an older install. Without this, `up`
// hard-fails with "container name is already in use" and a non-technical user
// has no way to recover. On that specific conflict we remove the offending
// container(s) — their data lives in mounted volumes, so recreation is lossless
// — and retry once.
export async function composeUp(service?: string, forceRecreate = false): Promise<void> {
  const args = ['up', '-d'];
  if (service) args.push(service);
  if (forceRecreate) args.push('--force-recreate');
  args.push('--remove-orphans');
  try {
    await dockerCompose(args);
  } catch (err) {
    const e = err as { message?: string; stderr?: string };
    const text = `${e.message ?? ''}\n${e.stderr ?? ''}`;
    const conflicts = [...text.matchAll(/container name "\/?([^"]+)" is already in use/gi)].map(m => m[1]);
    if (conflicts.length === 0) throw err; // a different failure — surface it
    await Promise.all(conflicts.map(name => execFileAsync('docker', ['rm', '-f', name]).catch(() => undefined)));
    await dockerCompose(args); // retry once with the names freed
  }
}

export function composeStop(service?: string) {
  return dockerCompose(service ? ['stop', service] : ['stop']);
}

export function composeRestart(service: string) {
  return dockerCompose(['restart', service]);
}

export async function getContainerStatus(service: string): Promise<'Running' | 'Stopped' | 'Starting' | 'Unknown'> {
  try {
    const { stdout } = await execFileAsync('docker', ['ps', '--filter', `name=${service}`, '--format', '{{.Status}}']);
    if (stdout.trim() === '') return 'Stopped';
    if (stdout.includes('Up')) return 'Running';
    return 'Starting';
  } catch {
    return 'Unknown';
  }
}

export function composeLogs(service: string) {
  // --no-color strips ANSI escapes (garbage in the viewer), --no-log-prefix
  // drops the redundant "service | " prefix, and a larger tail + buffer avoids
  // truncating the output.
  return dockerCompose(
    ['logs', '--no-color', '--no-log-prefix', '--tail=1000', service],
    { maxBuffer: 20 * 1024 * 1024 }
  );
}
