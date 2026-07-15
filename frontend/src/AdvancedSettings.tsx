import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from './requests/client';
import { getCurrentConfig, type CurrentConfig } from './requests/services';
import Button from './components/atoms/Button';
import Spinner from './components/atoms/Spinner';
import Alert from './components/atoms/Alert';
import Card from './components/atoms/Card';
import EnvironmentSettings from './components/molecules/EnvironmentSettings';
import AppearanceSettings from './components/molecules/AppearanceSettings';
import Toggle from './components/atoms/Toggle';
import { HiCheckCircle, HiXCircle } from 'react-icons/hi';
import { useToast } from './contexts/ToastContext';
import ConfirmationModal from './components/molecules/ConfirmationModal';

interface AdvancedSettingsProps {
  onClose: () => void;
  onResetComplete?: () => void;
  // During setup there's no config to manage yet, so show only Appearance
  // (theme + language) with a Close — never the config-dependent sections.
  appearanceOnly?: boolean;
}

type ResetPhaseStatus = 'pending' | 'active' | 'done' | 'error';

// App-level settings only. Per-service configuration and adding services live
// on the dashboard now, so this is limited to global environment settings and
// a clearly separated danger zone (full reset).
export default function AdvancedSettings({ onClose, onResetComplete, appearanceOnly = false }: AdvancedSettingsProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [config, setConfig] = useState<CurrentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [resetPhases, setResetPhases] = useState<{ key: string; label: string; status: ResetPhaseStatus }[]>([]);
  const [resetStage, setResetStage] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [openModal, setOpenModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{ message: string; onConfirm: () => void }>({
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    // Appearance-only mode (during setup) doesn't use config — skip the fetch,
    // which would 404 before any config exists.
    if (appearanceOnly) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setConfig(await getCurrentConfig());
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [appearanceOnly]);

  const handleEnvironmentChange = (field: string, value: string | number) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, environment: { ...prev.environment, [field]: value } } : prev);
  };

  const validateEnvironment = (): boolean => {
    if (!config) return false;
    const errs: { [key: string]: string } = {};
    if (!config.environment.tz?.trim()) errs.tz = t('setup.errors.tzRequired');
    if (isNaN(config.environment.puid) || config.environment.puid < 0) errs.puid = t('setup.errors.puid');
    if (isNaN(config.environment.pgid) || config.environment.pgid < 0) errs.pgid = t('setup.errors.pgid');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateEnvironment()) return;
    setSaving(true);
    try {
      const saveRes = await apiFetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!saveRes.ok) throw new Error('Failed to save configuration');

      const composeRes = await apiFetch('/api/config/generate-compose', { method: 'POST' });
      if (!composeRes.ok) throw new Error('Failed to regenerate docker-compose files');

      const startRes = await apiFetch('/api/services/start-all', { method: 'POST' });
      if (!startRes.ok) {
        showToast(t('settings.toast.savedPartial'), 'warning');
      } else {
        showToast(t('settings.toast.saved'), 'success');
      }
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast(t('settings.toast.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteReset = () => {
    setConfirmationModal({
      message: t('settings.danger.confirm'),
      onConfirm: async () => {
        setOpenModal(false);
        setResetStage('running');

        const phases = [
          { key: 'stop', label: t('settings.reset.phaseStop'), status: 'pending' as ResetPhaseStatus },
          { key: 'clean', label: t('settings.reset.phaseClean'), status: 'pending' as ResetPhaseStatus }
        ];
        setResetPhases(phases);
        const setPhase = (key: string, status: ResetPhaseStatus) =>
          setResetPhases(prev => prev.map(p => (p.key === key ? { ...p, status } : p)));

        const step = async (key: string, url: string) => {
          setPhase(key, 'active');
          const res = await apiFetch(url, { method: 'POST' });
          if (!res.ok) {
            setPhase(key, 'error');
            throw new Error(`Reset step failed (${key})`);
          }
          setPhase(key, 'done');
        };

        try {
          await step('stop', '/api/config/reset/stop-services');
          await step('clean', '/api/config/reset/clean');
          // Brief "done" state, then hand back to the app to return to the
          // wizard in place (no window reload).
          setResetStage('done');
          setTimeout(() => onResetComplete?.(), 1400);
        } catch (error) {
          setResetStage('error');
          showToast(t('settings.toast.resetFailed', { error }), 'error');
        }
      },
    });
    setOpenModal(true);
  };

  // During setup there's no saved config to manage, so show only appearance
  // (theme + language) — no config load, no Save/Reset.
  if (appearanceOnly) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('settings.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settings.subtitle')}</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-6">
          <AppearanceSettings selectId="setup-language" />
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 p-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>{t('settings.close')}</Button>
        </div>
      </div>
    );
  }

  // Full-screen reset progress so the user sees what's happening rather than
  // the window blanking. Covers the whole app while the reset runs.
  if (resetStage !== 'idle') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-md w-full px-6">
          {resetStage === 'done' ? (
            <div className="text-center">
              <div className="flex justify-center mb-6"><HiCheckCircle className="w-16 h-16 text-green-500" /></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('settings.reset.completeTitle')}</h2>
              <p className="text-gray-600 dark:text-gray-400">{t('settings.reset.completeSubtitle')}</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">{t('settings.reset.runningTitle')}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">{t('settings.reset.runningSubtitle')}</p>
              <div className="space-y-4">
                {resetPhases.map((phase) => (
                  <div key={phase.key} className="flex items-center gap-3">
                    <div className="shrink-0">
                      {phase.status === 'done' && <HiCheckCircle className="w-6 h-6 text-green-500" />}
                      {phase.status === 'error' && <HiXCircle className="w-6 h-6 text-red-500" />}
                      {phase.status === 'active' && (
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400 animate-spin" />
                      )}
                      {phase.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                    </div>
                    <span className={`font-medium ${phase.status === 'pending' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                      {phase.label}
                    </span>
                  </div>
                ))}
              </div>
              {resetStage === 'error' && (
                <div className="mt-6 text-center">
                  <p className="text-sm text-red-500 mb-3">{t('settings.reset.errorMessage')}</p>
                  <Button color="gray" outline onClick={() => { setResetStage('idle'); setResetPhases([]); }}>
                    {t('settings.close')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('settings.title')}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg">{t('settings.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('settings.errorTitle')}</h3>
        </div>
        <div className="flex-1 p-4">
          <Alert color="red">{t('settings.loadError')}</Alert>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 p-4">
          <Button onClick={onClose}>{t('settings.close')}</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('settings.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          <AppearanceSettings selectId="app-language" />

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">{t('settings.general.heading')}</h4>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{t('settings.general.trayLabel')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.general.trayDescription')}
                  </p>
                </div>
                <Toggle
                  checked={config.minimizeToTray ?? true}
                  onChange={value => setConfig(prev => prev ? { ...prev, minimizeToTray: value } : prev)}
                  aria-label={t('settings.general.trayAriaLabel')}
                  className="shrink-0"
                />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">{t('settings.environment.heading')}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('settings.environment.description')}
              </p>
            </Card.Header>
            <Card.Body>
              <EnvironmentSettings
                environment={config.environment}
                errors={errors}
                onEnvironmentChange={handleEnvironmentChange}
                layout="vertical"
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">{t('settings.updates.heading')}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('settings.updates.description')}
              </p>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{t('settings.updates.autoLabel')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.updates.autoDescription')}
                  </p>
                </div>
                <Toggle
                  checked={config.autoUpdate ?? false}
                  onChange={value => setConfig(prev => prev ? { ...prev, autoUpdate: value } : prev)}
                  aria-label={t('settings.updates.autoAriaLabel')}
                  className="shrink-0"
                />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium text-red-600 dark:text-red-400">{t('settings.danger.heading')}</h4>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">{t('settings.danger.resetLabel')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.danger.resetDescription')}
                  </p>
                </div>
                <Button variant="danger" onClick={handleCompleteReset} className="shrink-0">
                  {t('settings.danger.resetButton')}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-600 p-4">
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>{t('settings.cancel')}</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saving ? t('settings.saving') : t('settings.save')}
            </Button>
          </div>
        </div>
      </div>

      {openModal && (
        <ConfirmationModal
          show={openModal}
          onClose={() => setOpenModal(false)}
          onConfirm={confirmationModal.onConfirm}
          message={confirmationModal.message}
          destructive
        />
      )}
    </>
  );
}
