
import { useState, useEffect } from 'react';
import { Button, Modal, TextInput, Spinner, Alert, Card } from './components';

interface AdvancedSettingsProps {
  onClose: () => void;
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

// Removed unused DEFAULT_PORTS constant

export default function AdvancedSettings({ onClose }: AdvancedSettingsProps) {
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  // Remove unused DEFAULT_PORTS constant
  // const DEFAULT_PORTS: { [key: string]: number } = {...};

  useEffect(() => {
    fetchCurrentConfig();
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

      alert('Settings saved successfully! Services will be restarted with new settings.');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
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
        alert('Settings reset successfully. Please refresh the page to start setup again.');
        window.location.reload();
      } else {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      alert('Failed to reset settings. Please try again.');
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
    <Modal show={true} onClose={onClose} size="xl">
      <Modal.Header>
        <h3 className="text-xl font-medium text-gray-900 dark:text-white">Advanced Settings</h3>
      </Modal.Header>
      <Modal.Body className="max-h-[70vh] overflow-auto">
        {/* Ports Section */}
        <Card className="mb-6">
          <Card.Header>
            <h4 className="text-lg font-medium">Port Configuration</h4>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              {Object.entries(config.ports).map(([service, port]) => (
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

        {/* Environment Variables Section */}
        <Card>
          <Card.Header>
            <h4 className="text-lg font-medium">Environment Variables</h4>
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
      </Modal.Body>
      <Modal.Footer>
        <div className="flex space-x-3">
          <Button
            onClick={handleReset}
            disabled={saving}
            color="red"
          >
            Reset All Settings
          </Button>
          <Button
            onClick={onClose}
            disabled={saving}
            color="gray"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            color="blue"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}