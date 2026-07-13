import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { apiFetch } from '../requests/client';
import Button from './Button';
import TextInput from './TextInput';
import Select from './Select';
import PathConfiguration from './PathConfiguration';
import { getDefaultPath } from '../utils/pathDefaults';

interface PathField {
  label: string;
  required: boolean;
  description: string;
}

export interface ServiceCatalogEntry {
  key: string;
  name: string;
  description: string;
  defaultPort: number;
  pathRequirements: PathField[];
}

interface ServiceConfigModalProps {
  service: ServiceCatalogEntry;
  // 'edit' configures an already-enabled service; 'add' enables a new one.
  mode: 'edit' | 'add';
  onClose: () => void;
  onSaved: () => void;
  onToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface CurrentConfig {
  selectedServices: { [key: string]: boolean };
  paths: { [key: string]: string[] };
  ports: { [key: string]: number };
  environment: { tz: string; puid: number; pgid: number };
  // Optional per-service pinned image tag; absent/empty means "latest".
  versions?: { [key: string]: string };
}


export default function ServiceConfigModal({ service, mode, onClose, onSaved, onToast }: ServiceConfigModalProps) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<CurrentConfig | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [port, setPort] = useState<number>(service.defaultPort);
  const [version, setVersion] = useState('');
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [pathErrors, setPathErrors] = useState<string[]>([]);
  const [portError, setPortError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch(`/api/config/current`);
        const current: CurrentConfig = res.ok ? await res.json() : { selectedServices: {}, paths: {}, ports: {}, environment: { tz: 'UTC', puid: 1000, pgid: 1000 } };
        setConfig(current);
        setPort(current.ports?.[service.key] || service.defaultPort);
        setVersion(current.versions?.[service.key] ?? '');
        const existing = current.paths?.[service.key];
        setPaths(
          service.pathRequirements.map((field, idx) =>
            existing?.[idx] || getDefaultPath(service.key, field.label)
          )
        );
      } catch (err) {
        console.error('Failed to load current configuration:', err);
        onToast(t('serviceConfig.loadError'), 'error');
        onClose();
      }
    })();
  }, [service, onClose, onToast]);

  useEffect(() => {
    let active = true;
    setVersionsLoading(true);
    (async () => {
      try {
        const res = await apiFetch(`/api/services/${service.key}/versions`);
        const data = res.ok ? await res.json() : { versions: [] };
        if (active) setAvailableVersions(data.versions ?? []);
      } catch {
        if (active) setAvailableVersions([]);
      } finally {
        if (active) setVersionsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [service.key]);

  const validate = (): boolean => {
    const errs = service.pathRequirements.map((field, idx) =>
      field.required && !paths[idx]?.trim()
        ? t('serviceConfig.fieldRequired', { label: t(`services.${service.key}.paths.${idx}.label`) })
        : ''
    );
    setPathErrors(errs);
    if (errs.some(Boolean)) return false;
    if (port < 1024 || port > 65535) {
      setPortError(t('setup.errors.portRange'));
      return false;
    }
    setPortError(null);
    return true;
  };

  const apply = async () => {
    if (!config || !validate()) return;
    setBusy(true);
    try {
      // Reroute the port if something else on the host holds it (the check
      // excludes this service's own container, so an unchanged port is fine).
      const portRes = await apiFetch(`/api/ports/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports: { [service.key]: port } })
      });
      const portData = await portRes.json();
      let finalPort = port;
      const conflict = (portData.conflicts || [])[0];
      if (conflict?.suggestion) {
        finalPort = conflict.suggestion;
        setPort(finalPort);
        onToast(t('serviceConfig.portRerouted', { port: conflict.port, name: service.name, finalPort }), 'info');
      }

      const pinnedTag = version.trim();
      const versions = { ...config.versions };
      if (pinnedTag) versions[service.key] = pinnedTag;
      else delete versions[service.key];

      const updated: CurrentConfig = {
        ...config,
        selectedServices: { ...config.selectedServices, [service.key]: true },
        paths: { ...config.paths, [service.key]: paths },
        ports: { ...config.ports, [service.key]: finalPort },
        versions
      };

      await saveAndApply(updated);
      onToast(mode === 'add' ? t('serviceConfig.serviceAdded', { name: service.name }) : t('serviceConfig.serviceUpdated', { name: service.name }), 'success');
      onSaved();
      onClose();
    } catch (err) {
      onToast(mode === 'add'
        ? t('serviceConfig.addFailed', { name: service.name, message: (err as Error).message })
        : t('serviceConfig.updateFailed', { name: service.name, message: (err as Error).message }), 'error');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!config) return;
    setBusy(true);
    try {
      const updated: CurrentConfig = {
        ...config,
        selectedServices: { ...config.selectedServices, [service.key]: false }
      };
      // Saving with the service disabled makes the backend stop and remove its
      // container; regenerate compose so it's gone from the stack.
      const saveRes = await apiFetch(`/api/config/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!saveRes.ok) throw new Error('save failed');
      const composeRes = await apiFetch(`/api/config/generate-compose`, { method: 'POST' });
      if (!composeRes.ok) throw new Error('compose generation failed');
      onToast(t('serviceConfig.serviceRemoved', { name: service.name }), 'success');
      onSaved();
      onClose();
    } catch (err) {
      onToast(t('serviceConfig.removeFailed', { name: service.name, message: (err as Error).message }), 'error');
      setBusy(false);
    }
  };

  // save config → regenerate compose → bring the stack up (recreates the
  // changed/added container with its new settings).
  const saveAndApply = async (updated: CurrentConfig) => {
    const saveRes = await apiFetch(`/api/config/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (!saveRes.ok) throw new Error('save failed');
    const composeRes = await apiFetch(`/api/config/generate-compose`, { method: 'POST' });
    if (!composeRes.ok) throw new Error('compose generation failed');
    const startRes = await apiFetch(`/api/services/start-all`, { method: 'POST' });
    if (!startRes.ok) throw new Error('failed to start services');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {mode === 'add' ? t('serviceConfig.addTitle', { name: service.name }) : t('serviceConfig.configureTitle', { name: service.name })}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t(`services.${service.key}.description`)}</p>
        </div>

        <div className="p-6 space-y-6">
          {!config ? (
            <p className="text-gray-500 dark:text-gray-400">{t('serviceConfig.loading')}</p>
          ) : confirmingRemove ? (
            // Removing turns the whole modal into a focused confirmation rather
            // than an inline widget competing with the config fields.
            <div className="text-center py-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
                <span className="text-2xl">⚠️</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('serviceConfig.removeConfirmTitle', { name: service.name })}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
                {t('serviceConfig.removeConfirmBody', { name: service.name })}
              </p>
            </div>
          ) : (
            <>
              {service.pathRequirements.length > 0 && (
                <PathConfiguration
                  serviceKey={service.key}
                  serviceName={service.name}
                  pathRequirements={service.pathRequirements}
                  paths={paths}
                  pathErrors={pathErrors}
                  onPathChange={(idx, value) => setPaths(prev => prev.map((p, i) => (i === idx ? value : p)))}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('serviceConfig.portLabel')}</label>
                <div className="flex items-center gap-2">
                  <div className="max-w-[140px]">
                    <TextInput
                      type="number"
                      value={String(port)}
                      onChange={e => setPort(Number(e.target.value))}
                      color={portError ? 'failure' : 'gray'}
                      min={1024}
                      max={65535}
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('serviceConfig.defaultPort', { port: service.defaultPort })}</span>
                </div>
                {portError && <p className="text-sm text-red-500 mt-1">{portError}</p>}
              </div>

              <div>
                <label htmlFor={`${service.key}-version`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('serviceConfig.versionLabel')}</label>
                <div className="max-w-[260px]">
                  <Select
                    id={`${service.key}-version`}
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    disabled={versionsLoading}
                  >
                    <option value="">{versionsLoading ? t('serviceConfig.loadingVersions') : t('serviceConfig.latestRecommended')}</option>
                    {/* Keep the current pin visible even if it's older than the fetched list. */}
                    {version && !availableVersions.includes(version) && <option value={version}>{version}</option>}
                    {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
                  </Select>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <Trans i18nKey="serviceConfig.versionHelp">Keep <strong>Latest</strong> to always run the newest version. Pin a specific version to hold it there — pinned services won't offer updates.</Trans>
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div>
            {mode === 'edit' && !confirmingRemove && (
              <Button color="red" outline onClick={() => setConfirmingRemove(true)} disabled={busy}>
                {t('serviceConfig.removeService')}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {confirmingRemove ? (
              <>
                <Button color="gray" outline onClick={() => setConfirmingRemove(false)} disabled={busy}>{t('serviceConfig.keep')}</Button>
                <Button color="red" onClick={remove} loading={busy}>{t('serviceConfig.removeNamed', { name: service.name })}</Button>
              </>
            ) : (
              <>
                <Button color="gray" outline onClick={onClose} disabled={busy}>{t('serviceConfig.cancel')}</Button>
                <Button color="blue" onClick={apply} loading={busy} disabled={!config}>
                  {mode === 'add' ? t('serviceConfig.addService') : t('serviceConfig.saveChanges')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
