import React, { useEffect, useState } from 'react';
import AdvancedSettings from './AdvancedSettings';
import { runtimeManager, RuntimeStatus } from './services/runtimeManager';

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

interface ServiceStatusType {
  [key: string]: string;
}

interface ServiceLogsType {
  [key: string]: string;
}

interface ServiceVersionType {
  [key: string]: string;
}

interface ServiceUpdateType {
  [key: string]: { hasUpdate: boolean; currentVersion: string; updateAvailable: string };
}

interface ServiceAlertsType {
  [key: string]: { alert: boolean; status: string; healthy: boolean };
}

interface DashboardProps {
  onEditSetup: () => void;
}

export default function Dashboard({ onEditSetup }: DashboardProps) {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusType>({});
  const [serviceVersions, setServiceVersions] = useState<ServiceVersionType>({});
  const [serviceLogs, setServiceLogs] = useState<ServiceLogsType>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [showLogs, setShowLogs] = useState<{ [key: string]: boolean }>({});
  const [dockerStatus, setDockerStatus] = useState<{ running: boolean; updates: string }>({
    running: true,
    updates: 'No updates available'
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdateType>({});
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlertsType>({});
  const [updateLoading, setUpdateLoading] = useState<{ [key: string]: boolean }>({});
  const [dockerUpdates, setDockerUpdates] = useState<any>(null);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig[]>([]);
  const [maxServices, setMaxServices] = useState(6);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  const fetchServiceStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/status');
      const data = await res.json();
      if (data.success) {
        setServiceStatus(data.serviceStatus);
        setSelectedServices(Object.keys(data.serviceStatus));
      } else {
        console.error('Failed to fetch service status:', data.message);
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
    }
  };

  const fetchServiceVersions = async () => {
    for (const service of selectedServices) {
      try {
        const res = await fetch(`http://localhost:3001/api/services/${service}/version`);
        const data = await res.json();
        if (data.success) {
          setServiceVersions(prev => ({ ...prev, [service]: data.version }));
        }
      } catch (error) {
        console.error(`Error fetching version for ${service}:`, error);
      }
    }
  };

  const fetchDockerStatus = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/docker/status');
      const data = await res.json();
      setDockerStatus({
        running: data.docker && data.compose,
        updates: data.docker && data.compose ? 'Docker running' : 'Docker not running'
      });
    } catch (error) {
      console.error('Error fetching Docker status:', error);
    }
  };

  const fetchServiceUpdates = async () => {
    for (const serviceName of selectedServices) {
      try {
        const res = await fetch(`http://localhost:3001/api/services/${serviceName}/check-updates`);
        const data = await res.json();
        if (data.success) {
          setServiceUpdates(prev => ({
            ...prev,
            [serviceName]: {
              hasUpdate: data.hasUpdate,
              currentVersion: data.currentVersion,
              updateAvailable: data.updateAvailable
            }
          }));
        }
      } catch (error) {
        console.error(`Error fetching updates for ${serviceName}:`, error);
      }
    }
  };

  const fetchServiceAlerts = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/monitor');
      const data = await res.json();
      if (data.success) {
        setServiceAlerts(data.services);
      }
    } catch (error) {
      console.error('Error fetching service alerts:', error);
    }
  };

  const fetchDockerUpdates = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/docker/check-updates');
      const data = await res.json();
      if (data.success) {
        setDockerUpdates(data);
      }
    } catch (error) {
      console.error('Error fetching Docker updates:', error);
    }
  };

  const fetchServiceConfig = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/config');
      if (res.ok) {
        const data: ServiceConfigResponse = await res.json();
        if (data.success) {
          setServiceConfig(data.services);
          setMaxServices(data.maxServices);
        }
      }
    } catch (error) {
      console.error('Error fetching service configuration:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchServiceConfig();
      await fetchServiceStatus();
      await fetchDockerStatus();
      await fetchDockerUpdates();
      
      // Get runtime status
      setRuntimeStatus(runtimeManager.getStatus());
      
      setLoading(false);
    };
    loadData();

    // Setup runtime status monitoring
    const runtimeInterval = setInterval(() => {
      setRuntimeStatus(runtimeManager.getStatus());
    }, 30000); // Update every 30 seconds

    return () => {
      clearInterval(runtimeInterval);
    };
  }, []);

  useEffect(() => {
    if (selectedServices.length > 0) {
      fetchServiceVersions();
      fetchServiceUpdates();
      fetchServiceAlerts();
    }
  }, [selectedServices]);

  // Set up monitoring interval for service alerts
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedServices.length > 0) {
        fetchServiceAlerts();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [selectedServices]);

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(prev => ({ ...prev, [serviceName]: true }));
    try {
      const res = await fetch(`http://localhost:3001/api/services/${serviceName}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(`${serviceName} ${action}ed successfully`);
        await fetchServiceStatus();
      } else {
        alert(`Failed to ${action} ${serviceName}: ${data.message}`);
      }
    } catch (error) {
      alert(`Error ${action}ing ${serviceName}: ${error}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  const handleGlobalAction = async (action: 'start-all' | 'stop-all') => {
    const actionText = action === 'start-all' ? 'start all' : 'stop all';
    if (!confirm(`Are you sure you want to ${actionText} services?`)) return;
    
    setActionLoading(prev => ({ ...prev, global: true }));
    try {
      const res = await fetch(`http://localhost:3001/api/services/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(`All services ${action.split('-')[0]}ed successfully`);
        await fetchServiceStatus();
      } else {
        alert(`Failed to ${actionText}: ${data.message}`);
      }
    } catch (error) {
      alert(`Error ${actionText}: ${error}`);
    } finally {
      setActionLoading(prev => ({ ...prev, global: false }));
    }
  };

  const handleLaunchService = async (serviceName: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/services/${serviceName}/launch-url`);
      const data = await res.json();
      if (data.success) {
        window.open(data.url, '_blank');
      } else {
        alert(`Failed to get launch URL for ${serviceName}: ${data.message}`);
      }
    } catch (error) {
      alert(`Error launching ${serviceName}: ${error}`);
    }
  };

  const toggleLogs = async (serviceName: string) => {
    if (showLogs[serviceName]) {
      setShowLogs(prev => ({ ...prev, [serviceName]: false }));
    } else {
      try {
        const res = await fetch(`http://localhost:3001/api/services/${serviceName}/logs`);
        const data = await res.json();
        if (data.success) {
          setServiceLogs(prev => ({ ...prev, [serviceName]: data.logs }));
          setShowLogs(prev => ({ ...prev, [serviceName]: true }));
        } else {
          alert(`Failed to get logs for ${serviceName}: ${data.message}`);
        }
      } catch (error) {
        alert(`Error getting logs for ${serviceName}: ${error}`);
      }
    }
  };

  const handleEditSetup = () => {
    // This would redirect to setup wizard with pre-populated values
    if (confirm('Are you sure you want to edit the setup? This will take you back to the setup wizard.')) {
      onEditSetup();
    }
  };

  const handleServiceUpdate = async (serviceName: string) => {
    if (!confirm(`Are you sure you want to update ${serviceName}? This will download the latest version and restart the service.`)) {
      return;
    }

    setUpdateLoading(prev => ({ ...prev, [serviceName]: true }));
    try {
      const res = await fetch(`http://localhost:3001/api/services/${serviceName}/update`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        alert(`${serviceName} updated successfully`);
        await fetchServiceStatus();
        await fetchServiceVersions();
        await fetchServiceUpdates();
      } else {
        alert(`Failed to update ${serviceName}: ${data.message}`);
      }
    } catch (error) {
      alert(`Error updating ${serviceName}: ${error}`);
    } finally {
      setUpdateLoading(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: 1200, 
      margin: '2rem auto', 
      padding: 32, 
      fontFamily: 'Arial, sans-serif' 
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 32 
      }}>
        <h1 style={{ margin: 0 }}>Media Center Dashboard</h1>
        <div style={{ display: 'flex', gap: 16 }}>
          <button 
            onClick={() => setShowAdvancedSettings(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Advanced Settings
          </button>
          <button 
            onClick={handleEditSetup}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Edit Setup
          </button>
        </div>
      </div>

      {/* Docker Status and Updates */}
      <div style={{ 
        border: '1px solid #e0e0e0', 
        padding: 16, 
        borderRadius: 8, 
        marginBottom: 32,
        backgroundColor: dockerStatus.running ? '#e8f5e8' : '#ffe8e8'
      }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Docker Status</h2>
        <div style={{ marginBottom: 8 }}>
          Status: {dockerStatus.running ? '✅ Running' : '❌ Not Running'}
        </div>
        <div style={{ marginBottom: 8 }}>Updates: {dockerStatus.updates}</div>
        
        {dockerUpdates && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 8px 0' }}>Update Status:</h3>
            <div style={{ marginBottom: 8 }}>
              Docker: {dockerUpdates.docker?.updateAvailable ? '🔄 Update Available' : '✅ Up to Date'}
            </div>
            <div style={{ marginBottom: 8 }}>
              Docker Compose: {dockerUpdates.compose?.updateAvailable ? '🔄 Update Available' : '✅ Up to Date'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Last checked: {new Date(dockerUpdates.lastChecked).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {/* Runtime Status */}
      {runtimeStatus && (
        <div style={{ 
          border: '1px solid #e0e0e0', 
          padding: 16, 
          borderRadius: 8, 
          marginBottom: 32,
          backgroundColor: '#f0f8ff'
        }}>
          <h2 style={{ margin: '0 0 16px 0' }}>App Runtime Status</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>App Status:</strong> {runtimeStatus.appRunning ? '🟢 Active' : '⚪ Inactive'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Backend:</strong> {runtimeStatus.backendConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Docker Available:</strong> {runtimeStatus.dockerAvailable ? '🟢 Yes' : '🔴 No'}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 8 }}>
                <strong>Services Running:</strong> {runtimeStatus.servicesRunning.length}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Services Independent:</strong> {runtimeManager.areServicesIndependent() ? '✅ Yes' : '⚠️ No'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Last Check:</strong> {runtimeStatus.lastCheck.toLocaleTimeString()}
              </div>
            </div>
          </div>
          <div style={{ 
            marginTop: 12, 
            padding: 8, 
            backgroundColor: '#e8f4f8', 
            borderRadius: 4, 
            fontSize: 14, 
            color: '#2c5aa0' 
          }}>
            ℹ️ <strong>Runtime Behavior:</strong> This app is active only when launched. Docker services run independently and continue when the app is closed.
          </div>
        </div>
      )}

      {/* Global Controls */}
      <div style={{ 
        border: '1px solid #e0e0e0', 
        padding: 16, 
        borderRadius: 8, 
        marginBottom: 32 
      }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Global Controls</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          <button 
            onClick={() => handleGlobalAction('stop-all')}
            disabled={actionLoading.global}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: actionLoading.global ? 'not-allowed' : 'pointer',
              opacity: actionLoading.global ? 0.6 : 1
            }}
          >
            {actionLoading.global ? 'Processing...' : 'Stop All'}
          </button>
          <button 
            onClick={() => handleGlobalAction('start-all')}
            disabled={actionLoading.global}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: actionLoading.global ? 'not-allowed' : 'pointer',
              opacity: actionLoading.global ? 0.6 : 1
            }}
          >
            {actionLoading.global ? 'Processing...' : 'Start All'}
          </button>
        </div>
      </div>

      {/* Service List */}
      <div>
        <h2 style={{ margin: '0 0 16px 0' }}>Services</h2>
        {selectedServices.length === 0 ? (
          <div style={{ 
            border: '1px solid #e0e0e0', 
            padding: 32, 
            borderRadius: 8, 
            textAlign: 'center' 
          }}>
            No services configured. Click "Edit Setup" to configure services.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {selectedServices.map(serviceKey => {
              const service = serviceConfig.find(s => s.key === serviceKey);
              if (!service) return null;
              
              const status = serviceStatus[serviceKey] || 'Unknown';
              const version = serviceVersions[serviceKey] || 'Loading...';
              const isLoading = actionLoading[serviceKey];
              const updateInfo = serviceUpdates[serviceKey];
              const alertInfo = serviceAlerts[serviceKey];
              const isUpdating = updateLoading[serviceKey];
              
              return (
                <div key={serviceKey} style={{ 
                  border: '1px solid #e0e0e0', 
                  padding: 16, 
                  borderRadius: 8,
                  backgroundColor: alertInfo?.alert ? '#ffe8e8' : '#f9f9f9'
                }}>
                  {alertInfo?.alert && (
                    <div style={{ 
                      marginBottom: 8, 
                      padding: '4px 8px', 
                      backgroundColor: '#ffdddd', 
                      borderRadius: 4, 
                      fontSize: '14px',
                      color: '#721c24'
                    }}>
                      ⚠️ Alert: {alertInfo.status}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 8px 0' }}>{service.name}</h3>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 'bold' }}>Status:</span> 
                        <span style={{ 
                          color: status === 'Running' ? '#28a745' : '#dc3545',
                          marginLeft: 8 
                        }}>
                          {status}
                        </span>
                        {alertInfo && !alertInfo.healthy && status === 'Running' && (
                          <span style={{ marginLeft: 8, color: '#ffc107' }}>⚠️ Unhealthy</span>
                        )}
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 'bold' }}>Version:</span> 
                        <span style={{ marginLeft: 8 }}>{version}</span>
                      </div>
                      {updateInfo && (
                        <div style={{ marginBottom: 16 }}>
                          <span style={{ fontWeight: 'bold' }}>Updates:</span> 
                          <span style={{ 
                            marginLeft: 8, 
                            color: updateInfo.hasUpdate ? '#ffc107' : '#28a745' 
                          }}>
                            {updateInfo.hasUpdate ? '🔄 Update Available' : '✅ Up to Date'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleLaunchService(serviceKey)}
                        disabled={status !== 'Running'}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: status === 'Running' ? '#17a2b8' : '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: status === 'Running' ? 'pointer' : 'not-allowed',
                          fontSize: '14px'
                        }}
                      >
                        Launch
                      </button>
                      <button 
                        onClick={() => handleServiceAction(serviceKey, 'restart')}
                        disabled={isLoading}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffc107',
                          color: 'black',
                          border: 'none',
                          borderRadius: 4,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {isLoading ? 'Processing...' : 'Restart'}
                      </button>
                      <button 
                        onClick={() => handleServiceAction(serviceKey, status === 'Running' ? 'stop' : 'start')}
                        disabled={isLoading}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: status === 'Running' ? '#dc3545' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {isLoading ? 'Processing...' : (status === 'Running' ? 'Stop' : 'Start')}
                      </button>
                      <button 
                        onClick={() => toggleLogs(serviceKey)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '14px'
                        }}
                      >
                        {showLogs[serviceKey] ? 'Hide Logs' : 'Show Logs'}
                      </button>
                      {updateInfo?.hasUpdate && (
                        <button 
                          onClick={() => handleServiceUpdate(serviceKey)}
                          disabled={isUpdating}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#ffc107',
                            color: 'black',
                            border: 'none',
                            borderRadius: 4,
                            cursor: isUpdating ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            opacity: isUpdating ? 0.6 : 1
                          }}
                        >
                          {isUpdating ? 'Updating...' : 'Update'}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {showLogs[serviceKey] && (
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ margin: '0 0 8px 0' }}>Logs</h4>
                      <pre style={{ 
                        backgroundColor: '#000', 
                        color: '#fff', 
                        padding: 12, 
                        borderRadius: 4, 
                        fontSize: '12px', 
                        overflow: 'auto', 
                        maxHeight: '200px' 
                      }}>
                        {serviceLogs[serviceKey] || 'No logs available'}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Advanced Settings Modal */}
      {showAdvancedSettings && (
        <AdvancedSettings onClose={() => setShowAdvancedSettings(false)} />
      )}
    </div>
  );
}
