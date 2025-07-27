import { useState, useEffect } from 'react';
import { Card, Button, Alert, TextInput, Select, Progress, Badge, Spinner, ServiceConfiguration, EnvironmentSettings } from './components';
import { useToast } from './contexts/ToastContext';
import { ToggleSwitch } from 'flowbite-react';
import { getDefaultPath } from './utils/pathDefaults';

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
          const defaultSelected: { [key: string]: boolean } = {};
          const defaultPaths: { [service: string]: string[] } = {};
          
          data.services.forEach(service => {
            defaultPorts[service.key] = service.defaultPort;
            
            // Auto-select required services and initialize their default paths
            if (service.required) {
              defaultSelected[service.key] = true;
              if (service.pathRequirements && service.pathRequirements.length > 0) {
                defaultPaths[service.key] = service.pathRequirements.map(field => 
                  getDefaultPath(service.key, field.label)
                );
              }
            }
          });
          
          setPorts(defaultPorts);
          setSelected(prev => ({ ...defaultSelected, ...prev }));
          setPaths(prev => ({ ...defaultPaths, ...prev }));
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
    const newSelected = { ...selected, [key]: !selected[key] };
    setSelected(newSelected);
    
    // Initialize default paths for newly selected services
    if (newSelected[key]) {
      const service = serviceConfig.find(s => s.key === key);
      if (service?.pathRequirements && service.pathRequirements.length > 0) {
        setPaths(prev => ({
          ...prev,
          [key]: service.pathRequirements.map((field, idx) => 
            prev[key]?.[idx] || getDefaultPath(key, field.label)
          )
        }));
      }
    }
  };

  const handleToggleAll = () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    const allServices = serviceConfig.map(service => service.key);
    
    // If all services are selected, deselect all (except required ones)
    // If not all are selected, select all
    const shouldSelectAll = selectedServices.length < allServices.length;
    
    const newSelected: { [key: string]: boolean } = {};
    const newPaths: { [service: string]: string[] } = { ...paths };
    
    serviceConfig.forEach(service => {
      // Keep required services always selected
      if (service.required) {
        newSelected[service.key] = true;
      } else {
        newSelected[service.key] = shouldSelectAll;
      }
      
      // Initialize default paths for newly selected services
      if (newSelected[service.key] && service.pathRequirements && service.pathRequirements.length > 0) {
        newPaths[service.key] = service.pathRequirements.map((field, idx) => 
          paths[service.key]?.[idx] || getDefaultPath(service.key, field.label)
        );
      }
    });
    
    setSelected(newSelected);
    setPaths(newPaths);
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
    const pathToServices: { [path: string]: Array<{ service: string, field: string }> } = {};
    const allValidPaths: string[] = [];

    // First pass: collect all paths and detect conflicts using smart validation
    Object.keys(selected).forEach((svc) => {
        if (!selected[svc]) return;
        const service = serviceConfig.find(s => s.key === svc);
        if (!service) return;
        
        const fields = service.pathRequirements || [];
        fields.forEach((field, idx) => {
            const val = paths[svc]?.[idx] || '';
            if (val.trim()) {
                const normalizedPath = val.trim();
                if (!pathToServices[normalizedPath]) {
                    pathToServices[normalizedPath] = [];
                }
                pathToServices[normalizedPath].push({
                    service: svc,
                    field: field.label.toLowerCase()
                });
                
                if (field.required) {
                    allValidPaths.push(normalizedPath);
                }
            }
        });
    });

    // Check for conflicts using same logic as AdvancedSettings
    const pathConflicts: { [service: string]: string[] } = {};
    let hasConflicts = false;

    Object.keys(selected).forEach((svc) => {
        if (!selected[svc]) return;
        const service = serviceConfig.find(s => s.key === svc);
        if (!service) return;
        
        const fields = service.pathRequirements || [];
        const serviceErrors: string[] = [];
        
        fields.forEach((field, idx) => {
            const val = paths[svc]?.[idx] || '';
            if (val.trim()) {
                const normalizedPath = val.trim();
                const usagesForThisPath = pathToServices[normalizedPath] || [];
                
                if (usagesForThisPath.length > 1) {
                    const currentFieldType = field.label.toLowerCase();
                    
                    const isMediaPath = currentFieldType.includes('movies') || 
                                       currentFieldType.includes('tv') || 
                                       currentFieldType.includes('shows') || 
                                       currentFieldType.includes('music') ||
                                       currentFieldType.includes('books');
                    
                    if (isMediaPath) {
                        const conflictingServices = usagesForThisPath.filter(usage => 
                            usage.service !== svc && 
                            !isSameMediaType(currentFieldType, usage.field)
                        );
                        
                        if (conflictingServices.length > 0) {
                            serviceErrors[idx] = `Path conflicts with different media type in ${conflictingServices[0].service}`;
                            hasConflicts = true;
                        }
                    } else {
                        const conflictingServices = usagesForThisPath.filter(usage => usage.service !== svc);
                        if (conflictingServices.length > 0) {
                            serviceErrors[idx] = `Path is already used by ${conflictingServices[0].service}`;
                            hasConflicts = true;
                        }
                    }
                }
            }
        });
        
        if (serviceErrors.length > 0) {
            pathConflicts[svc] = serviceErrors;
        }
    });

    if (hasConflicts) {
        setPathErrors(pathConflicts);
        return;
    }

    // If no conflicts and no paths to validate, proceed
    if (allValidPaths.length === 0) {
        setPathErrors({});
        setStep((s) => Math.min(steps.length - 1, s + 1));
        return;
    }

    // Validate paths with backend
    const res = await fetch('http://localhost:3001/api/paths/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: allValidPaths }),
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

  // Helper function to determine if two field types represent the same media type
  const isSameMediaType = (field1: string, field2: string): boolean => {
    const movieFields = ['movies', 'movie'];
    const tvFields = ['tv', 'shows', 'series'];
    const musicFields = ['music', 'audio'];
    const bookFields = ['books', 'ebooks'];
    
    const getMediaType = (field: string) => {
      const fieldLower = field.toLowerCase();
      if (movieFields.some(type => fieldLower.includes(type))) return 'movies';
      if (tvFields.some(type => fieldLower.includes(type))) return 'tv';
      if (musicFields.some(type => fieldLower.includes(type))) return 'music';
      if (bookFields.some(type => fieldLower.includes(type))) return 'books';
      return 'other';
    };
    
    return getMediaType(field1) === getMediaType(field2);
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
        // Validate paths, ports, and environment in the configuration step
        await validatePaths();
        if (!validatePorts()) return;
        if (!validateEnvironment()) return;
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

      // Start services
      const startRes = await fetch('http://localhost:3001/api/services/start-all', {
        method: 'POST',
      });

      if (!startRes.ok) {
        throw new Error('Failed to start services');
      }

      showToast('Configuration saved and services started successfully!', 'success');
      onComplete();
    } catch (error) {
      console.error('Error in setup process:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast(errorMessage, 'error');
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
                  <ServiceConfiguration
                    key={svc}
                    service={service}
                    paths={paths[svc] || []}
                    pathErrors={pathErrors[svc] || []}
                    port={ports[svc] || service.defaultPort}
                    portError={portErrors[svc]}
                    onPathChange={(idx, value) => handlePathChange(svc, idx, value)}
                    onPortChange={(port) => handlePortChange(svc, port)}
                    onBrowse={(idx) => handleBrowse(svc, idx)}
                    layout="card"
                  />
                );
              })}
            </div>
            
            {/* Environment Variables Section */}
            <Card className="border-l-4 border-purple-500">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">Environment Settings</h3>
                </div>
              </Card.Header>
              <Card.Body>
                <EnvironmentSettings
                  environment={{ tz, puid, pgid }}
                  errors={envErrors}
                  onEnvironmentChange={(field, value) => {
                    if (field === 'tz') setTz(value as string);
                    else if (field === 'puid') setPuid(value as number);
                    else if (field === 'pgid') setPgid(value as number);
                  }}
                  layout="grid"
                />
              </Card.Body>
            </Card>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Configuration Summary</h2>
              <p className="text-gray-600 dark:text-gray-300">Review your settings before applying the configuration:</p>
            </div>

            {/* Services with Configuration */}
            <Card className="border-l-4 border-green-500">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-sm font-medium">Services</span>
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">Service Configuration</h3>
                </div>
              </Card.Header>
              <Card.Body>
                <div className="space-y-6">
                  {Object.keys(selected).filter(key => selected[key]).map((key) => {
                    const service = serviceConfig.find(s => s.key === key);
                    const servicePaths = paths[key] || [];
                    const hasValidPaths = service?.pathRequirements && service.pathRequirements.some((_, idx) => servicePaths[idx]);
                    
                    return (
                      <div key={key} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        {/* Service Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-lg font-medium text-gray-900 dark:text-white">{service?.name}</h4>
                              <Badge color="blue">Port {ports[key] || service?.defaultPort}</Badge>
                              {service?.required && <Badge color="gray">Required</Badge>}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{service?.description}</p>
                          </div>
                        </div>

                        {/* File Paths for this service */}
                        {hasValidPaths && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">Paths</span>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">File Configuration</h5>
                            </div>
                            <div className="space-y-3">
                              {service?.pathRequirements?.map((field, idx) => {
                                const path = servicePaths[idx];
                                if (!path) return null;
                                return (
                                  <div key={idx} className="bg-white dark:bg-gray-900 rounded p-3 border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">{field.label}</span>
                                    </div>
                                    <p className="text-sm text-gray-900 dark:text-white font-mono mt-1">{path}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>

            {/* Environment Variables */}
            <Card className="border-l-4 border-purple-500">
              <Card.Header>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">Environment Settings</h3>
                </div>
              </Card.Header>
              <Card.Body>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone:</span>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded mt-1">{tz}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PUID:</span>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded mt-1">{puid}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">PGID:</span>
                      <p className="text-sm text-gray-900 dark:text-white font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded mt-1">{pgid}</p>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        )}
      </div>
      <div className="flex justify-between mt-6">
        <div>
          {step > 0 && (
            <Button color="gray" outline onClick={() => setStep(s => Math.max(0, s - 1))}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </Button>
          )}
        </div>
        <div>
          {step < steps.length - 1 ? (
            <Button color="blue" onClick={handleNext}>
              Next
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          ) : (
            <Button color="green" onClick={handleSaveAndApply} loading={isSaving}>
              {isSaving ? 'Saving Configuration...' : 'Save and Start Services'}
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}