import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import { apiFetch } from '../../requests/client';
import type { RuntimeStatus } from '../../services/runtimeManager';

interface SystemChecks {
  dockerMemory: { ok: boolean; allocatedGiB: number | null; recommendedGiB: number };
  disk: { ok: boolean; freeGiB: number | null; recommendedGiB: number };
}

interface DiagnosticsSectionProps {
  dockerStatus: { running: boolean };
  runtimeStatus: RuntimeStatus | null;
}

// Technical status + host resources, shown as a Settings section (its own home,
// off the main dashboard). Disk/memory are fetched fresh each time the section
// opens so free space reflects reality as disks fill over time.
export default function DiagnosticsSection({ dockerStatus, runtimeStatus }: DiagnosticsSectionProps) {
  const { t } = useTranslation();
  const [checks, setChecks] = useState<SystemChecks | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch('/api/system/checks');
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success) setChecks(data.checks);
      } catch {
        /* advisory — leave resources blank on failure */
      }
    })();
    return () => { active = false; };
  }, []);

  const gib = (value: number | null) => (value === null ? '—' : `${value} GB`);
  const resourceClass = (ok: boolean) =>
    ok ? 'text-gray-900 dark:text-white' : 'text-amber-600 dark:text-amber-400 font-medium';

  return (
    <Card>
      <Card.Header>
        <h4 className="text-lg font-medium">{t('dashboard.diagnostics.heading')}</h4>
      </Card.Header>
      <Card.Body>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-400">Docker</dt>
            <dd>{dockerStatus.running
              ? <Badge variant="success">{t('dashboard.diagnostics.running')}</Badge>
              : <Badge variant="error">{t('dashboard.diagnostics.notRunning')}</Badge>}</dd>
          </div>
          {runtimeStatus && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.app')}</dt>
              <dd>{runtimeStatus.appRunning
                ? <Badge variant="success">{t('dashboard.diagnostics.active')}</Badge>
                : <Badge variant="neutral">{t('dashboard.diagnostics.inactive')}</Badge>}</dd>
            </div>
          )}
          {runtimeStatus && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.backendConnection')}</dt>
              <dd>{runtimeStatus.backendConnected
                ? <Badge variant="success">{t('dashboard.diagnostics.connected')}</Badge>
                : <Badge variant="error">{t('dashboard.diagnostics.disconnected')}</Badge>}</dd>
            </div>
          )}
          {runtimeStatus && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.servicesRunning')}</dt>
              <dd className="font-medium text-gray-900 dark:text-white">{runtimeStatus.servicesRunning.length}</dd>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.diskFree')}</dt>
            <dd className={checks ? resourceClass(checks.disk.ok) : 'text-gray-400'}>
              {checks ? gib(checks.disk.freeGiB) : '…'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.dockerMemory')}</dt>
            <dd className={checks ? resourceClass(checks.dockerMemory.ok) : 'text-gray-400'}>
              {checks ? gib(checks.dockerMemory.allocatedGiB) : '…'}
            </dd>
          </div>
          {runtimeStatus && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-gray-600 dark:text-gray-400">{t('dashboard.diagnostics.lastChecked')}</dt>
              <dd className="text-gray-900 dark:text-white">{runtimeStatus.lastCheck.toLocaleTimeString()}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('dashboard.diagnostics.note')}</p>
      </Card.Body>
    </Card>
  );
}
