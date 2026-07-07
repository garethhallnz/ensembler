import { useEffect, useState, useCallback } from 'react';
import AdvancedSettings from './AdvancedSettings';
import { runtimeManager, type RuntimeStatus } from './services/runtimeManager';
import { Card, Button, Badge, Alert } from './components';
import { useToast } from './contexts/ToastContext';
import ConfirmationModal from './components/ConfirmationModal';
import { Drawer, Progress } from 'flowbite-react';
import { HiExternalLink, HiRefresh, HiPlay, HiStop, HiDocumentText, HiArrowCircleUp, HiCog, HiPencilAlt, HiChevronDown, HiChevronUp } from 'react-icons/hi';

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

export default function Dashboard() {
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
  const [isSystemStatusExpanded, setIsSystemStatusExpanded] = useState(false);

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

  const refreshDashboard = useCallback(async () => {
    await fetchServiceConfig();
    await fetchServiceStatus();
    await fetchDockerStatus();
    const newStatus = await runtimeManager.checkStatus();
    setRuntimeStatus(newStatus);
  }, [fetchServiceConfig, fetchServiceStatus, fetchDockerStatus]);

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
        const newStatus = await runtimeManager.checkStatus();
        setRuntimeStatus(newStatus); // Ensure up-to-date status
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
        const newStatus = await runtimeManager.checkStatus();
        setRuntimeStatus(newStatus); // Ensure up-to-date status
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
            const newStatus = await runtimeManager.checkStatus();
            setRuntimeStatus(newStatus); // Ensure up-to-date status
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
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-8">
            <div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-64 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-48"></div>
            </div>
            <div className="flex space-x-2">
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
            </div>
          </div>
          <div className="mb-8">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24 mb-3"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full mb-4"></div>
                  <div className="flex space-x-2">
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Dockarr Dashboard</h1>
          <p className="text-left text-lg text-gray-600 dark:text-gray-400">Manage your media center services</p>
        </div>
        <div className="flex items-center gap-4">
          
          {/* Settings Group */}
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              onClick={() => setShowAdvancedSettings(true)} 
              tooltip="Advanced Settings"
            >
              <HiCog className="inline-block mr-1" /> Settings
            </Button>
          </div>
          
          {/* Divider */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
          
          {/* Global Controls Group */}
          <div className="flex items-center gap-2">
            {(() => {
              const runningServices = selectedServices.filter(service => serviceStatus[service] === 'Running');
              const stoppedServices = selectedServices.filter(service => serviceStatus[service] !== 'Running');
              const allRunning = selectedServices.length > 0 && runningServices.length === selectedServices.length;
              const allStopped = selectedServices.length > 0 && stoppedServices.length === selectedServices.length;
              
              return (
                <>
                  <Button 
                    variant="danger"
                    onClick={() => handleGlobalAction('stop-all')}
                    loading={actionLoading.stopAll}
                    disabled={globalActionProgress !== null || selectedServices.length === 0 || allStopped}
                    tooltip={
                      selectedServices.length === 0 
                        ? 'No services to stop' 
                        : allStopped 
                          ? 'All services are already stopped' 
                          : 'Stop All Services'
                    }
                  >
                    <HiStop className="inline-block mr-1" /> Stop All
                  </Button>
                  <Button 
                    variant="success"
                    onClick={() => handleGlobalAction('start-all')}
                    loading={actionLoading.startAll}
                    disabled={globalActionProgress !== null || selectedServices.length === 0 || allRunning}
                    tooltip={
                      selectedServices.length === 0 
                        ? 'No services to start' 
                        : allRunning 
                          ? 'All services are already running' 
                          : 'Start All Services'
                    }
                  >
                    <HiPlay className="inline-block mr-1" /> Start All
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Progress bar for global actions (above service list, no container/title) */}
      {globalActionProgress !== null && (
        <div className="mb-4">
          <Progress progress={globalActionProgress} size="lg" />
        </div>
      )}

      {/* Service List */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-left text-2xl font-bold text-gray-900 dark:text-white">Services</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} configured</p>
          </div>
        </div>
        {selectedServices.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Card.Body className="text-center py-12">
              <div className="space-y-4">
                <div className="text-6xl text-gray-400">🚀</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">No Services Configured</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Get started by adding and configuring your media center services. 
                  You can add services individually as needed.
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => setShowAdvancedSettings(true)}
                  className="mt-4"
                >
                  <HiPencilAlt className="inline-block mr-2" /> Add Services
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
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
                ? 'border-red-500 dark:border-red-400'
                : status === 'Running'
                  ? 'border-green-500 dark:border-green-400'
                  : 'border-gray-300 dark:border-gray-600';

              return (
                <Card
                  key={serviceKey}
                  className={`relative flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-200 border-l ${borderColor} bg-white dark:bg-gray-800`}
                >
                  {/* Card Header */}
                  <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-left text-xl font-bold text-gray-900 dark:text-white mb-1">{service.name}</h3>
                        <p className="text-left text-sm text-gray-600 dark:text-gray-400">{service.description}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Badge variant={status === 'Running' ? 'running' : 'stopped'}>
                          {status}
                        </Badge>
                        {alertInfo && !alertInfo.healthy && status === 'Running' && (
                          <Badge variant="warning">Unhealthy</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <Card.Body className="flex-1 flex flex-col justify-between px-6 pb-6">
                    <div className="space-y-3">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Version</span>
                          <span className="text-sm font-mono text-gray-900 dark:text-white">{version}</span>
                        </div>
                        {updateInfo && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Updates</span>
                            <Badge variant={updateInfo.hasUpdate ? 'update' : 'success'} size="sm">
                              {updateInfo.hasUpdate ? '🔄 Update Available' : '✅ Up to Date'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="mt-6">
                      <div className="flex flex-wrap gap-2">
                        {/* Primary Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleLaunchService(serviceKey)}
                            disabled={status !== 'Running'}
                            aria-label={`Launch ${service.name}`}
                            tooltip={status !== 'Running' ? 'Service must be running to launch' : 'Launch Service'}
                          >
                            <HiExternalLink className="inline-block mr-1" /> Launch
                          </Button>
                          <Button
                            size="sm"
                            variant={status === 'Running' ? 'danger' : 'success'}
                            onClick={() => handleServiceAction(serviceKey, status === 'Running' ? 'stop' : 'start')}
                            loading={actionLoading[`${serviceKey}:${status === 'Running' ? 'stop' : 'start'}`]}
                            aria-label={`${status === 'Running' ? 'Stop' : 'Start'} ${service.name}`}
                            tooltip={status === 'Running' ? 'Stop Service' : 'Start Service'}
                          >
                            {status === 'Running' ? <HiStop className="inline-block mr-1" /> : <HiPlay className="inline-block mr-1" />}
                            {status === 'Running' ? 'Stop' : 'Start'}
                          </Button>
                        </div>
                        
                        {/* Secondary Actions */}
                        <div className="flex items-center gap-2">
                          {status === 'Running' && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleServiceAction(serviceKey, 'restart')}
                              loading={actionLoading[`${serviceKey}:restart`]}
                              aria-label={`Restart ${service.name}`}
                              tooltip="Restart Service"
                            >
                              <HiRefresh className="inline-block mr-1" /> Restart
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="neutral"
                            onClick={() => openLogsDrawer(serviceKey)}
                            aria-label={`Show logs for ${service.name}`}
                            tooltip="Show Logs"
                          >
                            <HiDocumentText className="inline-block mr-1" /> Logs
                          </Button>
                          {updateInfo?.hasUpdate && (
                            <Button
                              size="sm"
                              variant="warning"
                              onClick={() => handleServiceUpdate(serviceKey)}
                              loading={isUpdating}
                              aria-label={`Update ${service.name}`}
                              tooltip="Update Service"
                            >
                              <HiArrowCircleUp className="inline-block mr-1" /> Update
                            </Button>
                          )}
                        </div>
                      </div>
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
          <Card.Header 
            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            onClick={() => {
              console.log('System Status clicked, current state:', isSystemStatusExpanded);
              setIsSystemStatusExpanded(!isSystemStatusExpanded);
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Status</h2>
                {dockerStatus.running && runtimeStatus?.appRunning ? (
                  <span className="text-green-500" title="All systems operational">✔️</span>
                ) : (
                  <span className="text-yellow-500" title="Attention required">⚠️</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                {!isSystemStatusExpanded && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Docker:</span>
                      {dockerStatus.running ? (
                        <Badge variant="running" size="sm">Running</Badge>
                      ) : (
                        <Badge variant="stopped" size="sm">Stopped</Badge>
                      )}
                    </span>
                    {runtimeStatus && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Runtime:</span>
                        {runtimeStatus.appRunning ? (
                          <Badge variant="running" size="sm">Active</Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">Inactive</Badge>
                        )}
                      </span>
                    )}
                  </div>
                )}
                {isSystemStatusExpanded ? (
                  <HiChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <HiChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </div>
            </div>
          </Card.Header>
          {isSystemStatusExpanded && (
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
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Status:</span>
                  {dockerStatus.running ? (
                    <Badge variant="running">Running</Badge>
                  ) : (
                    <Badge variant="stopped">Not Running</Badge>
                  )}
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">Updates:</span>
                  <span className="text-gray-900 dark:text-white">{dockerStatus.updates}</span>
                </div>
                {dockerUpdates && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Docker:</span>
                      {dockerUpdates.docker?.updateAvailable ? (
                        <Badge variant="update">🔄 Update Available</Badge>
                      ) : (
                        <Badge variant="success">Up to Date</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Compose:</span>
                      {dockerUpdates.compose?.updateAvailable ? (
                        <Badge variant="update">🔄 Update Available</Badge>
                      ) : (
                        <Badge variant="success">Up to Date</Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                    <span className="font-semibold text-gray-700 dark:text-gray-300">App:</span>
                    {runtimeStatus.appRunning ? (
                      <Badge variant="running">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Backend:</span>
                    {runtimeStatus.backendConnected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Badge variant="error">Disconnected</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Docker Available:</span>
                    {runtimeStatus.dockerAvailable ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="error">No</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Services Running:</span>
                    <span className="text-gray-900 dark:text-white">{runtimeStatus.servicesRunning.length}</span>
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Services Independent:</span>
                    {runtimeManager.areServicesIndependent() ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="warning">No</Badge>
                    )}
                  </div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Last Check:</span>
                    <span className="text-gray-900 dark:text-white">{runtimeStatus.lastCheck.toLocaleTimeString()}</span>
                  </div>
                  <Alert color="blue" className="mt-3">
                    <span className="font-semibold">Runtime Behavior:</span> This app is active only when launched. Docker services run independently and continue when the app is closed.
                  </Alert>
                </div>
              )}
            </div>
            </Card.Body>
          )}
        </Card>
      )}

      {/* Advanced Settings Drawer */}
      <Drawer 
        open={showAdvancedSettings} 
        onClose={async () => {
          setShowAdvancedSettings(false);
          // Refresh dashboard data when drawer is closed
          await refreshDashboard();
        }} 
        position="right" 
        className="!w-[900px] max-w-full"
      >
        <div className="h-full">
          <AdvancedSettings onClose={async () => {
            setShowAdvancedSettings(false);
            // Refresh dashboard data after settings are saved
            await refreshDashboard();
          }} />
        </div>
      </Drawer>

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
          <pre className="bg-gray-900 text-left text-white p-3 rounded text-xs">
            {drawerService ? (serviceLogs[drawerService] || 'No logs available') : 'No logs available'}
          </pre>
        </div>
      </Drawer>
    </div>
  );
}

