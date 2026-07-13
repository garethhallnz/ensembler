import fs from 'fs';
import { configDir, configFile } from './paths';
import { execAsync } from './exec';

// First-run / ongoing environment sanity checks. These warn about the common,
// invisible causes of services misbehaving that baffle non-technical users:
// Docker starved of memory, or the media disk nearly full. Advisory only —
// unknown values never produce a warning.
const BYTES_PER_GIB = 1024 ** 3;
const DOCKER_MEMORY_RECOMMENDED_GIB = 4;
const DISK_FREE_RECOMMENDED_GIB = 10;

async function getDockerMemoryGiB(): Promise<number | null> {
  try {
    const { stdout } = await execAsync(`docker info --format '{{.MemTotal}}'`);
    const bytes = parseInt(stdout.trim(), 10);
    return Number.isFinite(bytes) && bytes > 0 ? bytes / BYTES_PER_GIB : null;
  } catch {
    return null;
  }
}

async function getFreeDiskGiB(targetPath: string): Promise<number | null> {
  try {
    const stats = await fs.promises.statfs(targetPath);
    return (stats.bavail * stats.bsize) / BYTES_PER_GIB;
  } catch {
    return null;
  }
}

export async function runSystemChecks() {
  // Prefer the disk where downloads land (the space hog); fall back to the data dir.
  let diskPath = configDir;
  try {
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      const downloadPath = config.paths?.transmission?.[0] || config.paths?.deluge?.[0];
      if (downloadPath && fs.existsSync(downloadPath)) diskPath = downloadPath;
    }
  } catch {
    /* fall back to the data dir */
  }

  const [memoryGiB, freeGiB] = await Promise.all([getDockerMemoryGiB(), getFreeDiskGiB(diskPath)]);
  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    dockerMemory: {
      ok: memoryGiB === null || memoryGiB >= DOCKER_MEMORY_RECOMMENDED_GIB,
      allocatedGiB: memoryGiB === null ? null : round(memoryGiB),
      recommendedGiB: DOCKER_MEMORY_RECOMMENDED_GIB,
    },
    disk: {
      ok: freeGiB === null || freeGiB >= DISK_FREE_RECOMMENDED_GIB,
      freeGiB: freeGiB === null ? null : round(freeGiB),
      recommendedGiB: DISK_FREE_RECOMMENDED_GIB,
    },
  };
}
