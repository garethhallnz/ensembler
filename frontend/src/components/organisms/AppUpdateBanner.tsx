import { useEffect, useState } from 'react';
import { HiArrowCircleUp, HiX } from 'react-icons/hi';
import { Drawer } from 'flowbite-react';
import { useTranslation } from 'react-i18next';
import { getAppUpdate, getCurrentConfig } from '../../requests/services';
import Docs from '../molecules/Docs';

// Tells the user when a newer Ensembler release exists. It never downloads or
// installs anything — the "How to update" link opens the in-app docs, and the
// user updates by re-downloading. Only shows when update notifications are
// enabled (default on) and a newer version is found, and can be dismissed for
// the session so it never nags.
export default function AppUpdateBanner() {
  const { t } = useTranslation();
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const config = await getCurrentConfig();
        if (config.updateNotifications === false) return; // user opted out
        const update = await getAppUpdate();
        if (active && update.hasUpdate && update.latestVersion) {
          setLatestVersion(update.latestVersion);
        }
      } catch {
        /* silent — update notifications are advisory */
      }
    })();
    return () => { active = false; };
  }, []);

  if (dismissed || !latestVersion) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <HiArrowCircleUp className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t('appUpdate.banner.heading')}</h3>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
            {t('appUpdate.banner.message', { version: latestVersion })}
          </p>
          <button
            type="button"
            onClick={() => setDocsOpen(true)}
            className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            {t('appUpdate.banner.howToUpdate')} →
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('appUpdate.banner.dismiss')}
          className="shrink-0 p-1 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
        >
          <HiX className="w-4 h-4" />
        </button>
      </div>

      <Drawer
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        position="right"
        className="!w-[1000px] max-w-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div className="h-full bg-white dark:bg-gray-800">
          <Docs initialPage="how-to-update" />
        </div>
      </Drawer>
    </div>
  );
}
