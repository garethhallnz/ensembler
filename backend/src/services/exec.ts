import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { composeFile } from './paths';

export const execAsync = promisify(exec);
export const execFileAsync = promisify(execFile);

// Run `docker compose -f <composeFile> <args…>` without a shell. Centralises the
// compose-file flag so no caller rebuilds the command prefix by hand.
export function dockerCompose(args: string[], opts: { maxBuffer?: number } = {}) {
  return execFileAsync('docker', ['compose', '-f', composeFile, ...args], opts);
}
