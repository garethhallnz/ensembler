import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { HiExternalLink } from 'react-icons/hi';

interface SetupChecklistProps {
  prowlarrNeedsIndexers: boolean;
  plexNeedsSignIn: boolean;
  overseerrNeedsSetup: boolean;
  onLaunch: (serviceKey: string) => void;
}

// Remaining manual setup steps, grouped into one calm checklist rather than a
// stack of separate banners. Renders nothing when there's nothing left to do.
export default function SetupChecklist({
  prowlarrNeedsIndexers, plexNeedsSignIn, overseerrNeedsSetup, onLaunch,
}: SetupChecklistProps) {
  const { t } = useTranslation();

  const tasks = [
    prowlarrNeedsIndexers && {
      key: 'prowlarr',
      label: <Trans i18nKey="dashboard.tasks.prowlarr" components={{ strong: <strong className="font-semibold" /> }} />,
    },
    plexNeedsSignIn && {
      key: 'plex',
      label: <Trans i18nKey="dashboard.tasks.plex" components={{ strong: <strong className="font-semibold" /> }} />,
    },
    overseerrNeedsSetup && {
      key: 'overseerr',
      label: <Trans i18nKey="dashboard.tasks.overseerr" components={{ strong: <strong className="font-semibold" /> }} />,
    },
  ].filter(Boolean) as { key: string; label: ReactNode }[];

  if (tasks.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-5 py-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('dashboard.setupChecklist.heading')}</h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('dashboard.setupChecklist.stepsLeft', { count: tasks.length })}
        </span>
      </div>
      <ul className="divide-y divide-amber-200/70 dark:divide-amber-900/40">
        {tasks.map(task => (
          <li key={task.key} className="flex items-center gap-3 py-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200">{task.label}</span>
            <button
              onClick={() => onLaunch(task.key)}
              className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {t('dashboard.common.open')} <HiExternalLink className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
