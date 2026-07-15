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

const ServiceUpdatesSchema = z.object({
  success: z.boolean(),
  updates: z.record(z.string(), z.object({ hasUpdate: z.boolean().nullable() })),
  lastChecked: z.string().nullish(),
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

export async function getServiceUpdates(): Promise<{ updates: ServiceUpdates; lastChecked: string | null }> {
  const res = await apiFetch('/api/services/updates');
  const data = ServiceUpdatesSchema.parse(await res.json());
  if (!data.success) throw new Error('Service updates request was unsuccessful');
  return { updates: data.updates, lastChecked: data.lastChecked ?? null };
}

// POST — recompute update availability now (cheap digest check, no image pulls).
export async function checkServiceUpdates(): Promise<ServiceUpdates> {
  const res = await apiFetch('/api/services/updates/check', { method: 'POST' });
  const data = ServiceUpdatesSchema.parse(await res.json());
  if (!data.success) throw new Error('Update check was unsuccessful');
  return data.updates;
}

export async function getServiceMonitor(): Promise<ServiceMonitor> {
  const res = await apiFetch('/api/services/monitor');
  const data = ServiceMonitorSchema.parse(await res.json());
  if (!data.success) throw new Error('Service monitor request was unsuccessful');
  return data.services;
}
