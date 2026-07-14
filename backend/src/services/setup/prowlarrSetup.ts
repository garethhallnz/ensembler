import {
  ArrRequestOptions,
  arrRequest,
  waitForArrReady,
  ensureTransmissionDownloadClient
} from './arrSetup';
import { SetupStepResult } from './types';

export interface ProwlarrApplication {
  // 'Sonarr' | 'Radarr' — Prowlarr's implementation name for the app
  implementation: string;
  // Address the app is reachable at from inside the compose network
  baseUrl: string;
  apiKey: string;
}

// Register a Sonarr/Radarr instance as a Prowlarr "application" so every
// indexer the user adds in Prowlarr syncs to it automatically.
export async function ensureApplication(
  options: ArrRequestOptions,
  prowlarrUrl: string,
  app: ProwlarrApplication
): Promise<{ created: boolean }> {
  const existing = await arrRequest<{ implementation: string }[]>(options, 'GET', '/applications');
  if (existing.some(a => a.implementation === app.implementation)) {
    return { created: false };
  }
  await arrRequest(options, 'POST', '/applications', {
    name: app.implementation,
    implementation: app.implementation,
    configContract: `${app.implementation}Settings`,
    syncLevel: 'fullSync',
    tags: [],
    fields: [
      { name: 'prowlarrUrl', value: prowlarrUrl },
      { name: 'baseUrl', value: app.baseUrl },
      { name: 'apiKey', value: app.apiKey }
    ]
  });
  return { created: true };
}

export interface ProwlarrSetupOptions {
  baseUrl: string;
  apiKey: string;
  // Prowlarr's own address as other containers reach it
  prowlarrNetworkUrl: string;
  applications: ProwlarrApplication[];
  transmission?: { host: string; port: number };
  readyTimeoutMs?: number;
}

export async function setupProwlarr(setup: ProwlarrSetupOptions): Promise<SetupStepResult[]> {
  const options: ArrRequestOptions = {
    baseUrl: setup.baseUrl,
    apiKey: setup.apiKey,
    apiBase: '/api/v1'
  };
  const results: SetupStepResult[] = [];

  try {
    await waitForArrReady(options, setup.readyTimeoutMs);
  } catch (err) {
    const readyFailure: SetupStepResult = {
      service: 'prowlarr',
      step: 'ready',
      success: false,
      message: (err as Error).message,
      code: 'messages.setup.prowlarrStepFailed',
      params: { error: (err as Error).message }
    };
    return [readyFailure];
  }

  for (const app of setup.applications) {
    const step = `app-${app.implementation.toLowerCase()}`;
    try {
      const { created } = await ensureApplication(options, setup.prowlarrNetworkUrl, app);
      results.push({
        service: 'prowlarr',
        step,
        success: true,
        message: created
          ? `Connected ${app.implementation} — indexers will sync automatically`
          : `${app.implementation} already connected`,
        code: created
          ? 'messages.setup.prowlarrAppConnected'
          : 'messages.setup.prowlarrAppAlreadyConnected',
        params: { app: app.implementation }
      });
    } catch (err) {
      results.push({
        service: 'prowlarr',
        step,
        success: false,
        message: (err as Error).message,
        code: 'messages.setup.prowlarrStepFailed',
        params: { error: (err as Error).message }
      });
    }
  }

  if (setup.transmission) {
    try {
      const { created } = await ensureTransmissionDownloadClient(options, setup.transmission, 'prowlarr');
      results.push({
        service: 'prowlarr',
        step: 'download-client',
        success: true,
        message: created ? 'Connected to Transmission' : 'Transmission already configured',
        code: created
          ? 'messages.setup.prowlarrTransmissionConnected'
          : 'messages.setup.prowlarrTransmissionAlreadyConfigured'
      });
    } catch (err) {
      results.push({
        service: 'prowlarr',
        step: 'download-client',
        success: false,
        message: (err as Error).message,
        code: 'messages.setup.prowlarrStepFailed',
        params: { error: (err as Error).message }
      });
    }
  }

  return results;
}
