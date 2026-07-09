import { useEffect, useState } from 'react';
import { Card, Button, TextInput, PathConfiguration } from './index';
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
}

const API = 'http://localhost:3001';

export default function ServiceConfigModal({ service, mode, onClose, onSaved, onToast }: ServiceConfigModalProps) {
  const [config, setConfig] = useState<CurrentConfig | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [port, setPort] = useState<number>(service.defaultPort);
  const [pathErrors, setPathErrors] = useState<string[]>([]);
  const [portError, setPortError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/api/config/current`);
        const current: CurrentConfig = res.ok ? await res.json() : { selectedServices: {}, paths: {}, ports: {}, environment: { tz: 'UTC', puid: 1000, pgid: 1000 } };
        setConfig(current);
        setPort(current.ports?.[service.key] || service.defaultPort);
        const existing = current.paths?.[service.key];
        setPaths(
          service.pathRequirements.map((field, idx) =>
            existing?.[idx] || getDefaultPath(service.key, field.label)
          )
        );
      } catch (err) {
        console.error('Failed to load current configuration:', err);
        onToast('Could not load current configuration.', 'error');
        onClose();
      }
    })();
  }, [service, onClose, onToast]);

  const validate = (): boolean => {
    const errs = service.pathRequirements.map((field, idx) =>
      field.required && !paths[idx]?.trim() ? `${field.label} is required.` : ''
    );
    setPathErrors(errs);
    if (errs.some(Boolean)) return false;
    if (port < 1024 || port > 65535) {
      setPortError('Port must be between 1024 and 65535.');
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
      const portRes = await fetch(`${API}/api/ports/validate`, {
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
        onToast(`Port ${conflict.port} was in use, so ${service.name} is on ${finalPort}.`, 'info');
      }

      const updated: CurrentConfig = {
        ...config,
        selectedServices: { ...config.selectedServices, [service.key]: true },
        paths: { ...config.paths, [service.key]: paths },
        ports: { ...config.ports, [service.key]: finalPort }
      };

      await saveAndApply(updated);
      onToast(mode === 'add' ? `${service.name} added.` : `${service.name} updated.`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      onToast(`Could not ${mode === 'add' ? 'add' : 'update'} ${service.name}: ${(err as Error).message}`, 'error');
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
      const saveRes = await fetch(`${API}/api/config/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (!saveRes.ok) throw new Error('save failed');
      const composeRes = await fetch(`${API}/api/config/generate-compose`, { method: 'POST' });
      if (!composeRes.ok) throw new Error('compose generation failed');
      onToast(`${service.name} removed. Its media files were not deleted.`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      onToast(`Could not remove ${service.name}: ${(err as Error).message}`, 'error');
      setBusy(false);
    }
  };

  // save config → regenerate compose → bring the stack up (recreates the
  // changed/added container with its new settings).
  const saveAndApply = async (updated: CurrentConfig) => {
    const saveRes = await fetch(`${API}/api/config/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (!saveRes.ok) throw new Error('save failed');
    const composeRes = await fetch(`${API}/api/config/generate-compose`, { method: 'POST' });
    if (!composeRes.ok) throw new Error('compose generation failed');
    const startRes = await fetch(`${API}/api/services/start-all`, { method: 'POST' });
    if (!startRes.ok) throw new Error('failed to start services');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {mode === 'add' ? `Add ${service.name}` : `Configure ${service.name}`}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
        </div>

        <div className="p-6 space-y-6">
          {!config ? (
            <p className="text-gray-500 dark:text-gray-400">Loading…</p>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
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
                  <span className="text-sm text-gray-500 dark:text-gray-400">Default: {service.defaultPort}</span>
                </div>
                {portError && <p className="text-sm text-red-500 mt-1">{portError}</p>}
              </div>

              {mode === 'edit' && (
                <Card className="border-l-4 border-red-500">
                  <Card.Body>
                    {!confirmingRemove ? (
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-left">Remove this service</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-left">Stops and removes {service.name}. Media files are kept.</p>
                        </div>
                        <Button color="red" outline onClick={() => setConfirmingRemove(true)} disabled={busy}>Remove</Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-red-600 dark:text-red-400 text-left">Remove {service.name} and its settings? This cannot be undone.</p>
                        <div className="flex gap-2 shrink-0">
                          <Button color="gray" outline onClick={() => setConfirmingRemove(false)} disabled={busy}>Keep</Button>
                          <Button color="red" onClick={remove} loading={busy}>Remove</Button>
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <Button color="gray" outline onClick={onClose} disabled={busy}>Cancel</Button>
          <Button color="blue" onClick={apply} loading={busy} disabled={!config}>
            {mode === 'add' ? 'Add Service' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
