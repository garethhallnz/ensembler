import type { TFunction } from 'i18next';

export const PENDING_STATUS_LABEL_KEY = {
  start: 'dashboard.status.starting',
  stop: 'dashboard.status.stopping',
  restart: 'dashboard.status.restarting',
} as const;

// Card status is a priority chain: an in-flight lifecycle action wins, then a
// pending setup step, then an unhealthy container, then running; otherwise it's
// stopped — echoing the raw container status when it's a known non-Unknown state.
export const serviceStatusLabel = (
  args: { pendingLabel: string | null; needsSetup: boolean; unhealthy: boolean; isRunning: boolean; status: string },
  t: TFunction,
): string => {
  if (args.pendingLabel) return args.pendingLabel;
  if (args.needsSetup) return t('dashboard.status.setupNeeded');
  if (args.unhealthy) return t('dashboard.status.needsAttention');
  if (args.isRunning) return t('dashboard.status.running');
  return args.status === 'Unknown' ? t('dashboard.status.stopped') : args.status;
};

export const serviceStatusDotClass = (
  args: { pending: boolean; needsSetup: boolean; unhealthy: boolean; isRunning: boolean },
): string => {
  if (args.pending) return 'bg-blue-500 animate-pulse';
  if (args.needsSetup || args.unhealthy) return 'bg-amber-500';
  if (args.isRunning) return 'bg-green-500';
  return 'bg-gray-400';
};

// Priority order: a pinned service is held there deliberately, so say so even
// when an update exists; otherwise flag an update, else it's tracking latest.
export const versionTitleKey = (isPinned: boolean, hasUpdate: boolean | null | undefined): string => {
  if (isPinned) return 'dashboard.card.version.pinned';
  if (hasUpdate) return 'dashboard.card.version.updateAvailable';
  return 'dashboard.card.version.latest';
};
