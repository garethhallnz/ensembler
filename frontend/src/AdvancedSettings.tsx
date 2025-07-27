import { useState, useEffect } from 'react';
import { Button, Modal, TextInput, Spinner, Alert, Card, Badge, PathConfiguration, EnvironmentSettings } from './components';
import { ToggleSwitch } from 'flowbite-react';
import { useToast } from './contexts/ToastContext';
import ConfirmationModal from './components/ConfirmationModal';
import { HiPlus, HiTrash, HiFolder } from 'react-icons/hi';
import { getDefaultPath } from './utils/pathDefaults';

interface AdvancedSettingsProps {
  onClose: () => void;
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

interface ConfigType {
  selectedServices: { [key: string]: boolean };
  ports: { [key: string]: number };
  environment: {
    tz: string;
    puid: number;
    pgid: number;
  };
  paths: { [key: string]: string[] };
}

export default function AdvancedSettings({ onClose }: AdvancedSettingsProps) {
  const { showToast } = useToast();
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [availableServices, setAvailableServices] = useState<ServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [pathErrors, setPathErrors] = useState<{ [service: string]: string[] }>({});
  const [activeTab, setActiveTab] = useState<'services' | 'environment'>('services');
  const [openModal, setOpenModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    message: string;
    onConfirm: () => void;
  }>({
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchCurrentConfig();
    fetchAvailableServices();
  }, []);

  const fetchCurrentConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/config/current');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        console.error('Failed to fetch current config');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableServices = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAvailableServices(data.services);
        }
      }
    } catch (error) {
      console.error('Error fetching available services:', error);
    }
  };

  const handlePortChange = (service: string, port: string) => {
    const portNum = parseInt(port);
    if (!config) return;
    
    setConfig(prev => ({
      ...prev!,
      ports: {
        ...prev!.ports,
        [service]: portNum
      }
    }));
  };

  const handlePathChange = (service: string, idx: number, value: string) => {
    const serviceConfig = availableServices.find(s => s.key === service);
    if (!serviceConfig || !config) return;
    
    setConfig(prev => ({
      ...prev!,
      paths: {
        ...prev!.paths,
        [service]: prev!.paths[service]?.map((v, i) => (i === idx ? value : v)) || 
                 serviceConfig.pathRequirements.map((_, i) => (i === idx ? value : ''))
      }
    }));
  };

  const handleBrowse = async (service: string, idx: number) => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        const path = await handle.resolve(handle);
        if (path) {
          handlePathChange(service, idx, path.join('/'));
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      showToast('File system access API is not supported in your browser.', 'warning');
    }
  };

  const handleEnvironmentChange = (field: string, value: string | number) => {
    if (!config) return;
    
    setConfig(prev => ({
      ...prev!,
      environment: {
        ...prev!.environment,
        [field]: value
      }
    }));
  };

  const toggleService = (serviceKey: string) => {
    if (!config) return;
    
    const isBeingEnabled = !config.selectedServices[serviceKey];
    
    setConfig(prev => {
      const newConfig = {
        ...prev!,
        selectedServices: {
          ...prev!.selectedServices,
          [serviceKey]: isBeingEnabled
        }
      };
      
      // Initialize default paths for newly enabled services that don't have paths set
      if (isBeingEnabled) {
        const service = availableServices.find(s => s.key === serviceKey);
        if (service?.pathRequirements && service.pathRequirements.length > 0) {
          const existingPaths = prev!.paths[serviceKey] || [];
          const newPaths = service.pathRequirements.map((field, idx) => 
            existingPaths[idx] || getDefaultPath(serviceKey, field.label)
          );
          newConfig.paths = {
            ...prev!.paths,
            [serviceKey]: newPaths
          };
        }
      }
      
      return newConfig;
    });
  };

  const validatePaths = async () => {
    const pathToServices: { [path: string]: Array<{ service: string, field: string }> } = {};
    const newPathErrors: { [service: string]: string[] } = {};
    let valid = true;

    // First pass: collect all paths and which services use them
    Object.keys(config?.selectedServices || {}).forEach((svc) => {
      if (!config?.selectedServices[svc]) return;
      const service = availableServices.find(s => s.key === svc);
      if (!service) return;
      
      const fields = service.pathRequirements || [];
      
      fields.forEach((field, idx) => {
        const val = config.paths[svc]?.[idx] || '';
        if (val.trim()) {
          const normalizedPath = val.trim();
          if (!pathToServices[normalizedPath]) {
            pathToServices[normalizedPath] = [];
          }
          pathToServices[normalizedPath].push({
            service: svc,
            field: field.label.toLowerCase()
          });
        }
      });
    });

    // Second pass: validate paths and check for conflicts
    Object.keys(config?.selectedServices || {}).forEach((svc) => {
      if (!config?.selectedServices[svc]) return;
      const service = availableServices.find(s => s.key === svc);
      if (!service) return;
      
      const fields = service.pathRequirements || [];
      const serviceErrors: string[] = [];
      
      fields.forEach((field, idx) => {
        const val = config.paths[svc]?.[idx] || '';
        
        if (field.required && !val.trim()) {
          serviceErrors[idx] = `${field.label} is required`;
          valid = false;
        } else if (val.trim()) {
          const normalizedPath = val.trim();
          const usagesForThisPath = pathToServices[normalizedPath] || [];
          
          // Check if this path is used by multiple services
          if (usagesForThisPath.length > 1) {
            const currentFieldType = field.label.toLowerCase();
            
            // Allow sharing of media paths between compatible services
            const isMediaPath = currentFieldType.includes('movies') || 
                               currentFieldType.includes('tv') || 
                               currentFieldType.includes('shows') || 
                               currentFieldType.includes('music') ||
                               currentFieldType.includes('books');
            
            if (isMediaPath) {
              // Media paths can be shared between services that consume the same media type
              const conflictingServices = usagesForThisPath.filter(usage => 
                usage.service !== svc && 
                !isSameMediaType(currentFieldType, usage.field)
              );
              
              if (conflictingServices.length > 0) {
                serviceErrors[idx] = `Path conflicts with different media type in ${conflictingServices[0].service}`;
                valid = false;
              }
            } else {
              // Non-media paths (like config, downloads) should be unique
              const conflictingServices = usagesForThisPath.filter(usage => usage.service !== svc);
              if (conflictingServices.length > 0) {
                serviceErrors[idx] = `Path is already used by ${conflictingServices[0].service}`;
                valid = false;
              }
            }
          }
        }
      });
      
      if (serviceErrors.length > 0) {
        newPathErrors[svc] = serviceErrors;
      }
    });

    setPathErrors(newPathErrors);
    return valid;
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

  const validateConfig = async () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!config) return false;

    // Validate ports
    const usedPorts = new Set<number>();
    Object.entries(config.ports).forEach(([service, port]) => {
      if (port < 1024 || port > 65535) {
        newErrors[`port_${service}`] = 'Port must be between 1024 and 65535';
      } else if (usedPorts.has(port)) {
        newErrors[`port_${service}`] = 'Port conflicts with another service';
      } else {
        usedPorts.add(port);
      }
    });

    // Validate environment variables
    if (!config.environment.tz.trim()) {
      newErrors.tz = 'Timezone is required';
    }
    if (config.environment.puid < 0) {
      newErrors.puid = 'PUID must be non-negative';
    }
    if (config.environment.pgid < 0) {
      newErrors.pgid = 'PGID must be non-negative';
    }

    setErrors(newErrors);
    
    // Validate paths
    const pathsValid = await validatePaths();
    
    return Object.keys(newErrors).length === 0 && pathsValid;
  };

  const handleSave = async () => {
    if (!(await validateConfig())) return;
    
    setSaving(true);
    try {
      // Save configuration (this will automatically stop and remove disabled services)
      const saveRes = await fetch('http://localhost:3001/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save configuration');
      }

      // Regenerate docker-compose.yml
      const composeRes = await fetch('http://localhost:3001/api/config/generate-compose', {
        method: 'POST',
      });

      if (!composeRes.ok) {
        throw new Error('Failed to regenerate docker-compose files');
      }

      // Start all enabled services (this will start newly enabled services and restart existing ones with new settings)
      const startRes = await fetch('http://localhost:3001/api/services/start-all', {
        method: 'POST',
      });

      if (!startRes.ok) {
        const startError = await startRes.text();
        console.warn('Failed to start some services:', startError);
        showToast('Settings saved! Some services may need to be started manually.', 'warning');
      } else {
        showToast('Settings saved successfully! All enabled services have been started.', 'success');
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
      message: '⚠️ DESTRUCTIVE ACTION: This will completely reset Dockarr, delete ALL configuration, stop ALL services, and remove ALL data. This action CANNOT be undone. Are you absolutely sure?',
      onConfirm: async () => {
        setOpenModal(false);
        setResetting(true);
        try {
          const res = await fetch('http://localhost:3001/api/config/reset', {
            method: 'POST',
          });
          if (res.ok) {
            showToast('Complete reset successful. Reloading application...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          } else {
            throw new Error('Failed to reset application');
          }
        } catch (error) {
          showToast(`Failed to reset application: ${error}`, 'error');
        } finally {
          setResetting(false);
        }
      },
    });
    setOpenModal(true);
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Settings & Service Management</h3>
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
          <Alert color="red">
            Failed to load configuration. Please try again.
          </Alert>
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
        <h3 className="text-xl font-medium text-gray-900 dark:text-white">Settings & Service Management</h3>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('services')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'services'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Services & Ports
          </button>
          <button
            onClick={() => setActiveTab('environment')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'environment'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Environment
          </button>
        </div>

        {/* Services Tab */}
        {activeTab === 'services' && (
          <Card className="mb-6">
            <Card.Header>
              <h4 className="text-lg font-medium">Service & Port Configuration</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enable services and configure their ports. Ports must be unique and between 1024-65535.
              </p>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {availableServices.map(service => {
                  const isSelected = config?.selectedServices[service.key] || false;
                  const currentPort = config?.ports[service.key] || service.defaultPort;
                  return (
                    <div
                      key={service.key}
                      className={`border rounded-lg p-4 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900 dark:text-white">{service.name}</h5>
                            <ToggleSwitch
                              id={`service-${service.key}`}
                              checked={isSelected}
                              onChange={() => toggleService(service.key)}
                            />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{service.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="info" size="sm">{service.category}</Badge>
                            {service.required && (
                              <Badge variant="warning" size="sm">Required</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Configuration Section - Only show if service is enabled */}
                      {isSelected && (
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-3">
                          {service.pathRequirements && service.pathRequirements.length > 0 ? (
                            /* Services with paths: Two-column layout */
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* File Paths Column */}
                              <PathConfiguration
                                serviceKey={service.key}
                                serviceName={service.name}
                                pathRequirements={service.pathRequirements}
                                paths={config?.paths[service.key] || []}
                                pathErrors={pathErrors[service.key] || []}
                                onPathChange={(idx, value) => handlePathChange(service.key, idx, value)}
                                onBrowse={(idx) => handleBrowse(service.key, idx)}
                                showDefaultButton={true}
                                showBrowseButton={true}
                                layout="vertical"
                              />
                              
                              {/* Port Configuration Column */}
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-medium">Port</span>
                                  <h4 className="text-sm font-medium text-gray-800 dark:text-white">Port Configuration</h4>
                                </div>
                                <div className="space-y-2">
                                  <label htmlFor={`port-${service.key}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                    {service.name} Port:
                                  </label>
                                  <TextInput
                                    id={`port-${service.key}`}
                                    type="number"
                                    value={String(currentPort)}
                                    onChange={(e) => handlePortChange(service.key, e.target.value)}
                                    color={errors[`port_${service.key}`] ? 'failure' : 'gray'}
                                    min="1024"
                                    max="65535"
                                    className="w-32"
                                  />
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Default: {service.defaultPort}
                                  </p>
                                  {errors[`port_${service.key}`] && (
                                    <Alert color="red" className="text-xs">
                                      {errors[`port_${service.key}`]}
                                    </Alert>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* Services without paths: Single column port layout */
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-medium">Port</span>
                                <h4 className="text-sm font-medium text-gray-800 dark:text-white">Port Configuration</h4>
                              </div>
                              <div className="flex items-center space-x-4">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[60px]">
                                  Port:
                                </label>
                                <div className="flex-1 max-w-[120px]">
                                  <TextInput
                                    type="number"
                                    value={String(currentPort)}
                                    onChange={(e) => handlePortChange(service.key, e.target.value)}
                                    color={errors[`port_${service.key}`] ? 'failure' : 'gray'}
                                    min="1024"
                                    max="65535"
                                  />
                                </div>
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  (Default: {service.defaultPort})
                                </span>
                              </div>
                              {errors[`port_${service.key}`] && (
                                <Alert color="red" className="mt-2 text-sm">
                                  {errors[`port_${service.key}`]}
                                </Alert>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>
        )}


        {/* Environment Tab */}
        {activeTab === 'environment' && (
          <Card>
            <Card.Header>
              <h4 className="text-lg font-medium">Environment Variables</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure global environment settings that apply to all services.
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
        )}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-600 p-4">
        <div className="flex space-x-3">
          <Button
            variant="danger"
            onClick={handleCompleteReset}
            loading={resetting}
            tooltip="⚠️ Complete Reset - This will delete everything!"
          >
            🗑️ Reset All
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
          >
            {saving ? 'Applying Changes...' : 'Save & Apply Settings'}
          </Button>
        </div>
      </div>
    </div>
    
    {/* Confirmation Modal */}
    {openModal && (
      <ConfirmationModal
        show={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={confirmationModal.onConfirm}
        message={confirmationModal.message}
      />
    )}
    </>
  );
}