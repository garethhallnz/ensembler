import { useState, useEffect } from 'react';
import { Button, Modal, TextInput, Spinner, Alert, Card, Badge } from './components';
import { ToggleSwitch } from 'flowbite-react';
import { useToast } from './contexts/ToastContext';
import { HiPlus, HiTrash, HiFolder } from 'react-icons/hi';

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
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [pathErrors, setPathErrors] = useState<{ [service: string]: string[] }>({});
  const [activeTab, setActiveTab] = useState<'services' | 'environment'>('services');

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
    
    setConfig(prev => ({
      ...prev!,
      selectedServices: {
        ...prev!.selectedServices,
        [serviceKey]: !prev!.selectedServices[serviceKey]
      }
    }));
  };

  const validatePaths = async () => {
    const allPaths: string[] = [];
    const newPathErrors: { [service: string]: string[] } = {};
    let valid = true;

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
        } else if (val.trim() && allPaths.includes(val.trim())) {
          serviceErrors[idx] = `Path is already used by another service`;
          valid = false;
        } else if (val.trim()) {
          allPaths.push(val.trim());
        }
      });
      
      if (serviceErrors.length > 0) {
        newPathErrors[svc] = serviceErrors;
      }
    });

    setPathErrors(newPathErrors);
    return valid;
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
      // Save configuration
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

      showToast('Settings saved successfully! Services will be restarted with new settings.', 'success');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings? This will delete all configuration and stop all services.')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/config/reset', {
        method: 'POST',
      });

      if (res.ok) {
        showToast('Settings reset successfully. Please refresh the page to start setup again.', 'success');
        window.location.reload();
      } else {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      showToast('Failed to reset settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
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
                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">Paths</span>
                                  <h4 className="text-sm font-medium text-gray-800 dark:text-white">File Paths</h4>
                                </div>
                                {service.pathRequirements.map((field, idx) => (
                                  <div key={idx} className="space-y-2">
                                    <label htmlFor={`path-${service.key}-${idx}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                      {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="flex gap-2">
                                      <TextInput
                                        id={`path-${service.key}-${idx}`}
                                        type="text"
                                        value={config?.paths[service.key]?.[idx] || ''}
                                        onChange={e => handlePathChange(service.key, idx, e.target.value)}
                                        placeholder={field.description}
                                        color={pathErrors[service.key]?.[idx] ? 'failure' : 'gray'}
                                        className="flex-1"
                                      />
                                      <Button 
                                        onClick={() => handleBrowse(service.key, idx)} 
                                        variant="secondary"
                                        size="sm"
                                      >
                                        Browse
                                      </Button>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
                                    {pathErrors[service.key]?.[idx] && (
                                      <Alert color="red" className="text-xs">{pathErrors[service.key][idx]}</Alert>
                                    )}
                                  </div>
                                ))}
                              </div>
                              
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
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Timezone (TZ):
                  </label>
                  <select
                    value={config.environment.tz}
                    onChange={(e) => handleEnvironmentChange('tz', e.target.value)}
                    className={`block w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.tz 
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                    } text-gray-900 dark:text-white`}
                  >
                    <option value="">Select timezone...</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="America/Toronto">America/Toronto</option>
                    <option value="America/Vancouver">America/Vancouver</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                    <option value="Europe/Rome">Europe/Rome (CET/CEST)</option>
                    <option value="Europe/Madrid">Europe/Madrid (CET/CEST)</option>
                    <option value="Europe/Amsterdam">Europe/Amsterdam (CET/CEST)</option>
                    <option value="Europe/Stockholm">Europe/Stockholm (CET/CEST)</option>
                    <option value="Europe/Zurich">Europe/Zurich (CET/CEST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Asia/Hong_Kong">Asia/Hong_Kong (HKT)</option>
                    <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                    <option value="Australia/Melbourne">Australia/Melbourne (AEST/AEDT)</option>
                    <option value="Australia/Perth">Australia/Perth (AWST)</option>
                    <option value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</option>
                  </select>
                  {errors.tz && (
                    <Alert color="red" className="mt-2">{errors.tz}</Alert>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    User ID (PUID):
                  </label>
                  <TextInput
                    type="number"
                    value={String(config.environment.puid)}
                    onChange={(e) => handleEnvironmentChange('puid', parseInt(e.target.value))}
                    color={errors.puid ? 'failure' : 'gray'}
                  />
                  {errors.puid && (
                    <Alert color="red" className="mt-2">{errors.puid}</Alert>
                  )}
                </div>
                
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Group ID (PGID):
                  </label>
                  <TextInput
                    type="number"
                    value={String(config.environment.pgid)}
                    onChange={(e) => handleEnvironmentChange('pgid', parseInt(e.target.value))}
                    color={errors.pgid ? 'failure' : 'gray'}
                  />
                  {errors.pgid && (
                    <Alert color="red" className="mt-2">{errors.pgid}</Alert>
                  )}
                </div>
              </div>
            </Card.Body>
          </Card>
        )}
      </div>
      <div className="border-t border-gray-200 dark:border-gray-600 p-4">
        <div className="flex space-x-3">
          <Button
            variant="danger"
            onClick={handleReset}
            loading={saving}
          >
            Reset All Settings
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
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}