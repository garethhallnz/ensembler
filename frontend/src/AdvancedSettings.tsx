import React, { useState, useEffect } from 'react';

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

const DEFAULT_PORTS: { [key: string]: number } = {
  sonarr: 8989,
  radarr: 7878,
  plex: 32400,
  transmission: 9091,
  prowlarr: 9696,
  overseerr: 5055,
};

export default function AdvancedSettings({ onClose }: AdvancedSettingsProps) {
  const [config, setConfig] = useState<ConfigType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

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
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: 32, 
          borderRadius: 8, 
          minWidth: 300 
        }}>
          Loading settings...
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.5)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ 
          backgroundColor: 'white', 
          padding: 32, 
          borderRadius: 8, 
          minWidth: 300 
        }}>
          <h2>Error</h2>
          <p>Failed to load configuration. Please try again.</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: 32, 
        borderRadius: 8, 
        minWidth: 600,
        maxWidth: 800,
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2 style={{ margin: '0 0 24px 0' }}>Advanced Settings</h2>
        
        {/* Ports Section */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Port Configuration</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {Object.entries(config.ports).map(([service, port]) => (
              <div key={service} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ minWidth: 120, textTransform: 'capitalize' }}>
                  {service}:
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => handlePortChange(service, e.target.value)}
                  style={{ 
                    width: 100, 
                    padding: '4px 8px',
                    border: errors[`port_${service}`] ? '1px solid red' : '1px solid #ccc',
                    borderRadius: 4 
                  }}
                  min="1024"
                  max="65535"
                />
                {errors[`port_${service}`] && (
                  <span style={{ color: 'red', fontSize: '14px' }}>
                    {errors[`port_${service}`]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Environment Variables Section */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Environment Variables</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ minWidth: 120 }}>Timezone (TZ):</label>
              <input
                type="text"
                value={config.environment.tz}
                onChange={(e) => handleEnvironmentChange('tz', e.target.value)}
                style={{ 
                  width: 200, 
                  padding: '4px 8px',
                  border: errors.tz ? '1px solid red' : '1px solid #ccc',
                  borderRadius: 4 
                }}
                placeholder="e.g., America/New_York"
              />
              {errors.tz && (
                <span style={{ color: 'red', fontSize: '14px' }}>{errors.tz}</span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ minWidth: 120 }}>User ID (PUID):</label>
              <input
                type="number"
                value={config.environment.puid}
                onChange={(e) => handleEnvironmentChange('puid', parseInt(e.target.value))}
                style={{ 
                  width: 100, 
                  padding: '4px 8px',
                  border: errors.puid ? '1px solid red' : '1px solid #ccc',
                  borderRadius: 4 
                }}
                min="0"
              />
              {errors.puid && (
                <span style={{ color: 'red', fontSize: '14px' }}>{errors.puid}</span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ minWidth: 120 }}>Group ID (PGID):</label>
              <input
                type="number"
                value={config.environment.pgid}
                onChange={(e) => handleEnvironmentChange('pgid', parseInt(e.target.value))}
                style={{ 
                  width: 100, 
                  padding: '4px 8px',
                  border: errors.pgid ? '1px solid red' : '1px solid #ccc',
                  borderRadius: 4 
                }}
                min="0"
              />
              {errors.pgid && (
                <span style={{ color: 'red', fontSize: '14px' }}>{errors.pgid}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={handleReset}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            Reset All Settings
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
} 