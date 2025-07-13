import { useEffect, useState, useCallback } from 'react';
import AdvancedSettings from './AdvancedSettings';
import { runtimeManager, type RuntimeStatus } from './services/runtimeManager';
import { Card, Button, Badge, Alert, Spinner } from './components';
import { useToast } from './contexts/ToastContext';
import ConfirmationModal from './components/ConfirmationModal';
import { Drawer } from 'flowbite-react';

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

interface DockerUpdatesType {
  success: boolean;
  docker?: {
    updateAvailable: boolean;
    message?: string;
  };
  compose?: {
    updateAvailable: boolean;
    message?: string;
  };
  lastChecked: string;
}

interface DashboardProps {
  onEditSetup: () => void;
}

export default function Dashboard({ onEditSetup }: DashboardProps) {
  const { showToast } = useToast();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusType>({});
  const [serviceVersions, setServiceVersions] = useState<ServiceVersionType>({});
  const [serviceLogs, setServiceLogs] = useState<ServiceLogsType>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [dockerStatus, setDockerStatus] = useState<{ running: boolean; updates: string }>({
    running: true,
    updates: 'No updates available'
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdateType>({});
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlertsType>({});
  const [updateLoading, setUpdateLoading] = useState<{ [key: string]: boolean }>({});
  const [dockerUpdates, setDockerUpdates] = useState<DockerUpdatesType | null>(null);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    message: string;
    onConfirm: () => void;
  }>({
    message: '',
    onConfirm: () => {},
  });
  // Add state for Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerService, setDrawerService] = useState<string | null>(null);

  const fetchServiceStatus = useCallback(async () => {
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
  }, []);

  const fetchServiceVersions = useCallback(async () => {
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
  }, [selectedServices]);

  const fetchDockerStatus = useCallback(async () => {
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
  }, []);

  const fetchServiceUpdates = useCallback(async () => {
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
  }, [selectedServices]);

  const fetchServiceAlerts = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/monitor');
      const data = await res.json();
      if (data.success) {
        setServiceAlerts(data.services);
      }
    } catch (error) {
      console.error('Error fetching service alerts:', error);
    }
  }, []);

  const fetchDockerUpdates = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/docker/check-updates');
      const data = await res.json();
      if (data.success) {
        setDockerUpdates(data);
      }
    } catch (error) {
      console.error('Error fetching Docker updates:', error);
    }
  }, []);

  const fetchServiceConfig = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/config');
      if (res.ok) {
        const data: ServiceConfigResponse = await res.json();
        if (data.success) {
          setServiceConfig(data.services);
        }
      }
    } catch (error) {
      console.error('Error fetching service configuration:', error);
    }
  }, []);

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
  }, [fetchServiceConfig, fetchServiceStatus, fetchDockerStatus, fetchDockerUpdates]);

  useEffect(() => {
    if (selectedServices.length > 0) {
      fetchServiceVersions();
      fetchServiceUpdates();
      fetchServiceAlerts();
    }
  }, [selectedServices, fetchServiceVersions, fetchServiceUpdates, fetchServiceAlerts]);

  // Set up monitoring interval for service alerts
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedServices.length > 0) {
        fetchServiceAlerts();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [selectedServices, fetchServiceAlerts]);

  const handleServiceAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    const key = `${serviceName}:${action}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`http://localhost:3001/api/services/${serviceName}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
                showToast(`${serviceName} ${action}ed successfully`, 'success');
        await fetchServiceStatus();
      } else {
        showToast(`Failed to ${action} ${serviceName}: ${data.message}`, 'error');
      }
    } catch (error) {
      showToast(`Error ${action}ing ${serviceName}: ${error}`, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleGlobalAction = (action: 'start-all' | 'stop-all') => {
    const key = action === 'start-all' ? 'startAll' : 'stopAll';
    const actionText = action === 'start-all' ? 'start all' : 'stop all';
    setConfirmationModal({
      message: `Are you sure you want to ${actionText} services?`,
      onConfirm: async () => {
        setOpenModal(false);
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
          const res = await fetch(`http://localhost:3001/api/services/${action}`, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            showToast(`All services ${action.split('-')[0]}ed successfully`, 'success');
            await fetchServiceStatus();
          } else {
            showToast(`Failed to ${actionText}: ${data.message}`, 'error');
          }
        } catch (error) {
          showToast(`Error ${actionText}: ${error}`, 'error');
        } finally {
          setActionLoading(prev => ({ ...prev, [key]: false }));
        }
      }
    });
    setOpenModal(true);
  };

  const handleLaunchService = async (serviceName: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/services/${serviceName}/launch-url`);
      const data = await res.json();
      if (data.success) {
        window.open(data.url, '_blank');
      } else {
        showToast(`Failed to get launch URL for ${serviceName}: ${data.message}`, 'error');
      }
    } catch (error) {
      showToast(`Error launching ${serviceName}: ${error}`, 'error');
    }
  };

  const openLogsDrawer = async (serviceName: string) => {
    if (drawerService !== serviceName) {
      try {
        const res = await fetch(`http://localhost:3001/api/services/${serviceName}/logs`);
        const data = await res.json();
        if (data.success) {
          setServiceLogs(prev => ({ ...prev, [serviceName]: data.logs }));
          setDrawerService(serviceName);
          setDrawerOpen(true);
        } else {
          showToast(`Failed to get logs for ${serviceName}: ${data.message}`, 'error');
        }
      } catch (error) {
        showToast(`Error getting logs for ${serviceName}: ${error}`, 'error');
      }
    } else {
      setDrawerOpen(true);
    }
  };
  const closeLogsDrawer = () => {
    setDrawerOpen(false);
  };

  const handleEditSetup = () => {
    setConfirmationModal({
      message: 'Are you sure you want to edit the setup? This will take you back to the setup wizard.',
      onConfirm: () => {
        onEditSetup();
        setOpenModal(false);
      },
    });
    setOpenModal(true);
  };

  const handleServiceUpdate = (serviceName: string) => {
    setConfirmationModal({
      message: `Are you sure you want to update ${serviceName}? This will download the latest version and restart the service.`,
      onConfirm: async () => {
        setOpenModal(false);
        setUpdateLoading(prev => ({ ...prev, [serviceName]: true }));
        try {
          const res = await fetch(`http://localhost:3001/api/services/${serviceName}/update`, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            showToast(`${serviceName} updated successfully`, 'success');
            await fetchServiceStatus();
            await fetchServiceVersions();
            await fetchServiceUpdates();
          } else {
            showToast(`Failed to update ${serviceName}: ${data.message}`, 'error');
          }
        } catch (error) {
          showToast(`Error updating ${serviceName}: ${error}`, 'error');
        } finally {
          setUpdateLoading(prev => ({ ...prev, [serviceName]: false }));
        }
      }
    });
    setOpenModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Card className="max-w-md w-full p-6">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg text-gray-700 dark:text-gray-300">Loading dashboard...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Media Center Dashboard</h1>
        <div className="flex space-x-2">
          <Button onClick={() => setShowAdvancedSettings(true)} color="gray">
            Advanced Settings
          </Button>
          <Button onClick={handleEditSetup} color="blue">
            Edit Setup
          </Button>
        </div>
      </div>

      {/* Docker Status and Updates */}
      <Card className={`mb-6 ${dockerStatus.running ? 'bg-green-50' : 'bg-red-50'}`}>
        <Card.Header>
          <h2 className="text-xl font-semibold">Docker Status</h2>
        </Card.Header>
        <Card.Body>
          <div className="mb-2">
            Status: {dockerStatus.running ? 
              <Badge color="green">✅ Running</Badge> : 
              <Badge color="red">❌ Not Running</Badge>}
          </div>
          <div className="mb-2">Updates: {dockerStatus.updates}</div>
          
          {dockerUpdates && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">Update Status:</h3>
              <div className="mb-2">
                Docker: {dockerUpdates.docker?.updateAvailable ? 
                  <Badge color="yellow">🔄 Update Available</Badge> : 
                  <Badge color="green">✅ Up to Date</Badge>}
              </div>
              <div className="mb-2">
                Docker Compose: {dockerUpdates.compose?.updateAvailable ? 
                  <Badge color="yellow">🔄 Update Available</Badge> : 
                  <Badge color="green">✅ Up to Date</Badge>}
              </div>
              <div className="text-xs text-gray-500">
                Last checked: {new Date(dockerUpdates.lastChecked).toLocaleString()}
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Runtime Status */}
      {runtimeStatus && (
        <Card className="mb-6 bg-blue-50">
          <Card.Header>
            <h2 className="text-xl font-semibold">App Runtime Status</h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="mb-2">
                  <strong>App Status:</strong> {runtimeStatus.appRunning ? 
                    <Badge color="green">Active</Badge> : 
                    <Badge color="gray">Inactive</Badge>}
                </div>
                <div className="mb-2">
                  <strong>Backend:</strong> {runtimeStatus.backendConnected ? 
                    <Badge color="green">Connected</Badge> : 
                    <Badge color="red">Disconnected</Badge>}
                </div>
                <div className="mb-2">
                  <strong>Docker Available:</strong> {runtimeStatus.dockerAvailable ? 
                    <Badge color="green">Yes</Badge> : 
                    <Badge color="red">No</Badge>}
                </div>
              </div>
              <div>
                <div className="mb-2">
                  <strong>Services Running:</strong> {runtimeStatus.servicesRunning.length}
                </div>
                <div className="mb-2">
                  <strong>Services Independent:</strong> {runtimeManager.areServicesIndependent() ? 
                    <Badge color="green">Yes</Badge> : 
                    <Badge color="yellow">No</Badge>}
                </div>
                <div className="mb-2">
                  <strong>Last Check:</strong> {runtimeStatus.lastCheck.toLocaleTimeString()}
                </div>
              </div>
            </div>
            <Alert color="blue" className="mt-3">
              <strong>Runtime Behavior:</strong> This app is active only when launched. Docker services run independently and continue when the app is closed.
            </Alert>
          </Card.Body>
        </Card>
      )}

      {/* Global Controls */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-xl font-semibold">Global Controls</h2>
        </Card.Header>
        <Card.Body>
          <div className="flex gap-4">
            <Button 
              color="red"
              onClick={() => handleGlobalAction('stop-all')}
              loading={actionLoading.stopAll}
            >
              Stop All
            </Button>
            <Button 
              color="green"
              onClick={() => handleGlobalAction('start-all')}
              loading={actionLoading.startAll}
            >
              Start All
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Service List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Services</h2>
        {selectedServices.length === 0 ? (
          <Card>
            <Card.Body className="text-center py-8">
              No services configured. Click "Edit Setup" to configure services.
            </Card.Body>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {selectedServices.map(serviceKey => {
              const service = serviceConfig.find(s => s.key === serviceKey);
              if (!service) return null;
              
              const status = serviceStatus[serviceKey] || 'Unknown';
              const version = serviceVersions[serviceKey] || 'Loading...';
              const updateInfo = serviceUpdates[serviceKey];
              const alertInfo = serviceAlerts[serviceKey];
              const isUpdating = updateLoading[serviceKey];
              
              return (
                <Card key={serviceKey} className={alertInfo?.alert ? 'bg-red-50' : ''}>
                  {alertInfo?.alert && (
                    <Alert color="red" className="mb-3">
                      ⚠️ Alert: {alertInfo.status}
                    </Alert>
                  )}
                  
                  <Card.Body>
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">{service.name}</h3>
                        <div className="mb-2">
                          <span className="font-bold">Status:</span> 
                          <Badge 
                            color={status === 'Running' ? 'green' : 'red'}
                            className="ml-2"
                          >
                            {status}
                          </Badge>
                          {alertInfo && !alertInfo.healthy && status === 'Running' && (
                            <Badge color="yellow" className="ml-2">Unhealthy</Badge>
                          )}
                        </div>
                        <div className="mb-2">
                          <span className="font-bold">Version:</span> 
                          <span className="ml-2">{version}</span>
                        </div>
                        {updateInfo && (
                          <div className="mb-4">
                            <span className="font-bold">Updates:</span> 
                            <Badge 
                              color={updateInfo.hasUpdate ? 'yellow' : 'green'}
                              className="ml-2"
                            >
                              {updateInfo.hasUpdate ? '🔄 Update Available' : '✅ Up to Date'}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button 
                          size="sm"
                          color="blue"
                          onClick={() => handleLaunchService(serviceKey)}
                          disabled={status !== 'Running'}
                        >
                          Launch
                        </Button>
                        <Button 
                          size="sm"
                          color="yellow"
                          onClick={() => handleServiceAction(serviceKey, 'restart')}
                          loading={actionLoading[`${serviceKey}:restart`]}
                        >
                          Restart
                        </Button>
                        <Button 
                          size="sm"
                          color={status === 'Running' ? 'red' : 'green'}
                          onClick={() => handleServiceAction(serviceKey, status === 'Running' ? 'stop' : 'start')}
                          loading={actionLoading[`${serviceKey}:${status === 'Running' ? 'stop' : 'start'}`]}
                        >
                          {status === 'Running' ? 'Stop' : 'Start'}
                        </Button>
                        <Button 
                          size="sm"
                          color="gray"
                          onClick={() => openLogsDrawer(serviceKey)}
                        >
                          Show Logs
                        </Button>
                        {updateInfo?.hasUpdate && (
                          <Button 
                            size="sm"
                            color="yellow"
                            onClick={() => handleServiceUpdate(serviceKey)}
                            loading={isUpdating}
                          >
                            Update
                          </Button>
                        )}
                      </div>
                    </div>
                    
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Advanced Settings Modal */}
      {showAdvancedSettings && (
        <AdvancedSettings onClose={() => setShowAdvancedSettings(false)} />
      )}

      {/* Confirmation Modal */}
      {openModal && (
        <ConfirmationModal
          show={openModal}
          onClose={() => setOpenModal(false)}
          onConfirm={confirmationModal.onConfirm}
          message={confirmationModal.message}
        />
      )}

      {/* Logs Drawer */}
      <Drawer open={drawerOpen} onClose={closeLogsDrawer} position="right" className="!w-[900px] max-w-full">
        <div className="p-4 border-b w-full">
          <span className="text-lg font-semibold">{drawerService ? `${drawerService} Logs` : 'Logs'}</span>
        </div>
        <div className="p-4 w-full overflow-y-auto max-h-[70vh]">
          <pre className="bg-gray-900 text-white p-3 rounded text-xs">
            {drawerService ? (serviceLogs[drawerService] || 'No logs available') : 'No logs available'}
          </pre>
        </div>
      </Drawer>
    </div>
  );
}

