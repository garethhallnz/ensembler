import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from './requests/client';
import { useTranslation } from 'react-i18next';
import AdvancedSettings from './AdvancedSettings';
import { runtimeManager, type RuntimeStatus } from './services/runtimeManager';
import Card from './components/atoms/Card';
import Button from './components/atoms/Button';
import ServiceConfigModal from './components/organisms/ServiceConfigModal';
import AddServiceModal from './components/organisms/AddServiceModal';
import ServiceCard from './components/organisms/ServiceCard';
import SetupChecklist from './components/organisms/SetupChecklist';
import DiagnosticsPanel from './components/organisms/DiagnosticsPanel';
import LogsDrawer from './components/organisms/LogsDrawer';
import Logo from './components/atoms/Logo';
import DocsButton from './components/molecules/DocsButton';
import ActionErrorModal from './components/molecules/ActionErrorModal';
import SystemChecksBanner from './components/organisms/SystemChecksBanner';
import { useToast } from './contexts/ToastContext';
import { useServiceTabs } from './contexts/ServiceTabsContext';
import { isDesktopApp } from './utils/selectDirectory';
import { apiMessage } from './utils/apiMessage';
import { usePolledSetupStatus } from './hooks/usePolledSetupStatus';
import { PENDING_STATUS_LABEL_KEY, serviceStatusLabel, serviceStatusDotClass } from './utils/serviceStatus';
import ConfirmationModal from './components/molecules/ConfirmationModal';
import { Drawer, Progress } from 'flowbite-react';
import { HiPlay, HiStop, HiArrowCircleUp, HiCog, HiPlus } from 'react-icons/hi';

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


interface ServiceUpdateType {
  [key: string]: { hasUpdate: boolean | null };
}

interface ServiceAlertsType {
  [key: string]: { alert: boolean; status: string; healthy: boolean };
}

interface DashboardProps {
  // Called after a complete reset so the app can return to the wizard in place.
  onResetComplete: () => void;
}

// Plain-language role for a service, so a card says what it's for rather than
// relying on jargon like "PVR for Usenet and BitTorrent users". Values are
// translation-key suffixes under dashboard.roles.
const SERVICE_ROLES: { [key: string]: string } = {
  sonarr: 'tvShows',
  radarr: 'movies',
  bazarr: 'subtitles',
  plex: 'streams',
  jellyfin: 'streams',
  emby: 'streams',
  transmission: 'downloads',
  deluge: 'downloads',
  prowlarr: 'indexers',
  jackett: 'indexers',
  overseerr: 'requests',
};

const CATEGORY_ROLES: { [key: string]: string } = {
  media: 'streams',
  management: 'library',
  torrent: 'downloads',
  indexer: 'indexers',
  request: 'requests',
};

const serviceRoleKey = (key: string, category: string): string =>
  SERVICE_ROLES[key] || CATEGORY_ROLES[category] || '';

