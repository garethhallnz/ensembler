import { useTranslation } from 'react-i18next';
import {
  HiExternalLink, HiStop, HiPlay, HiRefresh, HiDocumentText,
  HiArrowCircleUp, HiCog, HiCheckCircle, HiLockClosed,
} from 'react-icons/hi';
import Button from '../atoms/Button';
import Spinner from '../atoms/Spinner';
import ServiceActionsMenu from '../molecules/ServiceActionsMenu';
import { isDesktopApp } from '../../utils/selectDirectory';

// Reduce a messy image version to a recognizable major.minor.patch, e.g.
// "4.0.19.2979-ls319" or "1.43.2.10687-563d026ea" → "4.0.19" / "1.43.2".
const cleanVersion = (version: string): string => version.match(/^\d+(?:\.\d+){0,2}/)?.[0] ?? version;

// Priority order: a pinned service is held there deliberately, so say so even
// when an update exists; otherwise flag an update, else it's tracking latest.
const versionTitleKey = (isPinned: boolean, hasUpdate: boolean | null | undefined): string => {
  if (isPinned) return 'dashboard.card.version.pinned';
  if (hasUpdate) return 'dashboard.card.version.updateAvailable';
  return 'dashboard.card.version.latest';
};

export interface ServiceCardModel {
  serviceKey: string;
  name: string;
  roleKey: string;
  statusLabel: string;
  statusDotClass: string;
  unhealthy: boolean;
  isRunning: boolean;
  isUpdating: boolean;
  isChecking: boolean;
  hasUpdate: boolean | null | undefined;
  recentlyChecked: boolean;
  runningVersion?: string;
  isPinned: boolean;
}

interface ServiceCardProps {
  model: ServiceCardModel;
  onLaunch: () => void;
  onOpenInBrowser: () => void;
  onAction: (action: 'start' | 'stop' | 'restart') => void;
  onOpenLogs: () => void;
  onCheckUpdate: () => void;
  onConfigure: () => void;
  onUpdate: () => void;
}

export default function ServiceCard({
  model, onLaunch, onOpenInBrowser, onAction, onOpenLogs, onCheckUpdate, onConfigure, onUpdate,
}: ServiceCardProps) {
  const { t } = useTranslation();
  const { name, roleKey, statusLabel, statusDotClass, unhealthy, isRunning } = model;

  return (
    <div
      className="relative flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-shadow duration-200 p-6"
    >
      {/* Header: identity + at-a-glance status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-left text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
          <p className="text-left text-sm text-gray-600 dark:text-gray-400">{roleKey ? t(`dashboard.roles.${roleKey}`) : ''}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0" title={unhealthy ? t('dashboard.status.unhealthyTooltip') : statusLabel}>
          <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusLabel}</span>
        </div>
      </div>

      {/* Primary action + maintenance menu */}
      <div className="mt-6 flex items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={onLaunch}
          disabled={!isRunning}
          aria-label={t('dashboard.common.openNamed', { name })}
          tooltip={!isRunning ? t('dashboard.card.openDisabledTooltip') : t('dashboard.common.openNamed', { name })}
        >
          <HiExternalLink className="inline-block mr-1" /> {t('dashboard.common.open')}
        </Button>
        <div className="ml-auto">
          <ServiceActionsMenu
            items={[
              // Lifecycle controls live in the menu so "Open" is the
              // single clear action on every card.
              ...(isDesktopApp() && isRunning ? [{
                label: t('dashboard.menu.openInBrowser'),
                icon: <HiExternalLink className="w-4 h-4" />,
                onClick: onOpenInBrowser,
              }] : []),
              {
                label: isRunning ? t('dashboard.menu.stop') : t('dashboard.menu.start'),
                icon: isRunning ? <HiStop className="w-4 h-4" /> : <HiPlay className="w-4 h-4" />,
                onClick: () => onAction(isRunning ? 'stop' : 'start'),
              },
              ...(isRunning ? [{
                label: t('dashboard.menu.restart'),
                icon: <HiRefresh className="w-4 h-4" />,
                onClick: () => onAction('restart'),
              }] : []),
              {
                label: t('dashboard.menu.viewLogs'),
                icon: <HiDocumentText className="w-4 h-4" />,
                onClick: onOpenLogs,
              },
              {
                label: t('dashboard.services.checkForUpdates'),
                icon: <HiArrowCircleUp className="w-4 h-4" />,
                onClick: onCheckUpdate,
              },
              {
                label: t('dashboard.menu.configure'),
                icon: <HiCog className="w-4 h-4" />,
                onClick: onConfigure,
              },
            ]}
          />
        </div>
      </div>

      {/* Update state (left) + running version (muted, right) */}
      <div className="mt-4 flex items-center justify-between gap-2 min-h-[1.25rem]">
        <div className="min-w-0">
          {(() => {
            if (model.isChecking) {
              return (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Spinner size="sm" /> {t('dashboard.card.checkingUpdates')}
                </div>
              );
            }
            if (model.hasUpdate) {
              return (
                <button
                  onClick={onUpdate}
                  disabled={model.isUpdating}
                  className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  <HiArrowCircleUp className="w-4 h-4" />
                  {model.isUpdating ? t('dashboard.common.updating') : t('dashboard.card.updateAvailable')}
                </button>
              );
            }
            if (model.recentlyChecked) {
              return (
                <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <HiCheckCircle className="w-4 h-4" /> {t('dashboard.card.upToDate')}
                </div>
              );
            }
            return null;
          })()}
        </div>

        {isRunning && model.runningVersion && (() => {
          const shown = cleanVersion(model.runningVersion);
          const title = t(versionTitleKey(model.isPinned, model.hasUpdate), { version: shown });
          return (
            <span
              title={title}
              className={`shrink-0 inline-flex items-center gap-1 text-xs tabular-nums ${model.hasUpdate ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-gray-400 dark:text-gray-500'}`}
            >
              {model.isPinned
                ? <HiLockClosed className="w-3 h-3" aria-hidden />
                : <HiRefresh className="w-3 h-3" aria-hidden />}
              v{shown}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
