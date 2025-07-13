import { useEffect, useState, useCallback } from 'react';
import AdvancedSettings from './AdvancedSettings';
import { runtimeManager, type RuntimeStatus } from './services/runtimeManager';
import { Card, Button, Badge, Alert, Spinner } from './components';
import { useToast } from './contexts/ToastContext';
import ConfirmationModal from './components/ConfirmationModal';
import { Drawer, Progress } from 'flowbite-react';
import { HiExternalLink, HiRefresh, HiPlay, HiStop, HiDocumentText, HiArrowCircleUp, HiCog, HiPencilAlt } from 'react-icons/hi';

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
  const [globalActionProgress, setGlobalActionProgress] = useState<number | null>(null);

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
        setGlobalActionProgress(0);
        let completed = 0;
        for (const service of selectedServices) {
          try {
            const res = await fetch(`http://localhost:3001/api/services/${service}/${action === 'start-all' ? 'start' : 'stop'}`, {
              method: 'POST'
            });
            const data = await res.json();
            if (!data.success) {
              showToast(`Failed to ${action.split('-')[0]} ${service}: ${data.message}`, 'error');
            }
          } catch (error) {
            showToast(`Error ${action.split('-')[0]}ing ${service}: ${error}`, 'error');
          }
          completed += 1;
          setGlobalActionProgress(Math.round((completed / selectedServices.length) * 100));
        }
        setActionLoading(prev => ({ ...prev, [key]: false }));
        setGlobalActionProgress(null);
        await fetchServiceStatus();
        showToast(`All services ${action.split('-')[0]}ed`, 'success');
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
          <Button onClick={() => setShowAdvancedSettings(true)} color="gray" title="Advanced Settings">
            <HiCog className="inline-block mr-1" /> Advanced Settings
          </Button>
          <Button onClick={handleEditSetup} color="blue" title="Edit Setup">
            <HiPencilAlt className="inline-block mr-1" /> Edit Setup
          </Button>
        </div>
      </div>

      {/* Global Controls */}
      <Card className="mb-6">
        <Card.Header>
          <h2 className="text-xl font-semibold">Global Controls</h2>
        </Card.Header>
        <Card.Body>
          {globalActionProgress !== null && (
            <div className="mb-4">
              <Progress progress={globalActionProgress} size="lg" />
            </div>
          )}
          <div className="flex gap-4">
            <Button 
              color="red"
              onClick={() => handleGlobalAction('stop-all')}
              loading={actionLoading.stopAll}
              disabled={globalActionProgress !== null}
              title="Stop All Services"
            >
              <HiStop className="inline-block mr-1" /> Stop All
            </Button>
            <Button 
              color="green"
              onClick={() => handleGlobalAction('start-all')}
              loading={actionLoading.startAll}
              disabled={globalActionProgress !== null}
              title="Start All Services"
            >
              <HiPlay className="inline-block mr-1" /> Start All
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
              
              // Determine border color
              const borderColor = alertInfo?.alert
                ? 'border-red-500'
                : status === 'Running'
                  ? 'border-green-500'
                  : 'border-gray-300';

              return (
                <Card
                  key={serviceKey}
                  className={`relative flex flex-col h-full shadow-lg border-l-4 ${borderColor}`}
                >
                  {/* Alert Banner */}
                  {alertInfo?.alert && (
                    <div className="absolute top-0 left-0 w-full bg-red-100 text-red-700 px-4 py-2 rounded-t flex items-center gap-2 z-10">
                      <span role="img" aria-label="Alert">⚠️</span>
                      <span className="font-semibold">{alertInfo.status}</span>
                    </div>
                  )}

                  {/* Card Header */}
                  <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <h3 className="text-xl font-bold">{service.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge color={status === 'Running' ? 'green' : 'red'}>
                        {status}
                      </Badge>
                      {alertInfo && !alertInfo.healthy && status === 'Running' && (
                        <Badge color="yellow">Unhealthy</Badge>
                      )}
                    </div>
                  </div>
                  <hr className="mx-4" />

                  {/* Card Body */}
                  <Card.Body className="flex-1 flex flex-col justify-between px-4 pb-4">
                    <div className="mb-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Version:</span>
                        <span>{version}</span>
                      </div>
                      {updateInfo && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Updates:</span>
                          <Badge color={updateInfo.hasUpdate ? 'yellow' : 'green'}>
                            {updateInfo.hasUpdate ? '🔄 Update Available' : '✅ Up to Date'}
                          </Badge>
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Button
                        size="sm"
                        color="blue"
                        onClick={() => handleLaunchService(serviceKey)}
                        disabled={status !== 'Running'}
                        aria-label={`Launch ${service.name}`}
                        title="Launch Service"
                      >
                        <HiExternalLink className="inline-block mr-1" /> Launch
                      </Button>
                      <Button
                        size="sm"
                        color="yellow"
                        onClick={() => handleServiceAction(serviceKey, 'restart')}
                        loading={actionLoading[`${serviceKey}:restart`]}
                        aria-label={`Restart ${service.name}`}
                        title="Restart Service"
                      >
                        <HiRefresh className="inline-block mr-1" /> Restart
                      </Button>
                      <Button
                        size="sm"
                        color={status === 'Running' ? 'red' : 'green'}
                        onClick={() => handleServiceAction(serviceKey, status === 'Running' ? 'stop' : 'start')}
                        loading={actionLoading[`${serviceKey}:${status === 'Running' ? 'stop' : 'start'}`]}
                        aria-label={`${status === 'Running' ? 'Stop' : 'Start'} ${service.name}`}
                        title={status === 'Running' ? 'Stop Service' : 'Start Service'}
                      >
                        {status === 'Running' ? <HiStop className="inline-block mr-1" /> : <HiPlay className="inline-block mr-1" />}
                        {status === 'Running' ? 'Stop' : 'Start'}
                      </Button>
                      <Button
                        size="sm"
                        color="gray"
                        onClick={() => openLogsDrawer(serviceKey)}
                        aria-label={`Show logs for ${service.name}`}
                        title="Show Logs"
                      >
                        <HiDocumentText className="inline-block mr-1" /> Logs
                      </Button>
                      {updateInfo?.hasUpdate && (
                        <Button
                          size="sm"
                          color="yellow"
                          onClick={() => handleServiceUpdate(serviceKey)}
                          loading={isUpdating}
                          aria-label={`Update ${service.name}`}
                          title="Update Service"
                        >
                          <HiArrowCircleUp className="inline-block mr-1" /> Update
                        </Button>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Combined Docker Status and App Runtime Status */}
      {(dockerStatus || runtimeStatus) && (
        <Card className="mt-6">
          <Card.Header>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <span>System Status</span>
              {dockerStatus.running && runtimeStatus?.appRunning ? (
                <span className="text-green-500" title="All systems operational">✔️</span>
              ) : (
                <span className="text-yellow-500" title="Attention required">⚠️</span>
              )}
            </h2>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Docker Status Section */}
              <div className="rounded-lg bg-green-50 dark:bg-green-900/30 p-4 shadow-sm border border-green-200 dark:border-green-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-medium text-green-700 dark:text-green-300">Docker</span>
                  {dockerStatus.running ? (
                    <span className="text-green-500 text-xl">✅</span>
                  ) : (
                    <span className="text-red-500 text-xl">❌</span>
                  )}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold">Status:</span>
                  {dockerStatus.running ? (
                    <Badge color="green">Running</Badge>
                  ) : (
                    <Badge color="red">Not Running</Badge>
                  )}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold">Updates:</span>
                  <span>{dockerStatus.updates}</span>
                </div>
                {dockerUpdates && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Docker:</span>
                      {dockerUpdates.docker?.updateAvailable ? (
                        <Badge color="yellow">🔄 Update Available</Badge>
                      ) : (
                        <Badge color="green">Up to Date</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Compose:</span>
                      {dockerUpdates.compose?.updateAvailable ? (
                        <Badge color="yellow">🔄 Update Available</Badge>
                      ) : (
                        <Badge color="green">Up to Date</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Last checked: {new Date(dockerUpdates.lastChecked).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              {/* App Runtime Status Section */}
              {runtimeStatus && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 p-4 shadow-sm border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg font-medium text-blue-700 dark:text-blue-300">App Runtime</span>
                    {runtimeStatus.appRunning ? (
                      <span className="text-green-500 text-xl">🟢</span>
                    ) : (
                      <span className="text-gray-400 text-xl">⚪</span>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">App:</span>
                    {runtimeStatus.appRunning ? (
                      <Badge color="green">Active</Badge>
                    ) : (
                      <Badge color="gray">Inactive</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">Backend:</span>
                    {runtimeStatus.backendConnected ? (
                      <Badge color="green">Connected</Badge>
                    ) : (
                      <Badge color="red">Disconnected</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">Docker Available:</span>
                    {runtimeStatus.dockerAvailable ? (
                      <Badge color="green">Yes</Badge>
                    ) : (
                      <Badge color="red">No</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">Services Running:</span>
                    <span>{runtimeStatus.servicesRunning.length}</span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">Services Independent:</span>
                    {runtimeManager.areServicesIndependent() ? (
                      <Badge color="green">Yes</Badge>
                    ) : (
                      <Badge color="yellow">No</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold">Last Check:</span>
                    <span>{runtimeStatus.lastCheck.toLocaleTimeString()}</span>
                  </div>
                  <Alert color="blue" className="mt-3">
                    <span className="font-semibold">Runtime Behavior:</span> This app is active only when launched. Docker services run independently and continue when the app is closed.
                  </Alert>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      )}

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