export default function Dashboard({ onResetComplete }: DashboardProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { openService } = useServiceTabs();
  const [serviceStatus, setServiceStatus] = useState<ServiceStatusType>({});
  const [serviceLogs, setServiceLogs] = useState<ServiceLogsType>({});
  // The enabled services are exactly the keys the status endpoint returns —
  // derive them rather than keeping a second copy that can drift.
  const selectedServices = useMemo(() => Object.keys(serviceStatus), [serviceStatus]);
  const [loading, setLoading] = useState(true);
  const plexWiringInFlight = useRef(false);
  const prowlarrNeedsIndexers = usePolledSetupStatus<{ enabled: boolean; hasIndexers: boolean }>({
    endpoint: '/api/services/prowlarr/indexer-status',
    dep: serviceStatus.prowlarr,
    map: d => d.enabled === true && d.hasIndexers === false,
  });
  const plexNeedsSignIn = usePolledSetupStatus<{ enabled: boolean; signedIn: boolean; librariesConfigured: boolean }>({
    endpoint: '/api/services/plex/setup-status',
    dep: serviceStatus.plex,
    map: d => d.enabled === true && d.signedIn === false,
    // Once signed in but libraries aren't created yet, run just the Plex setup
    // step. The in-flight guard prevents overlapping runs on successive polls.
    onData: d => {
      if (d.enabled === true && d.signedIn === true && d.librariesConfigured === false && !plexWiringInFlight.current) {
        plexWiringInFlight.current = true;
        apiFetch('/api/services/plex/setup', { method: 'POST' }).finally(() => {
          plexWiringInFlight.current = false;
        });
      }
    },
  });
  const overseerrNeedsSetup = usePolledSetupStatus<{ enabled: boolean; initialized: boolean }>({
    endpoint: '/api/services/overseerr/setup-status',
    dep: serviceStatus.overseerr,
    map: d => d.enabled === true && d.initialized === false,
  });
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [actionError, setActionError] = useState<{ title: string; detail?: string; serviceKey: string; retry: () => void } | null>(null);
  const [dockerStatus, setDockerStatus] = useState<{ running: boolean; updates: string }>({
    running: true,
    updates: 'No updates available'
  });
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdateType>({});
  const [serviceVersions, setServiceVersions] = useState<{ [key: string]: string }>({});
  const [pinnedVersions, setPinnedVersions] = useState<{ [key: string]: string }>({});
  const [serviceAlerts, setServiceAlerts] = useState<ServiceAlertsType>({});
  const [updateLoading, setUpdateLoading] = useState<{ [key: string]: boolean }>({});
  const autoCheckedRef = useRef(false);
  const [updateChecking, setUpdateChecking] = useState<{ [key: string]: boolean }>({});
  const [recentlyChecked, setRecentlyChecked] = useState<{ [key: string]: boolean }>({});
  const [checkingAllUpdates, setCheckingAllUpdates] = useState(false);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig[]>([]);
  // Per-service config ('edit') and add-service ('add') both use one modal.
  const [configModal, setConfigModal] = useState<{ service: ServiceConfig; mode: 'edit' | 'add' } | null>(null);
  const [showAddService, setShowAddService] = useState(false);
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
  const logScrollRef = useRef<HTMLDivElement>(null);
  const logStickBottomRef = useRef(true);
  const [globalActionProgress, setGlobalActionProgress] = useState<number | null>(null);
  const [isSystemStatusExpanded, setIsSystemStatusExpanded] = useState(false);

  const fetchServiceStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/services/status');
      const data = await res.json();
      if (data.success) {
        setServiceStatus(data.serviceStatus);
      } else {
        console.error('Failed to fetch service status:', data.message);
      }
    } catch (error) {
      console.error('Error fetching service status:', error);
    }
  }, []);

  const fetchDockerStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/docker/status');
      const data = await res.json();
      setDockerStatus({
        running: data.docker && data.compose,
        updates: data.docker && data.compose ? 'Docker running' : 'Docker not running'
      });
    } catch (error) {
      console.error('Error fetching Docker status:', error);
    }
  }, []);

  // Which services are pinned to a specific version (vs tracking latest), so the
  // card badge can show a lock rather than the "tracks latest" marker.
  const fetchPinnedVersions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/config/current');
      if (!res.ok) return;
      const config = await res.json();
      setPinnedVersions(config.versions ?? {});
    } catch {
      /* leave as-is — badge just falls back to the "latest" marker */
    }
  }, []);

  // Best-effort running version per service, for the muted badge on each card.
  const fetchServiceVersions = useCallback(async (keys: string[]) => {
    const entries = await Promise.all(keys.map(async key => {
      try {
        const res = await apiFetch(`/api/services/${key}/version`);
        const data = await res.json();
        const version = data.success && data.version ? String(data.version) : '';
        return [key, version] as const;
      } catch {
        return [key, ''] as const;
      }
    }));
    const found = entries.filter(([, v]) => v && v !== 'Not installed');
    setServiceVersions(prev => ({ ...prev, ...Object.fromEntries(found) }));
  }, []);

  // Read the cached update status (instant — no image pulls).
  const fetchServiceUpdates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/services/updates');
      const data = await res.json();
      if (data.success) {
        setServiceUpdates(data.updates || {});

        // Auto-refresh the (cheap, cached) check once per session if it has
        // never run or is stale, so update availability surfaces on the cards
        // without the user hunting for a button. Digest checks only, no pulls.
        if (!autoCheckedRef.current) {
          autoCheckedRef.current = true;
          const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
          const last = data.lastChecked ? new Date(data.lastChecked).getTime() : 0;
          if (Date.now() - last > TTL_MS) {
            apiFetch('/api/services/updates/check', { method: 'POST' })
              .then(r => r.json())
              .then(d => { if (d.success) setServiceUpdates(d.updates || {}); })
              .catch(() => { /* silent: availability just won't refresh this time */ });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching update status:', error);
    }
  }, []);

  // Manual per-service re-check from a card's ••• menu — cognitively bound to
  // the service it affects. Feedback is shown inline on the card (spinner, then
  // the update prompt or a brief "up to date"), not via a distant toast; toasts
  // are reserved for failures. Cheap digest check, no image pull.
  // Track "up to date" fade-out timers so they can't fire setState after unmount.
  const updateCheckTimers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  useEffect(() => () => {
    updateCheckTimers.current.forEach(clearTimeout);
  }, []);

  const checkServiceForUpdate = async (serviceKey: string) => {
    const name = serviceConfig.find(s => s.key === serviceKey)?.name || serviceKey;
    setUpdateChecking(prev => ({ ...prev, [serviceKey]: true }));
    try {
      const res = await apiFetch(`/api/services/${serviceKey}/check-updates`);
      const data = await res.json();
      if (data.success) {
        setServiceUpdates(prev => ({ ...prev, [serviceKey]: { hasUpdate: data.hasUpdate } }));
        if (!data.hasUpdate) {
          // Briefly confirm "up to date" on the card, then fade back to normal.
          setRecentlyChecked(prev => ({ ...prev, [serviceKey]: true }));
          const timer = setTimeout(() => setRecentlyChecked(prev => ({ ...prev, [serviceKey]: false })), 4000);
          updateCheckTimers.current.push(timer);
        }
      } else {
        showToast(t('dashboard.toast.checkFailed', { name }), 'error');
      }
    } catch {
      showToast(t('dashboard.toast.checkFailed', { name }), 'error');
    } finally {
      setUpdateChecking(prev => ({ ...prev, [serviceKey]: false }));
    }
  };

  // Refresh the update status for every service at once. Backs the "Check for
  // updates" button in the Services header. Cheap digest checks, no pulls.
  const checkAllUpdates = async () => {
    setCheckingAllUpdates(true);
    try {
      const res = await apiFetch('/api/services/updates/check', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setServiceUpdates(data.updates || {});
        const count = Object.values(data.updates || {}).filter((u) => (u as { hasUpdate: boolean | null })?.hasUpdate).length;
        showToast(count > 0 ? t('dashboard.toast.updatesFound', { count }) : t('dashboard.toast.allUpToDate'), count > 0 ? 'info' : 'success');
      } else {
        showToast(t('dashboard.toast.checkAllFailed'), 'error');
      }
    } catch {
      showToast(t('dashboard.toast.checkAllFailed'), 'error');
    } finally {
      setCheckingAllUpdates(false);
    }
  };

  const fetchServiceAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/services/monitor');
      const data = await res.json();
      if (data.success) {
        setServiceAlerts(data.services);
      }
    } catch (error) {
      console.error('Error fetching service alerts:', error);
    }
  }, []);

  const fetchServiceConfig = useCallback(async () => {
    try {
      const res = await apiFetch('/api/services/config');
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
    await fetchPinnedVersions();
    await fetchServiceVersions(selectedServices);
    const newStatus = await runtimeManager.checkStatus();
    setRuntimeStatus(newStatus);
  }, [fetchServiceConfig, fetchServiceStatus, fetchDockerStatus, fetchPinnedVersions, fetchServiceVersions, selectedServices]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchServiceConfig();
      await fetchServiceStatus();
      await fetchDockerStatus();

      // Get runtime status
      setRuntimeStatus(runtimeManager.getStatus());
      
      setLoading(false);
    };
    loadData();

    // Refresh runtime status and re-poll service/docker status so cards reflect
    // containers that changed state out-of-band (e.g. a crash or a manual stop).
    const runtimeInterval = setInterval(() => {
      setRuntimeStatus(runtimeManager.getStatus());
      fetchServiceStatus();
      fetchDockerStatus();
    }, 30000); // Update every 30 seconds

    return () => {
      clearInterval(runtimeInterval);
    };
  }, [fetchServiceConfig, fetchServiceStatus, fetchDockerStatus]);

  useEffect(() => {
    if (selectedServices.length > 0) {
      fetchServiceUpdates();
      fetchServiceAlerts();
      fetchServiceVersions(selectedServices);
      fetchPinnedVersions();
    }
  }, [selectedServices, fetchServiceUpdates, fetchServiceAlerts, fetchServiceVersions, fetchPinnedVersions]);

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
      const res = await apiFetch(`/api/services/${serviceName}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        showToast(t(`dashboard.toast.actionSuccess_${action}`, { name: serviceName }), 'success');
        await fetchServiceStatus();
        const newStatus = await runtimeManager.checkStatus();
        setRuntimeStatus(newStatus); // Ensure up-to-date status
      } else {
        showActionFailure(serviceName, action, apiMessage(t, data));
      }
    } catch (error) {
      showActionFailure(serviceName, action, String(error));
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Surface a service-action failure as a friendly, actionable dialog instead
  // of a raw error toast that leaves the user stuck.
  const showActionFailure = (serviceName: string, action: 'start' | 'stop' | 'restart', detail?: string) => {
    const name = serviceConfig.find(s => s.key === serviceName)?.name || serviceName;
    setActionError({
      title: t(`dashboard.actionError.title_${action}`, { name }),
      detail,
      serviceKey: serviceName,
      retry: () => handleServiceAction(serviceName, action),
    });
  };

  const handleGlobalAction = (action: 'start-all' | 'stop-all') => {
    const key = action === 'start-all' ? 'startAll' : 'stopAll';
    const verb = action === 'start-all' ? 'start' : 'stop';
    setConfirmationModal({
      message: t(`dashboard.confirm.globalAction_${verb}`),
      onConfirm: async () => {
        setOpenModal(false);
        setActionLoading(prev => ({ ...prev, [key]: true }));
        setGlobalActionProgress(0);
        let completed = 0;
        for (const service of selectedServices) {
          try {
            const res = await apiFetch(`/api/services/${service}/${action === 'start-all' ? 'start' : 'stop'}`, {
              method: 'POST'
            });
            const data = await res.json();
            if (!data.success) {
              showToast(t(`dashboard.toast.globalItemFailed_${verb}`, { service, message: apiMessage(t, data) }), 'error');
            }
          } catch (error) {
            showToast(t(`dashboard.toast.globalItemError_${verb}`, { service, error: String(error) }), 'error');
          }
          completed += 1;
          setGlobalActionProgress(Math.round((completed / selectedServices.length) * 100));
        }
        setActionLoading(prev => ({ ...prev, [key]: false }));
        setGlobalActionProgress(null);
        await fetchServiceStatus();
        const newStatus = await runtimeManager.checkStatus();
        setRuntimeStatus(newStatus); // Ensure up-to-date status
        showToast(t(`dashboard.toast.globalDone_${verb}`), 'success');
      }
    });
    setOpenModal(true);
  };

  const fetchLaunchUrl = async (serviceKey: string): Promise<string | null> => {
    try {
      const res = await apiFetch(`/api/services/${serviceKey}/launch-url`);
      const data = await res.json();
      if (data.success) return data.url;
      showToast(t('dashboard.toast.launchUrlFailed', { service: serviceKey, message: apiMessage(t, data) }), 'error');
      return null;
    } catch (error) {
      showToast(t('dashboard.toast.launchError', { service: serviceKey, error: String(error) }), 'error');
      return null;
    }
  };

  // In the desktop app, open the service in an in-app tab (no browser "Not
  // Secure" chrome). In a plain browser there's no <webview>, so fall back to a
  // new tab.
  const handleLaunchService = async (serviceKey: string, displayName?: string) => {
    const url = await fetchLaunchUrl(serviceKey);
    if (!url) return;
    if (isDesktopApp()) {
      const name = displayName ?? serviceKey.charAt(0).toUpperCase() + serviceKey.slice(1);
      openService({ key: serviceKey, name, url });
      return;
    }
    window.open(url, '_blank');
  };

  const openServiceInBrowser = async (serviceKey: string) => {
    const url = await fetchLaunchUrl(serviceKey);
    if (url) window.open(url, '_blank');
  };

  const fetchLogs = useCallback(async (serviceName: string) => {
    try {
      const res = await apiFetch(`/api/services/${serviceName}/logs`);
      const data = await res.json();
      if (data.success) {
        setServiceLogs(prev => ({ ...prev, [serviceName]: data.logs }));
      }
    } catch {
      // Ignore transient errors while polling; the next tick retries.
    }
  }, []);

  const openLogsDrawer = (serviceName: string) => {
    logStickBottomRef.current = true; // start pinned to the newest lines
    setDrawerService(serviceName);
    setDrawerOpen(true);
  };
  const closeLogsDrawer = () => setDrawerOpen(false);

  // While the log drawer is open, stream the service's logs: fetch immediately,
  // then poll every 2s. Cleared when the drawer closes.
  useEffect(() => {
    if (!drawerOpen || !drawerService) return;
    fetchLogs(drawerService);
    const id = setInterval(() => fetchLogs(drawerService), 2000);
    return () => clearInterval(id);
  }, [drawerOpen, drawerService, fetchLogs]);

  // Auto-scroll to the newest lines on update, unless the user scrolled up.
  useEffect(() => {
    if (logStickBottomRef.current && logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [serviceLogs, drawerService, drawerOpen]);

  const handleLogScroll = () => {
    const el = logScrollRef.current;
    if (el) logStickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };


  const handleUpdateAll = () => {
    const targets = Object.entries(serviceUpdates)
      .filter(([, info]) => info?.hasUpdate === true)
      .map(([key]) => key);
    if (targets.length === 0) return;

    setConfirmationModal({
      message: t('dashboard.confirm.updateAll', { count: targets.length }),
      onConfirm: async () => {
        setOpenModal(false);
        setUpdatingAll(true);
        try {
          const res = await apiFetch('/api/services/updates/apply-all', { method: 'POST' });
          const data = await res.json();
          const updatedCount = data.updated?.length ?? 0;
          if (data.success) {
            showToast(t('dashboard.toast.updatedCount', { count: updatedCount }), 'success');
          } else {
            const failedNames = (data.failed ?? []).map((f: { service: string }) => f.service).join(', ');
            showToast(t('dashboard.toast.updatedWithFailures', { count: updatedCount, names: failedNames || t('dashboard.common.unknown') }), 'error');
          }
          // Re-read the (backend-refreshed) availability + status so prompts clear.
          await fetchServiceUpdates();
          await fetchServiceStatus();
          await fetchServiceVersions(data.updated ?? []);
          setRuntimeStatus(await runtimeManager.checkStatus());
        } catch (error) {
          showToast(t('dashboard.toast.updateAllError', { error: String(error) }), 'error');
        } finally {
          setUpdatingAll(false);
        }
      },
    });
    setOpenModal(true);
  };

  const handleServiceUpdate = (serviceName: string) => {
    setConfirmationModal({
      message: t('dashboard.confirm.updateService', { name: serviceName }),
      onConfirm: async () => {
        setOpenModal(false);
        setUpdateLoading(prev => ({ ...prev, [serviceName]: true }));
        try {
          const res = await apiFetch(`/api/services/${serviceName}/update`, {
            method: 'POST'
          });
          const data = await res.json();
          if (data.success) {
            showToast(t('dashboard.toast.updateSuccess', { name: serviceName }), 'success');
            await fetchServiceStatus();
            const newStatus = await runtimeManager.checkStatus();
            setRuntimeStatus(newStatus); // Ensure up-to-date status
            // Use the status the backend re-checked after pulling, so the
            // prompt reflects reality (and matches the refreshed server cache).
            setServiceUpdates(prev => ({ ...prev, [serviceName]: { hasUpdate: data.hasUpdate ?? false } }));
            await fetchServiceVersions([serviceName]);
          } else {
            showToast(t('dashboard.toast.updateFailed', { name: serviceName, message: apiMessage(t, data) }), 'error');
          }
        } catch (error) {
          showToast(t('dashboard.toast.updateError', { name: serviceName, error: String(error) }), 'error');
        } finally {
          setUpdateLoading(prev => ({ ...prev, [serviceName]: false }));
        }
      }
    });
    setOpenModal(true);
  };

  const pendingUpdateCount = Object.values(serviceUpdates).filter(info => info?.hasUpdate === true).length;

  if (loading) {
    return (
      <div className="px-8 py-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
    <div className="px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Logo className="w-11 h-11 shrink-0 text-gray-400 dark:text-gray-500" />
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">{t('dashboard.heading.title')}</h1>
          </div>
          <p className="text-left text-lg text-gray-600 dark:text-gray-400 mt-2 pl-[3.5rem]">{t('dashboard.heading.subtitle')}</p>
        </div>
        <div className="flex items-center gap-4">
          
          {/* Settings Group */}
          <div className="flex items-center gap-2">
            <DocsButton />
            <Button
              variant="secondary"
              onClick={() => setShowAdvancedSettings(true)}
              tooltip={t('dashboard.settings.tooltip')}
            >
              <HiCog className="inline-block mr-1" /> {t('dashboard.settings.button')}
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
                        ? t('dashboard.globalControls.noServicesToStop')
                        : allStopped
                          ? t('dashboard.globalControls.allStopped')
                          : t('dashboard.globalControls.stopAllTooltip')
                    }
                  >
                    <HiStop className="inline-block mr-1" /> {t('dashboard.globalControls.stopAll')}
                  </Button>
                  <Button 
                    variant="success"
                    onClick={() => handleGlobalAction('start-all')}
                    loading={actionLoading.startAll}
                    disabled={globalActionProgress !== null || selectedServices.length === 0 || allRunning}
                    tooltip={
                      selectedServices.length === 0
                        ? t('dashboard.globalControls.noServicesToStart')
                        : allRunning
                          ? t('dashboard.globalControls.allRunning')
                          : t('dashboard.globalControls.startAllTooltip')
                    }
                  >
                    <HiPlay className="inline-block mr-1" /> {t('dashboard.globalControls.startAll')}
                  </Button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      <SystemChecksBanner />

      <SetupChecklist
        prowlarrNeedsIndexers={prowlarrNeedsIndexers}
        plexNeedsSignIn={plexNeedsSignIn}
        overseerrNeedsSetup={overseerrNeedsSetup}
        onLaunch={handleLaunchService}
      />

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
            <h2 className="text-left text-2xl font-bold text-gray-900 dark:text-white">{t('dashboard.services.heading')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('dashboard.services.configured', { count: selectedServices.length })}
              {pendingUpdateCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-medium">{t('dashboard.services.updatesAvailable', { count: pendingUpdateCount })}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingUpdateCount > 0 && (
              <Button
                variant="secondary"
                onClick={handleUpdateAll}
                loading={updatingAll}
                tooltip={t('dashboard.services.updateAllTooltip', { count: pendingUpdateCount })}
              >
                <HiArrowCircleUp className="inline-block mr-1" /> {updatingAll ? t('dashboard.common.updating') : t('dashboard.services.updateAll', { count: pendingUpdateCount })}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={checkAllUpdates}
              loading={checkingAllUpdates}
              disabled={selectedServices.length === 0}
              tooltip={t('dashboard.services.checkAllTooltip')}
            >
              <HiArrowCircleUp className="inline-block mr-1" /> {checkingAllUpdates ? t('dashboard.common.checking') : t('dashboard.services.checkForUpdates')}
            </Button>
            {serviceConfig.some(s => !selectedServices.includes(s.key)) && (
              <Button variant="primary" onClick={() => setShowAddService(true)} tooltip={t('dashboard.services.addTooltip')}>
                <HiPlus className="inline-block mr-1" /> {t('dashboard.services.addService')}
              </Button>
            )}
          </div>
        </div>
        {selectedServices.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-300 dark:border-gray-600">
            <Card.Body className="text-center py-12">
              <div className="space-y-4">
                <div className="text-6xl text-gray-400">🚀</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboard.empty.title')}</h3>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  {t('dashboard.empty.description')}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setShowAddService(true)}
                  className="mt-4"
                >
                  <HiPlus className="inline-block mr-2" /> {t('dashboard.services.addService')}
                </Button>
              </div>
            </Card.Body>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {selectedServices.map(serviceKey => {
              const service = serviceConfig.find(s => s.key === serviceKey);
              if (!service) return null;

              const status = serviceStatus[serviceKey] || 'Unknown';
              const updateInfo = serviceUpdates[serviceKey];
              const alertInfo = serviceAlerts[serviceKey];
              const isRunning = status === 'Running';
              const needsSetup =
                (serviceKey === 'prowlarr' && prowlarrNeedsIndexers) ||
                (serviceKey === 'plex' && plexNeedsSignIn) ||
                (serviceKey === 'overseerr' && overseerrNeedsSetup);
              const unhealthy = !!alertInfo && !alertInfo.healthy && isRunning;

              // A lifecycle action moved into the overflow menu no longer has a
              // visible button spinner, so surface progress in the status pill.
              const pendingAction = (['start', 'stop', 'restart'] as const).find(
                a => actionLoading[`${serviceKey}:${a}`]
              );
              const pendingLabel = pendingAction ? t(PENDING_STATUS_LABEL_KEY[pendingAction]) : null;

              const statusLabel = serviceStatusLabel({ pendingLabel, needsSetup, unhealthy, isRunning, status }, t);
              const statusDotClass = serviceStatusDotClass({ pending: !!pendingLabel, needsSetup, unhealthy, isRunning });

              return (
                <ServiceCard
                  key={serviceKey}
                  model={{
                    serviceKey,
                    name: service.name,
                    roleKey: serviceRoleKey(serviceKey, service.category),
                    statusLabel,
                    statusDotClass,
                    unhealthy,
                    isRunning,
                    isUpdating: !!updateLoading[serviceKey],
                    isChecking: !!updateChecking[serviceKey],
                    hasUpdate: updateInfo?.hasUpdate,
                    recentlyChecked: !!recentlyChecked[serviceKey],
                    runningVersion: serviceVersions[serviceKey],
                    isPinned: !!pinnedVersions[serviceKey],
                  }}
                  onLaunch={() => handleLaunchService(serviceKey, service.name)}
                  onOpenInBrowser={() => openServiceInBrowser(serviceKey)}
                  onAction={(action) => handleServiceAction(serviceKey, action)}
                  onOpenLogs={() => openLogsDrawer(serviceKey)}
                  onCheckUpdate={() => checkServiceForUpdate(serviceKey)}
                  onConfigure={() => setConfigModal({ service, mode: 'edit' })}
                  onUpdate={() => handleServiceUpdate(serviceKey)}
                />
              );
            })}
          </div>
        )}
      </div>

      <DiagnosticsPanel
        dockerStatus={dockerStatus}
        runtimeStatus={runtimeStatus}
        expanded={isSystemStatusExpanded}
        onToggleExpanded={() => setIsSystemStatusExpanded(!isSystemStatusExpanded)}
      />

      {/* Advanced Settings Drawer */}
      <Drawer
        open={showAdvancedSettings} 
        onClose={async () => {
          setShowAdvancedSettings(false);
          // Refresh dashboard data when drawer is closed
          await refreshDashboard();
        }} 
        position="right"
        className="!w-[900px] max-w-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div className="h-full bg-white dark:bg-gray-800">
          <AdvancedSettings
            onResetComplete={onResetComplete}
            onClose={async () => {
              setShowAdvancedSettings(false);
              // Refresh dashboard data after settings are saved
              await refreshDashboard();
            }}
          />
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

      {actionError && (
        <ActionErrorModal
          show={!!actionError}
          title={actionError.title}
          detail={actionError.detail}
          onClose={() => setActionError(null)}
          onViewLogs={() => { const k = actionError.serviceKey; setActionError(null); openLogsDrawer(k); }}
          onRetry={() => { const r = actionError.retry; setActionError(null); r(); }}
        />
      )}

      {/* Add-service picker → opens the config modal in 'add' mode */}
      {showAddService && (
        <AddServiceModal
          available={serviceConfig.filter(s => !selectedServices.includes(s.key))}
          onClose={() => setShowAddService(false)}
          onPick={(service) => {
            setShowAddService(false);
            setConfigModal({ service: service as ServiceConfig, mode: 'add' });
          }}
        />
      )}

      {/* Per-service configuration / add-service modal */}
      {configModal && (
        <ServiceConfigModal
          service={configModal.service}
          mode={configModal.mode}
          onClose={() => setConfigModal(null)}
          onSaved={refreshDashboard}
          onToast={showToast}
        />
      )}

      {/* Logs Drawer */}
      <LogsDrawer
        open={drawerOpen}
        serviceName={drawerService}
        logs={drawerService ? serviceLogs[drawerService] : undefined}
        scrollRef={logScrollRef}
        onClose={closeLogsDrawer}
        onScroll={handleLogScroll}
      />
    </div>
  );
}

