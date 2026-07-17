import { z } from 'zod';
import { apiFetch } from './client';

// Typed, runtime-validated wrappers for the service/status endpoints the
// dashboard polls. Each parses the response through a Zod schema (throwing on an
// unexpected shape) so callers get typed data or a clear error — no blind casts.

export const DockerStatusSchema = z.object({
  docker: z.boolean(),
  compose: z.boolean(),
});

export const ServicesStatusSchema = z.object({
  success: z.boolean(),
  serviceStatus: z.record(z.string(), z.string()),
});

const AutoUpdateResultSchema = z.object({
  at: z.string(),
  updated: z.array(z.string()),
  failed: z.array(z.object({ service: z.string(), error: z.string().optional() })),
});

export type AutoUpdateResult = z.infer<typeof AutoUpdateResultSchema>;

const ServiceUpdatesSchema = z.object({
  success: z.boolean(),
  updates: z.record(z.string(), z.object({ hasUpdate: z.boolean().nullable() })),
  lastChecked: z.string().nullish(),
  lastAutoUpdate: AutoUpdateResultSchema.nullish(),
});

const ServiceMonitorSchema = z.object({
  success: z.boolean(),
  services: z.record(z.string(), z.object({
    status: z.string(),
    healthy: z.boolean(),
    alert: z.boolean(),
  })),
});

export type ServiceUpdates = z.infer<typeof ServiceUpdatesSchema>['updates'];
export type ServiceMonitor = z.infer<typeof ServiceMonitorSchema>['services'];

export async function getDockerStatus(): Promise<{ docker: boolean; compose: boolean }> {
  const res = await apiFetch('/api/docker/status');
  return DockerStatusSchema.parse(await res.json());
}

export async function getServiceStatuses(): Promise<Record<string, string>> {
  const res = await apiFetch('/api/services/status');
  const data = ServicesStatusSchema.parse(await res.json());
  if (!data.success) throw new Error('Service status request was unsuccessful');
  return data.serviceStatus;
}

export async function getServiceUpdates(): Promise<{ updates: ServiceUpdates; lastChecked: string | null; lastAutoUpdate: AutoUpdateResult | null }> {
  const res = await apiFetch('/api/services/updates');
  const data = ServiceUpdatesSchema.parse(await res.json());
  if (!data.success) throw new Error('Service updates request was unsuccessful');
  return { updates: data.updates, lastChecked: data.lastChecked ?? null, lastAutoUpdate: data.lastAutoUpdate ?? null };
}

// POST — recompute update availability now (cheap digest check, no image pulls).
export async function checkServiceUpdates(): Promise<ServiceUpdates> {
  const res = await apiFetch('/api/services/updates/check', { method: 'POST' });
  const data = ServiceUpdatesSchema.parse(await res.json());
  if (!data.success) throw new Error('Update check was unsuccessful');
  return data.updates;
}

// Ensembler's own update check (GitHub Releases). latestVersion is null when
// the check couldn't reach GitHub — treated as "couldn't determine", never as
// up-to-date. The app never self-installs; users update by re-downloading.
const AppUpdateSchema = z.object({
  success: z.boolean(),
  currentVersion: z.string(),
  latestVersion: z.string().nullable(),
  hasUpdate: z.boolean(),
  releaseUrl: z.string().nullable(),
  lastChecked: z.string().nullable(),
});

export type AppUpdate = z.infer<typeof AppUpdateSchema>;

export async function getAppUpdate(): Promise<AppUpdate> {
  const res = await apiFetch('/api/app/update');
  return AppUpdateSchema.parse(await res.json());
}

// POST — force a fresh check now (backs the settings "Check for updates" button).
export async function checkAppUpdate(): Promise<AppUpdate> {
  const res = await apiFetch('/api/app/update/check', { method: 'POST' });
  return AppUpdateSchema.parse(await res.json());
}

