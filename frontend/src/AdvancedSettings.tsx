import { useState, useEffect } from 'react';
import { Button, Spinner, Alert, Card, EnvironmentSettings, Toggle } from './components';
import { HiCheckCircle, HiXCircle } from 'react-icons/hi';
import { useToast } from './contexts/ToastContext';
import { useTheme, type ThemePreference } from './contexts/ThemeContext';
import ConfirmationModal from './components/ConfirmationModal';

interface AdvancedSettingsProps {
  onClose: () => void;
  onResetComplete: () => void;
}

interface ConfigType {
  selectedServices: { [key: string]: boolean };
  ports: { [key: string]: number };
  environment: {
    tz: string;
    puid: number;
    pgid: number;
  };
  paths: { [key: string]: string[] };
  autoUpdate?: boolean;
  minimizeToTray?: boolean;
}

type ResetPhaseStatus = 'pending' | 'active' | 'done' | 'error';

// App-level settings only. Per-service configuration and adding services live
// on the dashboard now, so this is limited to global environment settings and
// a clearly separated danger zone (full reset).
export default function AdvancedSettings({ onClose, onResetComplete }: AdvancedSettingsProps) {
  const { showToast } = useToast();
  const { preference, setPreference } = useTheme();
  const [config, setConfig] = useState<ConfigType | null>(null);
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
    (async () => {
      try {
        const res = await fetch('http://localhost:3001/api/config/current');
        if (res.ok) {
          setConfig(await res.json());
        }
      } catch (error) {
        console.error('Error fetching config:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEnvironmentChange = (field: string, value: string | number) => {
    if (!config) return;
    setConfig(prev => ({ ...prev!, environment: { ...prev!.environment, [field]: value } }));
  };

  const validateEnvironment = (): boolean => {
    if (!config) return false;
    const errs: { [key: string]: string } = {};
    if (!config.environment.tz?.trim()) errs.tz = 'Timezone is required.';
    if (isNaN(config.environment.puid) || config.environment.puid < 0) errs.puid = 'PUID must be a non-negative number.';
    if (isNaN(config.environment.pgid) || config.environment.pgid < 0) errs.pgid = 'PGID must be a non-negative number.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateEnvironment()) return;
    setSaving(true);
    try {
      const saveRes = await fetch('http://localhost:3001/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!saveRes.ok) throw new Error('Failed to save configuration');

      const composeRes = await fetch('http://localhost:3001/api/config/generate-compose', { method: 'POST' });
      if (!composeRes.ok) throw new Error('Failed to regenerate docker-compose files');

      const startRes = await fetch('http://localhost:3001/api/services/start-all', { method: 'POST' });
      if (!startRes.ok) {
        showToast('Settings saved. Some services may need to be started manually.', 'warning');
      } else {
        showToast('Settings saved and applied.', 'success');
      }
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteReset = () => {
    setConfirmationModal({
      message: '⚠️ DESTRUCTIVE ACTION: This will stop and remove all services and delete all of their settings, histories, and databases, returning to a fresh install. Your media files (TV shows, movies, downloads) will NOT be deleted. This action cannot be undone. Are you absolutely sure?',
      onConfirm: async () => {
        setOpenModal(false);
        setResetStage('running');

        const phases = [
          { key: 'stop', label: 'Stopping and removing services', status: 'pending' as ResetPhaseStatus },
          { key: 'clean', label: 'Removing configuration and data', status: 'pending' as ResetPhaseStatus }
        ];
        setResetPhases(phases);
        const setPhase = (key: string, status: ResetPhaseStatus) =>
          setResetPhases(prev => prev.map(p => (p.key === key ? { ...p, status } : p)));

        const step = async (key: string, url: string) => {
          setPhase(key, 'active');
          const res = await fetch(url, { method: 'POST' });
          if (!res.ok) {
            setPhase(key, 'error');
            throw new Error(`Reset step failed (${key})`);
          }
          setPhase(key, 'done');
        };

        try {
          await step('stop', 'http://localhost:3001/api/config/reset/stop-services');
          await step('clean', 'http://localhost:3001/api/config/reset/clean');
          // Brief "done" state, then hand back to the app to return to the
          // wizard in place (no window reload).
          setResetStage('done');
          setTimeout(() => onResetComplete(), 1400);
        } catch (error) {
          setResetStage('error');
          showToast(`Failed to reset application: ${error}`, 'error');
        }
      },
    });
    setOpenModal(true);
  };

  // Full-screen reset progress so the user sees what's happening rather than
  // the window blanking. Covers the whole app while the reset runs.
  if (resetStage !== 'idle') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
        <div className="max-w-md w-full px-6">
          {resetStage === 'done' ? (
            <div className="text-center">
              <div className="flex justify-center mb-6"><HiCheckCircle className="w-16 h-16 text-green-500" /></div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Reset complete</h2>
              <p className="text-gray-600 dark:text-gray-400">Starting fresh setup…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Resetting your setup</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">Returning to a fresh install. Your media files are not affected.</p>
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
                  <p className="text-sm text-red-500 mb-3">Something went wrong. You can close this and try again.</p>
                  <Button color="gray" outline onClick={() => { setResetStage('idle'); setResetPhases([]); }}>
                    Close
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
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Settings</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Error</h3>
        </div>
        <div className="flex-1 p-4">
          <Alert color="red">Failed to load configuration. Please try again.</Alert>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-600 p-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Settings</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure individual services from their cards on the dashboard. These are app-wide settings.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">Appearance</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Choose how the app looks. System follows your operating system.
              </p>
            </Card.Header>
            <Card.Body>
              <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 gap-1">
                {(['light', 'dark', 'system'] as ThemePreference[]).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setPreference(opt)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                      preference === opt
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">General</h4>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Keep running in the tray when I close the window</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Ensembler stays in your menu bar / system tray for quick access. Your services keep running either way — quit fully from the tray menu.
                  </p>
                </div>
                <Toggle
                  checked={config.minimizeToTray ?? true}
                  onChange={value => setConfig(prev => ({ ...prev!, minimizeToTray: value }))}
                  aria-label="Keep running in the tray when the window is closed"
                  className="shrink-0"
                />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">Environment</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Global settings applied to all services.
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
              <h4 className="text-lg font-medium">Updates</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Ensembler checks daily for new service versions and shows what's available on the dashboard.
              </p>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Install updates automatically</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    When on, available updates are applied in the background each day. Off by default — you stay in control and apply them yourself with “Update all”.
                  </p>
                </div>
                <Toggle
                  checked={config.autoUpdate ?? false}
                  onChange={value => setConfig(prev => ({ ...prev!, autoUpdate: value }))}
                  aria-label="Install updates automatically"
                  className="shrink-0"
                />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium text-red-600 dark:text-red-400">Danger Zone</h4>
            </Card.Header>
            <Card.Body>
              <div className="flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white">Reset everything</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Removes all services and their settings, returning to a fresh install. Media files are kept.
                  </p>
                </div>
                <Button variant="danger" onClick={handleCompleteReset} className="shrink-0">
                  Reset Everything
                </Button>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-600 p-4">
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {saving ? 'Applying…' : 'Save & Apply'}
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
