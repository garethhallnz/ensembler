import { useState, useEffect } from 'react';

interface ServiceConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultPort: number;
  pathRequirements: { label: string; required: boolean; description: string }[];
  required: boolean;
}

interface ServiceConfigResponse {
  success: boolean;
  services: ServiceConfig[];
  maxServices: number;
}

const steps = [
  'Service Selection',
  'File Paths',
  'Ports',
  'Environment',
  'Summary',
];

interface SetupWizardProps {
  onComplete: () => void;
  isRerun?: boolean;
}

export default function SetupWizard({ onComplete, isRerun = false }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [paths, setPaths] = useState<{ [service: string]: string[] }>({});
  const [pathErrors, setPathErrors] = useState<{ [service: string]: string[] }>({});
  const [ports, setPorts] = useState<{[key: string]: number}>({});
  const [portErrors, setPortErrors] = useState<{[key: string]: string}>({});
  const [tz, setTz] = useState('UTC');
  const [puid, setPuid] = useState(1000);
  const [pgid, setPgid] = useState(1000);
  const [envErrors, setEnvErrors] = useState<{[key: string]: string}>({});
  const [isSaving, setIsSaving] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig[]>([]);
  const [maxServices, setMaxServices] = useState(6);
  const [loading, setLoading] = useState(true);

  // Load service configuration on mount
  useEffect(() => {
    loadServiceConfiguration();
  }, []);

  // Load existing configuration if this is a re-run
  useEffect(() => {
    if (isRerun && serviceConfig.length > 0) {
      loadExistingConfiguration();
    }
  }, [isRerun, serviceConfig]);

  const loadServiceConfiguration = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/config');
      if (res.ok) {
        const data: ServiceConfigResponse = await res.json();
        if (data.success) {
          setServiceConfig(data.services);
          setMaxServices(data.maxServices);
          
          // Initialize default ports
          const defaultPorts: { [key: string]: number } = {};
          data.services.forEach(service => {
            defaultPorts[service.key] = service.defaultPort;
          });
          setPorts(defaultPorts);
        }
      }
    } catch (error) {
      console.error('Error loading service configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingConfiguration = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/config/current');
      if (res.ok) {
        const config = await res.json();
        setSelected(config.selectedServices || {});
        setPaths(config.paths || {});
        setPorts(prev => ({ ...prev, ...config.ports }));
        setTz(config.environment?.tz || 'UTC');
        setPuid(config.environment?.puid || 1000);
        setPgid(config.environment?.pgid || 1000);
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
    }
  };

  const handleServiceChange = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const validateServiceSelection = async () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    
    // Check service limit
    if (selectedServices.length > maxServices) {
      setError(`Too many services selected. Maximum is ${maxServices} services.`);
      return false;
    }
    
    // Use backend validation
    try {
      const res = await fetch('http://localhost:3001/api/services/validate-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedServices }),
      });
      
      const data = await res.json();
      if (!data.success) {
        setError(data.message);
        return false;
      }
      
      setError(null);
      return true;
    } catch (error) {
      setError('Error validating service selection');
      return false;
    }
  };

  const validatePaths = async () => {
    const newErrors: { [service: string]: string[] } = {};
    let allPaths: string[] = [];
    Object.keys(selected).forEach((svc) => {
        if (!selected[svc]) return;
        const service = serviceConfig.find(s => s.key === svc);
        if (!service) return;
        
        const fields = service.pathRequirements || [];
        fields.forEach((field, idx) => {
            const val = paths[svc]?.[idx] || '';
            if (field.required && val.trim()) {
                allPaths.push(val.trim());
            }
        });
    });

    if (allPaths.length === 0) {
        setStep((s) => Math.min(steps.length - 1, s + 1));
        return;
    }

    const res = await fetch('http://localhost:3001/api/paths/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: allPaths }),
    });

    if (res.ok) {
        setPathErrors({});
        setStep((s) => Math.min(steps.length - 1, s + 1));
    } else {
        const data = await res.json();
        const errors: { [service: string]: string[] } = {};
        data.results.forEach((result: any) => {
            if (!result.valid) {
                Object.keys(paths).forEach(svc => {
                    const pathIndex = paths[svc].indexOf(result.path);
                    if (pathIndex !== -1) {
                        if (!errors[svc]) errors[svc] = [];
                        errors[svc][pathIndex] = result.error;
                    }
                });
            }
        });
        setPathErrors(errors);
    }
  };

  const validatePorts = () => {
    const newErrors: {[key: string]: string} = {};
    let valid = true;
    const usedPorts = new Set<number>();

    Object.keys(selected).forEach(svc => {
      if (!selected[svc]) return;
      const service = serviceConfig.find(s => s.key === svc);
      if (!service) return;
      
      const port = ports[svc] || service.defaultPort;
      if (port < 1024 || port > 65535) {
        newErrors[svc] = 'Port must be between 1024 and 65535.';
        valid = false;
      } else if (usedPorts.has(port)) {
        newErrors[svc] = 'Port conflicts with another selected service.';
        valid = false;
      } else {
        usedPorts.add(port);
      }
    });
    setPortErrors(newErrors);
    return valid;
  };

  const handlePathChange = (svc: string, idx: number, value: string) => {
    const service = serviceConfig.find(s => s.key === svc);
    if (!service) return;
    
    setPaths((prev) => ({
      ...prev,
      [svc]: prev[svc]?.map((v, i) => (i === idx ? value : v)) || service.pathRequirements.map((_, i) => (i === idx ? value : '')),
    }));
  };

  const handlePortChange = (svc: string, value: number) => {
    setPorts((prev) => ({ ...prev, [svc]: value }));
  };

  const handleBrowse = async (svc: string, idx: number) => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        const path = await handle.resolve(handle);
        if (path) {
            handlePathChange(svc, idx, path.join('/'));
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      alert('File system access API is not supported in your browser.');
    }
  };

  const validateEnvironment = () => {
    const newErrors: {[key: string]: string} = {};
    let valid = true;

    if (!tz.trim()) {
      newErrors.tz = 'Timezone is required.';
      valid = false;
    }

    if (isNaN(puid) || puid < 0) {
      newErrors.puid = 'PUID must be a non-negative number.';
      valid = false;
    }

    if (isNaN(pgid) || pgid < 0) {
      newErrors.pgid = 'PGID must be a non-negative number.';
      valid = false;
    }

    setEnvErrors(newErrors);
    return valid;
  };

  const handleNext = async () => {
    if (step === 0 && !(await validateServiceSelection())) return;
    if (step === 1) {
        await validatePaths();
        return;
    }
    if (step === 2 && !validatePorts()) return;
    if (step === 3 && !validateEnvironment()) return;
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const handleSaveAndApply = async () => {
    setIsSaving(true);
    try {
      const config = {
        selectedServices: selected,
        paths: paths,
        ports: ports,
        environment: {
          tz: tz,
          puid: puid,
          pgid: pgid,
        },
      };

      // Save configuration
      const saveRes = await fetch('http://localhost:3001/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save configuration');
      }

      // Generate docker-compose.yml
      const composeRes = await fetch('http://localhost:3001/api/config/generate-compose', {
        method: 'POST',
      });

      if (!composeRes.ok) {
        throw new Error('Failed to generate docker-compose files');
      }

      alert('Configuration saved and applied successfully!');
      onComplete();
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 700, margin: '2rem auto', padding: 32, textAlign: 'center' }}>
        <div>Loading service configuration...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', padding: 32, border: '1px solid #eee', borderRadius: 8 }}>
      <h1>Media Center Setup Wizard</h1>
      <div style={{ margin: '16px 0', fontWeight: 500 }}>
        Step {step + 1} of {steps.length}: {steps[step]}
      </div>
      <div style={{ minHeight: 200 }}>
        {step === 0 && (
          <div>
            <h2>Select services to configure:</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '16px 0' }}>
              {serviceConfig.map((svc) => (
                <label key={svc.key} style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={!!selected[svc.key]}
                    onChange={() => handleServiceChange(svc.key)}
                  />{' '}
                  <strong>{svc.name}</strong> - {svc.description}
                  {svc.required && <span style={{ color: '#c00' }}> (Required)</span>}
                </label>
              ))}
            </div>
            {error && <div style={{ color: '#c00', marginTop: 8 }}>{error}</div>}
            <div style={{ color: '#555', fontSize: 14, marginTop: 8 }}>
              At least <b>Sonarr</b> or <b>Radarr</b> must be selected. Maximum {maxServices} services.
            </div>
          </div>
        )}
        {step === 1 && (
          <div>
            <h2>Set file paths for each selected service:</h2>
            {Object.keys(selected).filter((svc) => selected[svc]).length === 0 && <div>No services selected.</div>}
            {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
              const service = serviceConfig.find(s => s.key === svc);
              if (!service) return null;
              
              return (
                <div key={svc} style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 4 }}>{service.name}</h3>
                  {service.pathRequirements.map((field, idx) => (
                    <div key={idx} style={{ marginBottom: 4 }}>
                      <label>
                        {field.label}:
                        <input
                          type="text"
                          value={paths[svc]?.[idx] || ''}
                          onChange={e => handlePathChange(svc, idx, e.target.value)}
                          style={{ marginLeft: 8, width: 300 }}
                          placeholder={field.description}
                        />
                        <button onClick={() => handleBrowse(svc, idx)} style={{ marginLeft: 8 }}>Browse</button>
                        {field.required && <span style={{ color: '#c00' }}> *</span>}
                      </label>
                      {pathErrors[svc]?.[idx] && (
                        <span style={{ color: '#c00', marginLeft: 8 }}>{pathErrors[svc][idx]}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        {step === 2 && (
          <div>
            <h2>Set ports for each selected service:</h2>
            {Object.keys(selected).filter((svc) => selected[svc]).length === 0 && <div>No services selected.</div>}
            {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
              const service = serviceConfig.find(s => s.key === svc);
              if (!service) return null;
              
              return (
                <div key={svc} style={{ marginBottom: 16 }}>
                  <h3 style={{ marginBottom: 4 }}>{service.name}</h3>
                  <label>
                    Port:
                    <input
                      type="number"
                      value={ports[svc] || service.defaultPort}
                      onChange={e => handlePortChange(svc, parseInt(e.target.value))}
                      style={{ marginLeft: 8, width: 100 }}
                    />
                    <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>
                      (Default: {service.defaultPort})
                    </span>
                  </label>
                  {portErrors[svc] && (
                    <span style={{ color: '#c00', marginLeft: 8 }}>{portErrors[svc]}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {step === 3 && (
          <div>
            <h2>Set environment variables:</h2>
            <div style={{ marginBottom: 16 }}>
              <label>
                Timezone (TZ):
                <input
                  type="text"
                  value={tz}
                  onChange={e => setTz(e.target.value)}
                  style={{ marginLeft: 8, width: 200 }}
                  placeholder="e.g., America/New_York"
                />
              </label>
              {envErrors.tz && (
                <span style={{ color: '#c00', marginLeft: 8 }}>{envErrors.tz}</span>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>
                User ID (PUID):
                <input
                  type="number"
                  value={puid}
                  onChange={e => setPuid(parseInt(e.target.value))}
                  style={{ marginLeft: 8, width: 100 }}
                />
              </label>
              {envErrors.puid && (
                <span style={{ color: '#c00', marginLeft: 8 }}>{envErrors.puid}</span>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label>
                Group ID (PGID):
                <input
                  type="number"
                  value={pgid}
                  onChange={e => setPgid(parseInt(e.target.value))}
                  style={{ marginLeft: 8, width: 100 }}
                />
              </label>
              {envErrors.pgid && (
                <span style={{ color: '#c00', marginLeft: 8 }}>{envErrors.pgid}</span>
              )}
            </div>
          </div>
        )}
        {step === 4 && (
          <div>
            <h2>Summary:</h2>
            <h3>Selected Services:</h3>
            <ul>
              {Object.keys(selected).filter(svc => selected[svc]).map(svc => (
                <li key={svc}>{SERVICE_LIST.find(s => s.key === svc)?.label}</li>
              ))}
            </ul>

            <h3>File Paths:</h3>
            {Object.keys(selected).filter(svc => selected[svc]).map(svc => (
              <div key={svc}>
                <h4>{SERVICE_LIST.find(s => s.key === svc)?.label}</h4>
                <ul>
                  {(PATH_FIELDS[svc] || []).map((field, idx) => (
                    <li key={idx}>{field.label}: {paths[svc]?.[idx] || 'N/A'}</li>
                  ))}
                </ul>
              </div>
            ))}

            <h3>Ports:</h3>
            <ul>
              {Object.keys(selected).filter(svc => selected[svc]).map(svc => (
                <li key={svc}>{SERVICE_LIST.find(s => s.key === svc)?.label}: {ports[svc] || DEFAULT_PORTS[svc]}</li>
              ))}
            </ul>

            <h3>Environment Variables:</h3>
            <ul>
              <li>TZ: {tz}</li>
              <li>PUID: {puid}</li>
              <li>PGID: {pgid}</li>
            </ul>
            <button onClick={handleSaveAndApply} disabled={isSaving}>
              {isSaving ? 'Saving and Applying...' : 'Save and Apply'}
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: 32, display: 'flex', gap: 16 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        <button onClick={handleNext} disabled={step === steps.length - 1 && step !== steps.length - 1}>Next</button>
      </div>
    </div>
  );
} 