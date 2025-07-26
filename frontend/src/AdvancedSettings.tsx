import { useState, useEffect } from 'react';
import { Button, Modal, TextInput, Spinner, Alert, Card, Badge } from './components';
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
  const [activeTab, setActiveTab] = useState<'services' | 'ports' | 'environment'>('services');

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

  const validateConfig = () => {
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
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateConfig()) return;
    
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
      <Modal show={true} onClose={() => {}} size="md">
        <Modal.Body className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg">Loading settings...</p>
          </div>
        </Modal.Body>
      </Modal>
    );
  }

  if (!config) {
    return (
      <Modal show={true} onClose={onClose} size="md">
        <Modal.Header>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">Error</h3>
        </Modal.Header>
        <Modal.Body>
          <Alert color="red">
            Failed to load configuration. Please try again.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onClose}>Close</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  return (
    <Modal show={true} onClose={onClose} size="2xl">
      <Modal.Header>
        <h3 className="text-xl font-medium text-gray-900 dark:text-white">Settings & Service Management</h3>
      </Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-auto">
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
            Services
          </button>
          <button
            onClick={() => setActiveTab('ports')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'ports'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            Ports
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
              <h4 className="text-lg font-medium">Service Configuration</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Select which services you want to run. You can add or remove services at any time.
              </p>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableServices.map(service => {
                  const isSelected = config?.selectedServices[service.key] || false;
                  return (
                    <div
                      key={service.key}
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onClick={() => toggleService(service.key)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 dark:text-white">{service.name}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{service.description}</p>
                          <div className="mt-2">
                            <Badge variant="info" size="sm">{service.category}</Badge>
                            {service.required && (
                              <Badge variant="warning" size="sm" className="ml-2">Required</Badge>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Ports Tab */}
        {activeTab === 'ports' && (
          <Card className="mb-6">
            <Card.Header>
              <h4 className="text-lg font-medium">Port Configuration</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure ports for each enabled service. Ports must be unique and between 1024-65535.
              </p>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                {config && Object.entries(config.ports).map(([service, port]) => (
                  <div key={service} className="flex items-center space-x-4">
                    <label className="min-w-[120px] capitalize">
                      {service}:
                    </label>
                    <div className="flex-1">
                      <TextInput
                        type="number"
                        value={String(port)}
                        onChange={(e) => handlePortChange(service, e.target.value)}
                        color={errors[`port_${service}`] ? 'failure' : 'gray'}
                      />
                    </div>
                    {errors[`port_${service}`] && (
                      <Alert color="red" className="mt-2">
                        {errors[`port_${service}`]}
                      </Alert>
                    )}
                  </div>
                ))}
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
                  <TextInput
                    type="text"
                    value={config.environment.tz}
                    onChange={(e) => handleEnvironmentChange('tz', e.target.value)}
                    placeholder="e.g., America/New_York"
                    color={errors.tz ? 'failure' : 'gray'}
                  />
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
      </Modal.Body>
      <Modal.Footer>
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
      </Modal.Footer>
    </Modal>
  );
}