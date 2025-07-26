import { useState, useEffect } from 'react';
import { Card, Button, Alert, TextInput, Select, Progress, Badge, Spinner } from './components';
import { useToast } from './contexts/ToastContext';
import { ToggleSwitch } from 'flowbite-react';

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
  'Configuration',
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
  const [paths, setPaths] = useState<{ [service: string]: string[] }>({});
  const [pathErrors, setPathErrors] = useState<{ [service: string]: string[] }>({});
  const [ports, setPorts] = useState<{[key: string]: number}>({});
  const [portErrors, setPortErrors] = useState<{[key: string]: string}>({});
  const [tz, setTz] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC'; // Fallback if timezone detection fails
    }
  });
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
        setTz(config.environment?.tz || (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return 'UTC';
          }
        })());
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

  const handleToggleAll = () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    const allServices = serviceConfig.map(service => service.key);
    
    // If all services are selected, deselect all (except required ones)
    // If not all are selected, select all
    const shouldSelectAll = selectedServices.length < allServices.length;
    
    const newSelected: { [key: string]: boolean } = {};
    serviceConfig.forEach(service => {
      // Keep required services always selected
      if (service.required) {
        newSelected[service.key] = true;
      } else {
        newSelected[service.key] = shouldSelectAll;
      }
    });
    
    setSelected(newSelected);
  };

  const getToggleAllState = () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    const selectableServices = serviceConfig.filter(service => !service.required);
    const selectedSelectableServices = selectableServices.filter(service => selected[service.key]);
    
    return selectedSelectableServices.length === selectableServices.length;
  };

  const validateServiceSelection = async () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    
    // Check that at least one service is selected
    if (selectedServices.length === 0) {
      showToast('Please select at least one service to continue.', 'warning');
      return false;
    }
    
    // Check service limit
    if (selectedServices.length > maxServices) {
      showToast(`Too many services selected. Maximum is ${maxServices} services.`, 'warning');
      return false;
    }
    
    // Frontend validation is sufficient - any service is allowed
    return true;
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
        // Validate both paths and ports in the configuration step
        await validatePaths();
        if (!validatePorts()) return;
        // Continue to next step if validations pass
        setStep((s) => Math.min(steps.length - 1, s + 1));
        return;
    }
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
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md min-w-[800px]">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dockarr Setup</h1>
      </div>
      
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
      <div className="min-h-[500px] mb-6">
        {step === 0 && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Select Services</h2>
             <p className="text-gray-600 dark:text-gray-300">Choose the services you want to run:</p>
             
             {/* Toggle All Option */}
             <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
               <div className="flex items-center justify-between">
                 <div className="flex-1">
                   <h3 className="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h3>
                   <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                     {getToggleAllState() ? 'Deselect all optional services' : 'Select all available services'}
                   </p>
                 </div>
                 <div className="flex items-center">
                   <ToggleSwitch
                     id="toggle-all-services"
                     checked={getToggleAllState()}
                     onChange={handleToggleAll}
                     label="Toggle All"
                   />
                 </div>
               </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {serviceConfig.map((service) => (
                 <Card key={service.key} className="overflow-hidden">
                   <Card.Body>
                     <div className="flex items-start justify-between">
                       <div className="flex-1 pr-4">
                         <label htmlFor={`service-${service.key}`} className="block text-lg font-medium text-gray-900 dark:text-white cursor-pointer">
                           {service.name} {service.required && <Badge color="blue">Required</Badge>}
                         </label>
                         <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{service.description}</p>
                       </div>
                       <div className="flex items-center mt-1">
                         <ToggleSwitch
                           id={`service-${service.key}`}
                           checked={!!selected[service.key]}
                           onChange={() => handleServiceChange(service.key)}
                           disabled={service.required}
                         />
                       </div>
                     </div>
                   </Card.Body>
                 </Card>
               ))}
             </div>
             <div className="text-sm text-gray-500 dark:text-gray-400">
               Select at least one service to continue. Maximum {maxServices} services.
             </div>
           </div>
        )}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Service Configuration</h2>
              <p className="text-gray-600 dark:text-gray-300">Configure file paths and ports for your services:</p>
            </div>
            <div className="space-y-6">
              {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
                const service = serviceConfig.find(s => s.key === svc);
                if (!service) return null;
                
                return (
                  <Card key={svc} className="border-l-4 border-blue-500">
                    <Card.Header>
                      <h3 className="text-xl font-medium text-gray-900 dark:text-white">{service.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
                    </Card.Header>
                    <Card.Body>
                      {/* Check if service has paths to determine layout */}
                      {service.pathRequirements && service.pathRequirements.length > 0 ? (
                        /* Services with paths: Two-column layout */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* File Paths Column */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">Paths</span>
                              <h4 className="text-lg font-medium text-gray-800 dark:text-white">File Paths</h4>
                            </div>
                            {service.pathRequirements.map((field, idx) => (
                              <div key={idx} className="space-y-2">
                                <label htmlFor={`path-${svc}-${idx}`} className="block text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <div className="flex gap-2">
                                  <TextInput
                                    id={`path-${svc}-${idx}`}
                                    type="text"
                                    value={paths[svc]?.[idx] || './'}
                                    onChange={e => handlePathChange(svc, idx, e.target.value)}
                                    placeholder={field.description}
                                    color={pathErrors[svc]?.[idx] ? 'failure' : 'gray'}
                                    className="flex-1"
                                  />
                                  <Button 
                                    onClick={() => handleBrowse(svc, idx)} 
                                    color="gray"
                                    size="sm"
                                  >
                                    Browse
                                  </Button>
                                </div>
                                <p className="text-left text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
                                {pathErrors[svc]?.[idx] && (
                                  <Alert color="red">{pathErrors[svc][idx]}</Alert>
                                )}
                              </div>
                            ))}
                          </div>
                          
                          {/* Port Configuration Column */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm font-medium">Port</span>
                              <h4 className="text-lg font-medium text-gray-800 dark:text-white">Port Configuration</h4>
                            </div>
                            <div className="space-y-2">
                              <label htmlFor={`port-${svc}`} className="block text-sm font-medium text-left text-gray-700 dark:text-gray-300">
                                {service.name} Port:
                              </label>
                              <TextInput
                                id={`port-${svc}`}
                                type="number"
                                value={String(ports[svc] || service.defaultPort)}
                                onChange={(e) => handlePortChange(svc, parseInt(e.target.value))}
                                color={portErrors[svc] ? 'failure' : 'gray'}
                                className="w-32"
                              />
                              <p className="text-left text-xs text-gray-500 dark:text-gray-400">
                                Default: {service.defaultPort}
                              </p>
                              {portErrors[svc] && (
                                <Alert color="red">{portErrors[svc]}</Alert>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Services without paths: Consistent two-column layout with left alignment */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {/* Information Column (replaces File Paths) */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-sm font-medium">Info</span>
                              <h4 className="text-lg font-medium text-gray-800 dark:text-white">Service Information</h4>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="text-blue-600 dark:text-blue-400 text-2xl">📌</div>
                                <div>
                                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                                    No file paths required
                                  </p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    This service doesn't require any file path configuration.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Port Configuration Column */}
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                              <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm font-medium">Port</span>
                              <h4 className="text-lg font-medium text-gray-800 dark:text-white">Port Configuration</h4>
                            </div>
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
                                className="w-32"
                              />
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Default: {service.defaultPort}
                              </p>
                              {portErrors[svc] && (
                                <Alert color="red">{portErrors[svc]}</Alert>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
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