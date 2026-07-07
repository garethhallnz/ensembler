import { getServiceConfig } from '../serviceConfig';
import { readArrApiKey } from './apiKeyReader';
import { setupArrService } from './arrSetup';
import { setupProwlarr, ProwlarrApplication } from './prowlarrSetup';
import { SetupConnectionsResult, SetupStepResult, UserConfig } from './types';

// Root folders are container-side paths fixed by the volume mappings in
// serviceConfig, not the user's host paths.
const ARR_SERVICES = [
  { key: 'sonarr', implementation: 'Sonarr', rootFolder: '/tv' },
  { key: 'radarr', implementation: 'Radarr', rootFolder: '/movies' }
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Containers reach each other over the compose network, where the service
// name resolves as hostname and the internal port applies.
const networkUrl = (serviceKey: string): string => {
  const service = getServiceConfig(serviceKey)!;
  return `http://${serviceKey}:${service.internalPort}`;
};

const hostPort = (config: UserConfig, serviceKey: string): number =>
  config.ports?.[serviceKey] || getServiceConfig(serviceKey)!.defaultPort;

// Poll like the *arr readiness check does — Transmission's web server can take
// several seconds to start listening after its container is up. The probe must
// verify it is really Transmission answering: another process squatting on the
// port (reverse proxies, dev tooling) would otherwise pass a plain HTTP check.
async function waitForTransmissionReachable(
  port: number,
  timeoutMs = 60000,
  pollIntervalMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';

  while (true) {
    try {
      const response = await fetch(`http://localhost:${port}/transmission/rpc`, { method: 'GET' });
      // Transmission answers its RPC endpoint with an X-Transmission-Session-Id
      // header (usually on a 409), or a 401 when auth is enabled
      if (response.headers.get('x-transmission-session-id') || response.status === 401) {
        return;
      }
      lastError = `port ${port} answered HTTP ${response.status} but does not appear to be Transmission — check for a port conflict`;
    } catch (err) {
      lastError = (err as Error).message;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      throw new Error(lastError);
    }
    await delay(pollIntervalMs);
  }
}

export interface SetupTimeouts {
  keyTimeoutMs?: number;
  readyTimeoutMs?: number;
}

// Wire the enabled services together: Sonarr/Radarr → Transmission and root
// folders, Prowlarr → Sonarr/Radarr (indexer sync) and Transmission.
// Failures are collected per step rather than aborting the run, so one slow
// or broken service never blocks the others from being configured.
export async function setupConnections(
  config: UserConfig,
  configDir: string,
  timeouts: SetupTimeouts = {}
): Promise<SetupConnectionsResult> {
  const results: SetupStepResult[] = [];
  const isEnabled = (key: string) => !!config.selectedServices?.[key];

  // API keys first — every other step depends on them
  const apiKeys: { [serviceKey: string]: string } = {};
  const keyedServices = [...ARR_SERVICES.map(s => s.key), 'prowlarr'].filter(isEnabled);
  for (const serviceKey of keyedServices) {
    try {
      apiKeys[serviceKey] = await readArrApiKey(configDir, serviceKey, timeouts.keyTimeoutMs);
    } catch (err) {
      results.push({ service: serviceKey, step: 'api-key', success: false, message: (err as Error).message });
    }
  }

  let transmission: { host: string; port: number } | undefined;
  if (isEnabled('transmission')) {
    try {
      await waitForTransmissionReachable(hostPort(config, 'transmission'), timeouts.readyTimeoutMs);
      results.push({
        service: 'transmission',
        step: 'ready',
        success: true,
        message: 'Transmission is running'
      });
      transmission = { host: 'transmission', port: getServiceConfig('transmission')!.internalPort };
    } catch (err) {
      results.push({
        service: 'transmission',
        step: 'ready',
        success: false,
        message: `Transmission is not reachable: ${(err as Error).message}`
      });
    }
  }

  for (const arr of ARR_SERVICES) {
    if (!isEnabled(arr.key) || !apiKeys[arr.key]) {
      continue;
    }
    const stepResults = await setupArrService({
      serviceKey: arr.key,
      baseUrl: `http://localhost:${hostPort(config, arr.key)}`,
      apiKey: apiKeys[arr.key],
      rootFolder: arr.rootFolder,
      transmission,
      readyTimeoutMs: timeouts.readyTimeoutMs
    });
    results.push(...stepResults);
  }

  if (isEnabled('prowlarr') && apiKeys.prowlarr) {
    const applications: ProwlarrApplication[] = ARR_SERVICES
      .filter(arr => isEnabled(arr.key) && apiKeys[arr.key])
      .map(arr => ({
        implementation: arr.implementation,
        baseUrl: networkUrl(arr.key),
        apiKey: apiKeys[arr.key]
      }));

    const stepResults = await setupProwlarr({
      baseUrl: `http://localhost:${hostPort(config, 'prowlarr')}`,
      apiKey: apiKeys.prowlarr,
      prowlarrNetworkUrl: networkUrl('prowlarr'),
      applications,
      transmission,
      readyTimeoutMs: timeouts.readyTimeoutMs
    });
    results.push(...stepResults);
  }

  return {
    success: results.every(result => result.success),
    results
  };
}