export async function getServiceMonitor(): Promise<ServiceMonitor> {
  const res = await apiFetch('/api/services/monitor');
  const data = ServiceMonitorSchema.parse(await res.json());
  if (!data.success) throw new Error('Service monitor request was unsuccessful');
  return data.services;
}

const ServiceVersionSchema = z.object({ success: z.boolean(), version: z.string().optional() });
const ServiceLogsSchema = z.object({ success: z.boolean(), logs: z.string().optional() });
const ServiceUpdateCheckSchema = z.object({ success: z.boolean(), hasUpdate: z.boolean().nullish() });

// Best-effort running version; '' when unavailable (caller filters those out).
export async function getServiceVersion(serviceKey: string): Promise<string> {
  const res = await apiFetch(`/api/services/${serviceKey}/version`);
  const data = ServiceVersionSchema.parse(await res.json());
  return data.success && data.version ? data.version : '';
}

export async function getServiceLogs(serviceKey: string): Promise<string> {
  const res = await apiFetch(`/api/services/${serviceKey}/logs`);
  const data = ServiceLogsSchema.parse(await res.json());
  if (!data.success || data.logs === undefined) throw new Error('Service logs request was unsuccessful');
  return data.logs;
}

// Per-service digest re-check; null when availability can't be determined.
export async function getServiceUpdateStatus(serviceKey: string): Promise<boolean | null> {
  const res = await apiFetch(`/api/services/${serviceKey}/check-updates`);
  const data = ServiceUpdateCheckSchema.parse(await res.json());
  if (!data.success) throw new Error('Update check was unsuccessful');
  return data.hasUpdate ?? null;
}

const ServiceCatalogEntrySchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  defaultPort: z.number(),
  pathRequirements: z.array(z.object({
    label: z.string(),
    required: z.boolean(),
    description: z.string(),
  })),
  required: z.boolean(),
  recommended: z.boolean().optional(),
});

export type ServiceCatalogEntry = z.infer<typeof ServiceCatalogEntrySchema>;

const ServiceCatalogSchema = z.object({
  success: z.boolean(),
  services: z.array(ServiceCatalogEntrySchema),
});

// The catalog of supported services (static metadata, not the user's config).
export async function getServiceCatalog(): Promise<ServiceCatalogEntry[]> {
  const res = await apiFetch('/api/services/config');
  const data = ServiceCatalogSchema.parse(await res.json());
  if (!data.success) throw new Error('Service catalog request was unsuccessful');
  return data.services;
}

// Narrow read of the user config: just the per-service pinned image tags. Kept
// lenient (only the `versions` map is validated) so it tolerates the rest of the
// config shape, which other callers own.
const PinnedVersionsSchema = z.object({ versions: z.record(z.string(), z.string()).optional() });

export async function getPinnedVersions(): Promise<Record<string, string>> {
  const res = await apiFetch('/api/config/current');
  if (!res.ok) throw new Error('Current config request was unsuccessful');
  const data = PinnedVersionsSchema.parse(await res.json());
  return data.versions ?? {};
}

// The full user configuration. Used by the settings + per-service config screens.
const CurrentConfigSchema = z.object({
  selectedServices: z.record(z.string(), z.boolean()),
  paths: z.record(z.string(), z.array(z.string())),
  ports: z.record(z.string(), z.number()),
  environment: z.object({ tz: z.string(), puid: z.number(), pgid: z.number() }),
  versions: z.record(z.string(), z.string()).optional(),
  autoUpdate: z.boolean().optional(),
  updateNotifications: z.boolean().optional(),
  minimizeToTray: z.boolean().optional(),
});

export type CurrentConfig = z.infer<typeof CurrentConfigSchema>;

export async function getCurrentConfig(): Promise<CurrentConfig> {
  const res = await apiFetch('/api/config/current');
  if (!res.ok) throw new Error('Current config request was unsuccessful');
  return CurrentConfigSchema.parse(await res.json());
}
