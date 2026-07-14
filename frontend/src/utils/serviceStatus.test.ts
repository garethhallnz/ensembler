import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { serviceStatusLabel, serviceStatusDotClass, versionTitleKey } from './serviceStatus';

// Identity stub so assertions read against the translation keys the helper picks.
const t = ((key: string) => key) as unknown as TFunction;

const label = (over: Partial<Parameters<typeof serviceStatusLabel>[0]> = {}) =>
  serviceStatusLabel(
    { pendingLabel: null, needsSetup: false, unhealthy: false, isRunning: false, status: 'Unknown', ...over },
    t,
  );

describe('serviceStatusLabel', () => {
  it('prefers an in-flight pending label over everything else', () => {
    expect(label({ pendingLabel: 'Starting…', needsSetup: true, unhealthy: true, isRunning: true })).toBe('Starting…');
  });

  it('falls to setup, then unhealthy, then running in priority order', () => {
    expect(label({ needsSetup: true, unhealthy: true, isRunning: true })).toBe('dashboard.status.setupNeeded');
    expect(label({ unhealthy: true, isRunning: true })).toBe('dashboard.status.needsAttention');
    expect(label({ isRunning: true })).toBe('dashboard.status.running');
  });

  it('shows "stopped" only for the Unknown container status', () => {
    expect(label({ status: 'Unknown' })).toBe('dashboard.status.stopped');
  });

  it('echoes the raw container status for a known non-running state', () => {
    expect(label({ status: 'Paused' })).toBe('Paused');
    expect(label({ status: 'Exited' })).toBe('Exited');
  });
});

describe('serviceStatusDotClass', () => {
  const dot = (over: Partial<Parameters<typeof serviceStatusDotClass>[0]> = {}) =>
    serviceStatusDotClass({ pending: false, needsSetup: false, unhealthy: false, isRunning: false, ...over });

  it('is blue while an action is pending, above all other states', () => {
    expect(dot({ pending: true, needsSetup: true, isRunning: true })).toBe('bg-blue-500 animate-pulse');
  });

  it('is amber for setup-needed or unhealthy', () => {
    expect(dot({ needsSetup: true })).toBe('bg-amber-500');
    expect(dot({ unhealthy: true })).toBe('bg-amber-500');
  });

  it('is green when running and gray when stopped', () => {
    expect(dot({ isRunning: true })).toBe('bg-green-500');
    expect(dot()).toBe('bg-gray-400');
  });
});

describe('versionTitleKey', () => {
  it('reports pinned even when an update exists', () => {
    expect(versionTitleKey(true, true)).toBe('dashboard.card.version.pinned');
  });

  it('reports an available update when not pinned', () => {
    expect(versionTitleKey(false, true)).toBe('dashboard.card.version.updateAvailable');
  });

  it('reports latest when neither pinned nor updatable', () => {
    expect(versionTitleKey(false, false)).toBe('dashboard.card.version.latest');
    expect(versionTitleKey(false, null)).toBe('dashboard.card.version.latest');
    expect(versionTitleKey(false, undefined)).toBe('dashboard.card.version.latest');
  });
});
