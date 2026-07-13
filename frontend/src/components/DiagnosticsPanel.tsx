import { useTranslation } from 'react-i18next';
import { HiChevronUp, HiChevronDown } from 'react-icons/hi';
import Card from './Card';
import Badge from './Badge';
import type { RuntimeStatus } from '../services/runtimeManager';

interface DiagnosticsPanelProps {
  dockerStatus: { running: boolean };
  runtimeStatus: RuntimeStatus | null;
  expanded: boolean;
  onToggleExpanded: () => void;
}

// Technical status, collapsed by default. Not needed for normal use, so it's a
// quiet disclosure rather than a prominent panel.
export default function DiagnosticsPanel({
  dockerStatus, runtimeStatus, expanded, onToggleExpanded,
}: DiagnosticsPanelProps) {
  const { t } = useTranslation();
  const allOk = dockerStatus.running && (!runtimeStatus || runtimeStatus.appRunning);

  return (
    <Card className="mt-6">
      <Card.Header
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${allOk ? 'bg-green-500' : 'bg-amber-500'}`} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dashboard.diagnostics.heading')}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {allOk ? t('dashboard.diagnostics.allOk') : t('dashboard.diagnostics.attention')}
            </span>
            {expanded
              ? <HiChevronUp className="w-5 h-5 text-gray-500" />
              : <HiChevronDown className="w-5 h-5 text-gray-500" />}
          </div>
        </div>
      </Card.Header>
      {expanded && (
        <Card.Body>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400">Docker</dt>
              <dd>{dockerStatus.running ? <Badge variant="success">{t('dashboard.diagnostics.running')}</Badge> : <Badge variant="error">{t('dashboard.diagnostics.notRunning')}</Badge>}</dd>
            </div>
            {runtimeStatus && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.app')}</dt>
                <dd>{runtimeStatus.appRunning ? <Badge variant="success">{t('dashboard.diagnostics.active')}</Badge> : <Badge variant="neutral">{t('dashboard.diagnostics.inactive')}</Badge>}</dd>
              </div>
            )}
            {runtimeStatus && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.backendConnection')}</dt>
                <dd>{runtimeStatus.backendConnected ? <Badge variant="success">{t('dashboard.diagnostics.connected')}</Badge> : <Badge variant="error">{t('dashboard.diagnostics.disconnected')}</Badge>}</dd>
              </div>
            )}
            {runtimeStatus && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.servicesRunning')}</dt>
                <dd className="font-medium text-gray-900 dark:text-white">{runtimeStatus.servicesRunning.length}</dd>
              </div>
            )}
            {runtimeStatus && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.lastChecked')}</dt>
                <dd className="text-gray-900 dark:text-white">{runtimeStatus.lastCheck.toLocaleTimeString()}</dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.diagnostics.note')}
          </p>
        </Card.Body>
      )}
    </Card>
  );
}
