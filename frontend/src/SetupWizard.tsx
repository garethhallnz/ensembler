import { useState, useEffect } from 'react';
import { Card, Button, Alert, TextInput, Select, Progress, Badge, Spinner } from './components';
import { useToast } from './contexts/ToastContext';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

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
  const { showToast } = useToast();
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
                setError(data.message ?? 'An unknown error occurred');
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
    const allPaths: string[] = [];
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
        interface PathValidateResult {
            path: string;
            valid: boolean;
            error?: string;
        }
        const data: { success: boolean; results: PathValidateResult[] } = await res.json();
        const errors: { [service: string]: string[] } = {};
        data.results.forEach((result) => {
            if (!result.valid) {
                Object.keys(paths).forEach(svc => {
                    const pathIndex = paths[svc].indexOf(result.path);
                    if (pathIndex !== -1) {
                        if (!errors[svc]) errors[svc] = [];
                        errors[svc][pathIndex] = result.error || '';
                    }
                });
            }
        });
        setPathErrors(errors);
    }
  };

  const validatePorts = () => {
    const currentPortErrors: {[key: string]: string} = {};
    let valid = true;
    const usedPorts = new Set<number>();

    Object.keys(selected).forEach(svc => {
      if (!selected[svc]) return;
      const service = serviceConfig.find(s => s.key === svc);
      if (!service) return;
      
      const port = ports[svc] || service.defaultPort;
      if (port < 1024 || port > 65535) {
        currentPortErrors[svc] = 'Port must be between 1024 and 65535.';
        valid = false;
      } else if (usedPorts.has(port)) {
        currentPortErrors[svc] = 'Port conflicts with another selected service.';
        valid = false;
      } else {
        usedPorts.add(port);
      }
    });
    setPortErrors(currentPortErrors);
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
    if ('showDirectoryPicker' in window && window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        const path = await handle.resolve(handle);
        if (path) {
            handlePathChange(svc, idx, path.join('/'));
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      showToast('File system access API is not supported in your browser.', 'warning');
    }
  };

  const validateEnvironment = () => {
    const currentEnvErrors: {[key: string]: string} = {};
    let valid = true;

    if (!tz.trim()) {
      currentEnvErrors.tz = 'Timezone is required.';
      valid = false;
    }

    if (isNaN(puid) || puid < 0) {
      currentEnvErrors.puid = 'PUID must be a non-negative number.';
      valid = false;
    }

    if (isNaN(pgid) || pgid < 0) {
      currentEnvErrors.pgid = 'PGID must be a non-negative number.';
      valid = false;
    }

    setEnvErrors(currentEnvErrors);
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

      showToast('Configuration saved and applied successfully!', 'success');
      onComplete();
    } catch (error) {
      console.error('Error saving configuration:', error);
      showToast('Failed to save configuration. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md w-full p-6">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg text-gray-700 dark:text-gray-300">Loading service configuration...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">Media Center Setup</h1>
      
      <div className="mb-8">
        <Progress
          progress={((step + 1) / steps.length) * 100}
          size="lg"
          color="blue"
          
        />
        
        <div className="flex justify-between mt-2">
          {steps.map((stepName, idx) => (
            <div 
              key={idx} 
              className={`text-sm cursor-pointer ${idx === step ? 'font-bold text-blue-600' : idx < step ? 'text-green-600' : 'text-gray-500'}`}
              onClick={() => idx < step && setStep(idx)}
            >
              {stepName}
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-[400px] mb-6">
        {step === 0 && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Select Services</h2>
             <p className="text-gray-600 dark:text-gray-300">Choose the services you want to run:</p>
             {error && <Alert color="red">{error}</Alert>}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {serviceConfig.map((service) => (
                 <Card key={service.key} className="overflow-hidden">
                   <Card.Body>
                     <div className="flex items-start space-x-3">
                       <div className="flex items-center h-5 mt-1">
                         <input
                           id={`service-${service.key}`}
                           type="checkbox"
                           checked={!!selected[service.key]}
                           onChange={() => handleServiceChange(service.key)}
                           disabled={service.required}
                           className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                         />
                       </div>
                       <div className="flex-1">
                         <label htmlFor={`service-${service.key}`} className="block text-lg font-medium text-gray-900 dark:text-white cursor-pointer">
                           {service.name} {service.required && <Badge color="blue">Required</Badge>}
                         </label>
                         <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
                       </div>
                     </div>
                   </Card.Body>
                 </Card>
               ))}
             </div>
             <div className="text-sm text-gray-500 dark:text-gray-400">
               At least <span className="font-semibold">Sonarr</span> or <span className="font-semibold">Radarr</span> must be selected. Maximum {maxServices} services.
             </div>
           </div>
        )}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Configure File Paths</h2>
            <p className="text-gray-600 dark:text-gray-300">Set the file paths for your media:</p>
            {Object.keys(selected).filter((svc) => selected[svc]).length === 0 && 
              <Alert color="blue">No services selected. Please go back and select services first.</Alert>
            }
            <div className="space-y-8">
              {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
                const service = serviceConfig.find(s => s.key === svc);
                if (!service) return null;
                
                return (
                  <Card key={svc}>
                    <Card.Header>
                      <h3 className="text-xl font-medium">{service.name}</h3>
                    </Card.Header>
                    <Card.Body className="space-y-4">
                      {service.pathRequirements.map((field, idx) => (
                        <div key={idx} className="space-y-2">
                          <label htmlFor={`path-${svc}-${idx}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <div className="flex">
                            <TextInput
                              id={`path-${svc}-${idx}`}
                              type="text"
                              value={paths[svc]?.[idx] || ''}
                              onChange={e => handlePathChange(svc, idx, e.target.value)}
                              placeholder={field.description}
                              color={pathErrors[svc]?.[idx] ? 'failure' : 'gray'}
                              className="flex-grow"
                            />
                            <Button 
                              onClick={() => handleBrowse(svc, idx)} 
                              className="ml-2"
                              color="gray"
                            >
                              Browse
                            </Button>
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{field.description}</div>
                          {pathErrors[svc]?.[idx] && (
                            <Alert color="red" className="mt-2">{pathErrors[svc][idx]}</Alert>
                          )}
                        </div>
                      ))}
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Configure Ports</h2>
            <p className="text-gray-600 dark:text-gray-300">Set the ports for your services:</p>
            {Object.keys(selected).filter((svc) => selected[svc]).length === 0 && 
              <Alert color="blue">No services selected. Please go back and select services first.</Alert>
            }
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
                const service = serviceConfig.find(s => s.key === svc);
                if (!service) return null;
                
                return (
                  <Card key={svc}>
                    <Card.Body>
                      <div className="space-y-2">
                        <label htmlFor={`port-${svc}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {service.name} Port:
                        </label>
                        <TextInput
                          id={`port-${svc}`}
                          type="number"
                          value={String(ports[svc] || service.defaultPort)}
                          onChange={(e) => handlePortChange(svc, parseInt(e.target.value))}
                      color={portErrors[svc] ? 'failure' : 'gray'}
                    />
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Default: {service.defaultPort}
                        </div>
                        {portErrors[svc] && (
                          <Alert color="red" className="mt-2">{portErrors[svc]}</Alert>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        {step === 3 && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Environment Settings</h2>
             <Card>
               <Card.Body className="space-y-4">
                 <div className="space-y-2">
                   <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                     Timezone (TZ):
                   </label>
                   <Select
                     id="timezone"
                     value={tz}
                     onChange={(e) => setTz(e.target.value)}
                     color={envErrors.tz ? 'failure' : 'gray'}
                   >
                     <option value="UTC">UTC</option>
                     <option value="America/New_York">Eastern Time</option>
                     <option value="America/Chicago">Central Time</option>
                     <option value="America/Denver">Mountain Time</option>
                     <option value="America/Los_Angeles">Pacific Time</option>
                     <option value="Europe/London">London</option>
                     <option value="Europe/Paris">Paris</option>
                     <option value="Asia/Tokyo">Tokyo</option>
                     <option value="Australia/Sydney">Sydney</option>
                   </Select>
                   {envErrors.tz && <Alert color="red" className="mt-2">{envErrors.tz}</Alert>}
                 </div>
                 <div className="space-y-2">
                   <label htmlFor="puid" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                     User ID (PUID):
                   </label>
                   <TextInput
                     id="puid"
                     type="number"
                     value={String(puid)}
                     onChange={(e) => setPuid(parseInt(e.target.value, 10))}
                     color={envErrors.puid ? 'failure' : 'gray'}
                   />
                   {envErrors.puid && <Alert color="red" className="mt-2">{envErrors.puid}</Alert>}
                 </div>
                 <div className="space-y-2">
                   <label htmlFor="pgid" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                     Group ID (PGID):
                   </label>
                   <TextInput
                     id="pgid"
                     type="number"
                     value={String(pgid)}
                     onChange={(e) => setPgid(parseInt(e.target.value, 10))}
                     color={envErrors.pgid ? 'failure' : 'gray'}
                   />
                   {envErrors.pgid && <Alert color="red" className="mt-2">{envErrors.pgid}</Alert>}
                 </div>
               </Card.Body>
             </Card>
           </div>
          )}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Summary</h2>
            <Card>
              <Card.Header>
                <h3 className="text-xl font-medium">Selected Services</h3>
              </Card.Header>
              <Card.Body>
                <ul className="space-y-2">
                  {Object.keys(selected).filter(key => selected[key]).map((key) => {
                    const service = serviceConfig.find(s => s.key === key);
                    return (
                      <li key={key} className="flex items-center space-x-2">
                        <Badge color="blue">Service</Badge>
                        <span>{service?.name} (Port: {ports[key] || service?.defaultPort})</span>
                      </li>
                    );
                  })}
                </ul>
              </Card.Body>
            </Card>
            
            <Card>
              <Card.Header>
                <h3 className="text-xl font-medium">File Paths</h3>
              </Card.Header>
              <Card.Body>
                <div className="space-y-4">
                  {Object.keys(paths).map((svc) => {
                    const service = serviceConfig.find(s => s.key === svc);
                    return (
                      <div key={svc} className="space-y-2">
                        <h4 className="font-medium text-gray-800 dark:text-white">{service?.name}:</h4>
                        <ul className="pl-5 space-y-1 list-disc">
                          {paths[svc].map((path, idx) => {
                            if (!path) return null;
                            const field = service?.pathRequirements[idx];
                            return (
                              <li key={`${svc}-${idx}`} className="text-gray-600 dark:text-gray-300">
                                <span className="font-medium">{field?.label}:</span> {path}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
            
            <Card>
              <Card.Header>
                <h3 className="text-xl font-medium">Environment</h3>
              </Card.Header>
              <Card.Body>
                <ul className="space-y-2">
                  <li className="flex items-center space-x-2">
                    <Badge color="purple">Timezone</Badge>
                    <span>{tz}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Badge color="purple">PUID</Badge>
                    <span>{puid}</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Badge color="purple">PGID</Badge>
                    <span>{pgid}</span>
                  </li>
                </ul>
              </Card.Body>
            </Card>
            <Button onClick={handleSaveAndApply} loading={isSaving}>
              Save and Apply
            </Button>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-6">
        {step > 0 ? (
          <Button color="gray" onClick={() => setStep(s => Math.max(0, s - 1))}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Button>
        ) : (
          (<></> /* Empty div to maintain flex layout */)
        )}
        {step < steps.length - 1 && (
          <Button color="blue" onClick={handleNext}>
            Next
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}