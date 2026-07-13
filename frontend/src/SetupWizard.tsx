import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AdvancedSettings from './AdvancedSettings';
import { Card, Button, Progress, Badge, Spinner, ServiceConfiguration, EnvironmentSettings, TextInput, Logo, DocsButton } from './components';
import { useToast } from './contexts/ToastContext';
import { ToggleSwitch, Drawer } from 'flowbite-react';
import { HiCheckCircle, HiXCircle, HiExclamationCircle, HiCog } from 'react-icons/hi';
import { getDefaultPath } from './utils/pathDefaults';
import { toggleService } from './utils/serviceSelection';
import { apiMessage } from './utils/apiMessage';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

interface ServiceConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultPort: number;
  pathRequirements: { label: string; required: boolean; description: string }[];
  required: boolean;
  recommended?: boolean;
}

interface ServiceConfigResponse {
  success: boolean;
  services: ServiceConfig[];
}

const steps = [
  'setup.steps.selection',
  'setup.steps.configuration',
  'setup.steps.apply',
];

type PhaseStatus = 'pending' | 'active' | 'done' | 'error';
interface ApplyPhase {
  key: string;
  label: string;
  detail?: string;
  status: PhaseStatus;
}
interface ConnectResult { service: string; step: string; success: boolean; message: string; code?: string; params?: Record<string, unknown> }


interface SetupWizardProps {
  onComplete: () => void;
  isRerun?: boolean;
}

export default function SetupWizard({ onComplete, isRerun = false }: SetupWizardProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [showSettings, setShowSettings] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});
  const [paths, setPaths] = useState<{ [service: string]: string[] }>({});
  const [pathErrors, setPathErrors] = useState<{ [service: string]: string[] }>({});
  const [ports, setPorts] = useState<{[key: string]: number}>({});
  const [portErrors, setPortErrors] = useState<{[key: string]: string}>({});
  const [tz, setTz] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC'; // Fallback if timezone detection fails
    }
  });
  const [puid, setPuid] = useState(1000);
  const [pgid, setPgid] = useState(1000);
  // Jellyfin admin account — collected here so Ensembler can complete Jellyfin's
  // first-run setup automatically. Passed transiently to setup and never saved.
  const [jellyfinUsername, setJellyfinUsername] = useState('admin');
  const [jellyfinPassword, setJellyfinPassword] = useState('');
  const [envErrors, setEnvErrors] = useState<{[key: string]: string}>({});
  const [applyPhases, setApplyPhases] = useState<ApplyPhase[]>([]);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyDone, setApplyDone] = useState(false);
  const [connectResults, setConnectResults] = useState<ConnectResult[]>([]);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig[]>([]);
  const [loading, setLoading] = useState(true);

  // Load service configuration on mount
  useEffect(() => {
    loadServiceConfiguration();
  }, []);

  // Load existing configuration if this is a re-run
  useEffect(() => {
    if (isRerun && serviceConfig.length > 0) {
      loadExistingConfiguration();
    }
  }, [isRerun, serviceConfig]);

  const loadServiceConfiguration = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/services/config');
      if (res.ok) {
        const data: ServiceConfigResponse = await res.json();
        if (data.success) {
          setServiceConfig(data.services);

          // Initialize default ports
          const defaultPorts: { [key: string]: number } = {};
          const defaultSelected: { [key: string]: boolean } = {};
          const defaultPaths: { [service: string]: string[] } = {};
          
          data.services.forEach(service => {
            defaultPorts[service.key] = service.defaultPort;
            
            // Auto-select required services and initialize their default paths
            if (service.required) {
              defaultSelected[service.key] = true;
              if (service.pathRequirements && service.pathRequirements.length > 0) {
                defaultPaths[service.key] = service.pathRequirements.map(field => 
                  getDefaultPath(service.key, field.label)
                );
              }
            }
          });
          
          setPorts(defaultPorts);
          setSelected(prev => ({ ...defaultSelected, ...prev }));
          setPaths(prev => ({ ...defaultPaths, ...prev }));
        }
      }
    } catch (error) {
      console.error('Error loading service configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingConfiguration = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/config/current');
      if (res.ok) {
        const config = await res.json();
        setSelected(config.selectedServices || {});
        setPaths(config.paths || {});
        setPorts(prev => ({ ...prev, ...config.ports }));
        setTz(config.environment?.tz || (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            return 'UTC';
          }
        })());
        setPuid(config.environment?.puid || 1000);
        setPgid(config.environment?.pgid || 1000);
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
    }
  };

  const handleServiceChange = (key: string) => {
    const newSelected = toggleService(selected, serviceConfig, key);
    setSelected(newSelected);

    // Initialize default paths for a newly selected service.
    const service = serviceConfig.find(s => s.key === key);
    if (newSelected[key] && service?.pathRequirements && service.pathRequirements.length > 0) {
      setPaths(prev => ({
        ...prev,
        [key]: service.pathRequirements!.map((field, idx) =>
          prev[key]?.[idx] || getDefaultPath(key, field.label)
        )
      }));
    }
  };

  const handleToggleRecommended = () => {
    const recommendedServices = serviceConfig.filter(service => service.recommended || service.required);
    const selectedRecommended = recommendedServices.filter(service => selected[service.key]);
    
    // If all recommended services are selected, deselect all (except required ones)
    // If not all recommended are selected, select all recommended
    const shouldSelectRecommended = selectedRecommended.length < recommendedServices.length;
    
    const newSelected: { [key: string]: boolean } = { ...selected };
    const newPaths: { [service: string]: string[] } = { ...paths };
    
    serviceConfig.forEach(service => {
      if (service.required) {
        // Keep required services always selected
        newSelected[service.key] = true;
      } else if (service.recommended) {
        // Toggle recommended services
        newSelected[service.key] = shouldSelectRecommended;
      }
      // Leave non-recommended services as they are
      
      // Initialize default paths for newly selected services
      if (newSelected[service.key] && service.pathRequirements && service.pathRequirements.length > 0) {
        newPaths[service.key] = service.pathRequirements.map((field, idx) => 
          paths[service.key]?.[idx] || getDefaultPath(service.key, field.label)
        );
      }
    });
    
    setSelected(newSelected);
    setPaths(newPaths);
  };

  const getToggleRecommendedState = () => {
    const recommendedServices = serviceConfig.filter(service => service.recommended && !service.required);
    const selectedRecommendedServices = recommendedServices.filter(service => selected[service.key]);
    
    return selectedRecommendedServices.length === recommendedServices.length;
  };

  const validateServiceSelection = async () => {
    const selectedServices = Object.keys(selected).filter(key => selected[key]);
    
    // Check that at least one service is selected
    if (selectedServices.length === 0) {
      showToast(t('setup.selectAtLeastOneToast'), 'warning');
      return false;
    }
    
    
    // Frontend validation is sufficient - any service is allowed
    return true;
  };

  const validatePaths = async (): Promise<boolean> => {
    const pathToServices: { [path: string]: Array<{ service: string, field: string }> } = {};
    const allValidPaths: string[] = [];

    // First pass: collect all paths and detect conflicts using smart validation
    Object.keys(selected).forEach((svc) => {
        if (!selected[svc]) return;
        const service = serviceConfig.find(s => s.key === svc);
        if (!service) return;
        
        const fields = service.pathRequirements || [];
        fields.forEach((field, idx) => {
            const val = paths[svc]?.[idx] || '';
            if (val.trim()) {
                const normalizedPath = val.trim();
                if (!pathToServices[normalizedPath]) {
                    pathToServices[normalizedPath] = [];
                }
                pathToServices[normalizedPath].push({
                    service: svc,
                    field: field.label.toLowerCase()
                });
                
                if (field.required) {
                    allValidPaths.push(normalizedPath);
                }
            }
        });
    });

    // Check for conflicts using same logic as AdvancedSettings
    const pathConflicts: { [service: string]: string[] } = {};
    let hasConflicts = false;

    Object.keys(selected).forEach((svc) => {
        if (!selected[svc]) return;
        const service = serviceConfig.find(s => s.key === svc);
        if (!service) return;
        
        const fields = service.pathRequirements || [];
        const serviceErrors: string[] = [];
        
        fields.forEach((field, idx) => {
            const val = paths[svc]?.[idx] || '';
            if (val.trim()) {
                const normalizedPath = val.trim();
                const usagesForThisPath = pathToServices[normalizedPath] || [];
                
                if (usagesForThisPath.length > 1) {
                    const currentFieldType = field.label.toLowerCase();
                    
                    const isMediaPath = currentFieldType.includes('movies') || 
                                       currentFieldType.includes('tv') || 
                                       currentFieldType.includes('shows') || 
                                       currentFieldType.includes('music') ||
                                       currentFieldType.includes('books');
                    
                    const isDownloadPath = currentFieldType.includes('download');
                    
                    if (isMediaPath) {
                        const conflictingServices = usagesForThisPath.filter(usage => 
                            usage.service !== svc && 
                            !isSameMediaType(currentFieldType, usage.field)
                        );
                        
                        if (conflictingServices.length > 0) {
                            serviceErrors[idx] = t('setup.errors.pathMediaConflict', { service: conflictingServices[0].service });
                            hasConflicts = true;
                        }
                    } else if (isDownloadPath) {
                        // Download paths can be shared between download clients (torrent category services)
                        const conflictingServices = usagesForThisPath.filter(usage => {
                            const usageService = serviceConfig.find(s => s.key === usage.service);
                            const currentService = serviceConfig.find(s => s.key === svc);
                            return usage.service !== svc && 
                                   (!usageService || !currentService || 
                                    usageService.category !== 'torrent' || currentService.category !== 'torrent' ||
                                    !usage.field.includes('download'));
                        });
                        
                        if (conflictingServices.length > 0) {
                            serviceErrors[idx] = t('setup.errors.pathDownloadConflict', { service: conflictingServices[0].service });
                            hasConflicts = true;
                        }
                    } else {
                        const conflictingServices = usagesForThisPath.filter(usage => usage.service !== svc);
                        if (conflictingServices.length > 0) {
                            serviceErrors[idx] = t('setup.errors.pathUsedBy', { service: conflictingServices[0].service });
                            hasConflicts = true;
                        }
                    }
                }
            }
        });
        
        if (serviceErrors.length > 0) {
            pathConflicts[svc] = serviceErrors;
        }
    });

    if (hasConflicts) {
        setPathErrors(pathConflicts);
        return false;
    }

    // No conflicts and nothing to validate against the backend.
    if (allValidPaths.length === 0) {
        setPathErrors({});
        return true;
    }

    // Validate paths with the backend. A network failure must not throw out of
    // the caller — surface it and treat the paths as not-yet-valid.
    let res: Response;
    try {
        res = await fetch('http://localhost:3001/api/paths/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: allValidPaths }),
        });
    } catch {
        showToast(t('setup.errors.pathValidateUnreachable'), 'error');
        return false;
    }

    if (res.ok) {
        setPathErrors({});
        return true;
    }

    interface PathValidateResult {
        path: string;
        valid: boolean;
        error?: string;
    }
    const data: { success: boolean; results: PathValidateResult[] } = await res.json();
    const errors: { [service: string]: string[] } = {};
    data.results.forEach((result) => {
        if (!result.valid) {
            Object.keys(paths).forEach(svc => {
                const pathIndex = paths[svc].indexOf(result.path);
                if (pathIndex !== -1) {
                    if (!errors[svc]) errors[svc] = [];
                    errors[svc][pathIndex] = result.error || '';
                }
            });
        }
    });
    setPathErrors(errors);
    return false;
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

  const validatePorts = () => {
    const currentPortErrors: {[key: string]: string} = {};
    let valid = true;
    const usedPorts = new Set<number>();

    Object.keys(selected).forEach(svc => {
      if (!selected[svc]) return;
      const service = serviceConfig.find(s => s.key === svc);
      if (!service) return;
      
      const port = ports[svc] || service.defaultPort;
      if (port < 1024 || port > 65535) {
        currentPortErrors[svc] = t('setup.errors.portRange');
        valid = false;
      } else if (usedPorts.has(port)) {
        currentPortErrors[svc] = t('setup.errors.portConflictSelected');
        valid = false;
      } else {
        usedPorts.add(port);
      }
    });
    setPortErrors(currentPortErrors);
    return valid;
  };

  interface PortConflict { service: string; port: number; suggestion: number | null }

  // Ask the backend which of the given host ports are actually in use on this
  // machine (by something outside Ensembler). Cross-platform: the backend probes
  // by connecting to each port. Returns [] if the check itself can't run so it
  // never blocks setup.
  const fetchPortConflicts = async (portsMap: { [key: string]: number }): Promise<PortConflict[]> => {
    try {
      const res = await fetch('http://localhost:3001/api/ports/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports: portsMap }),
      });
      const data = await res.json();
      return data.conflicts || [];
    } catch (err) {
      console.error('Port availability check failed:', err);
      return [];
    }
  };

  const selectedPortMap = () => {
    const map: { [key: string]: number } = {};
    Object.keys(selected).forEach(svc => {
      if (!selected[svc]) return;
      const service = serviceConfig.find(s => s.key === svc);
      if (service) map[svc] = ports[svc] || service.defaultPort;
    });
    return map;
  };

  // Before the user reaches the configuration step, quietly pre-select free
  // ports for any default that's already taken, so the values shown are ready
  // to use rather than corrected after the fact.
  const prefillAvailablePorts = async () => {
    const conflicts = await fetchPortConflicts(selectedPortMap());
    const newPorts: { [key: string]: number } = {};
    const changed: string[] = [];
    conflicts.forEach(({ service, suggestion }) => {
      if (suggestion) {
        newPorts[service] = suggestion;
        const name = serviceConfig.find(s => s.key === service)?.name || service;
        changed.push(`${name}: ${suggestion}`);
      }
    });
    if (Object.keys(newPorts).length > 0) {
      setPorts(prev => ({ ...prev, ...newPorts }));
    }
    if (changed.length > 0) {
      showToast(t('setup.portsPrefilled', { list: changed.join(', ') }), 'info');
    }
  };

  // Safety net at the configuration step for ports the user typed manually.
  // Normally a no-op because prefill already picked free ports. Returns true
  // when every port is free.
  const validateHostPorts = async () => {
    const conflicts = await fetchPortConflicts(selectedPortMap());
    if (conflicts.length === 0) return true;

    const newErrors: { [key: string]: string } = {};
    const newPorts: { [key: string]: number } = {};
    conflicts.forEach(({ service, port, suggestion }) => {
      if (suggestion) {
        newPorts[service] = suggestion;
        newErrors[service] = t('setup.errors.portInUseSwitched', { port, suggestion });
      } else {
        newErrors[service] = t('setup.errors.portInUseNoFree', { port });
      }
    });
    if (Object.keys(newPorts).length > 0) {
      setPorts(prev => ({ ...prev, ...newPorts }));
    }
    setPortErrors(prev => ({ ...prev, ...newErrors }));
    return false;
  };

  const handlePathChange = (svc: string, idx: number, value: string) => {
    const service = serviceConfig.find(s => s.key === svc);
    if (!service) return;
    
    setPaths((prev) => ({
      ...prev,
      [svc]: prev[svc]?.map((v, i) => (i === idx ? value : v)) || service.pathRequirements.map((_, i) => (i === idx ? value : '')),
    }));
  };

  const handlePortChange = (svc: string, value: number) => {
    setPorts((prev) => ({ ...prev, [svc]: value }));
  };

  const validateEnvironment = () => {
    const currentEnvErrors: {[key: string]: string} = {};
    let valid = true;

    if (!tz.trim()) {
      currentEnvErrors.tz = t('setup.errors.tzRequired');
      valid = false;
    }

    if (isNaN(puid) || puid < 0) {
      currentEnvErrors.puid = t('setup.errors.puid');
      valid = false;
    }

    if (isNaN(pgid) || pgid < 0) {
      currentEnvErrors.pgid = t('setup.errors.pgid');
      valid = false;
    }

    if (selected['jellyfin']) {
      if (!jellyfinUsername.trim()) {
        currentEnvErrors.jellyfinUsername = t('setup.errors.jellyfinUsername');
        valid = false;
      }
      if (jellyfinPassword.length < 4) {
        currentEnvErrors.jellyfinPassword = t('setup.errors.jellyfinPassword');
        valid = false;
      }
    }

    setEnvErrors(currentEnvErrors);
    return valid;
  };

  // Advance from Service Selection to Configuration, pre-selecting free ports
  // so the configuration step shows ready-to-use values.
  const handleNext = async () => {
    if (!(await validateServiceSelection())) return;
    await prefillAvailablePorts();
    setStep(1);
  };

  // Validate the configuration step, then move to the Apply step and run it.
  const handleApply = async () => {
    if (!(await validatePaths())) return;
    if (!validatePorts()) return;
    if (!validateEnvironment()) return;
    if (!(await validateHostPorts())) return;
    setStep(2);
    runApply();
  };

  // Drive the apply as visible, checked-off phases rather than a single spinner.
  const runApply = async () => {
    const phases: ApplyPhase[] = [
      { key: 'save', label: t('setup.apply.phaseSave'), status: 'pending' },
      { key: 'compose', label: t('setup.apply.phaseCompose'), status: 'pending' },
      {
        key: 'start',
        label: t('setup.apply.phaseStart'),
        detail: t('setup.apply.phaseStartDetail'),
        status: 'pending'
      },
      {
        key: 'connect',
        label: t('setup.apply.phaseConnect'),
        detail: t('setup.apply.phaseConnectDetail'),
        status: 'pending'
      }
    ];
    setApplyPhases(phases);
    setApplyError(null);
    setApplyDone(false);
    setConnectResults([]);

    const setPhase = (key: string, status: PhaseStatus) =>
      setApplyPhases(prev => prev.map(p => (p.key === key ? { ...p, status } : p)));

    try {
      setPhase('save', 'active');
      const saveRes = await fetch('http://localhost:3001/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedServices: selected,
          paths,
          ports,
          environment: { tz, puid, pgid }
        })
      });
      if (!saveRes.ok) throw new Error(t('setup.errors.save'));
      setPhase('save', 'done');

      setPhase('compose', 'active');
      const composeRes = await fetch('http://localhost:3001/api/config/generate-compose', { method: 'POST' });
      if (!composeRes.ok) throw new Error(t('setup.errors.compose'));
      setPhase('compose', 'done');

      setPhase('start', 'active');
      const startRes = await fetch('http://localhost:3001/api/services/start-all', { method: 'POST' });
      if (!startRes.ok) throw new Error(t('setup.errors.start'));
      setPhase('start', 'done');

      // Wiring failures are warnings, not errors — services still run. The
      // per-service outcomes are shown in the completion panel below.
      setPhase('connect', 'active');
      const body = selected['jellyfin']
        ? { jellyfin: { username: jellyfinUsername, password: jellyfinPassword } }
        : {};
      try {
        const connectRes = await fetch('http://localhost:3001/api/services/setup-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const connectData = await connectRes.json();
        setConnectResults(connectData.results || []);
      } catch (connectError) {
        console.error('Service connection setup failed:', connectError);
      }
      setPhase('connect', 'done');
      setApplyDone(true);
    } catch (error) {
      console.error('Error in setup process:', error);
      setApplyPhases(prev => prev.map(p => (p.status === 'active' ? { ...p, status: 'error' } : p)));
      setApplyError(error instanceof Error ? error.message : t('setup.errors.generic'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full p-6">
          <div className="flex flex-col items-center space-y-4">
            <Spinner size="xl" />
            <p className="text-lg text-gray-700 dark:text-gray-300">{t('setup.loading')}</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Logo className="w-10 h-10 shrink-0 text-gray-400 dark:text-gray-500" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('setup.title', { defaultValue: 'Setup' })}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setShowSettings(true)} tooltip={t('dashboard.settings.button', { defaultValue: 'Settings' })}>
            <HiCog className="inline-block mr-1" /> {t('dashboard.settings.button', { defaultValue: 'Settings' })}
          </Button>
          <DocsButton />
        </div>
      </div>
      
      <div className="mb-8">
        <Progress
          progress={((step + 1) / steps.length) * 100}
          size="lg"
          color="blue"
          
        />
        
        <div className="flex justify-between mt-2">
          {steps.map((stepName, idx) => (
            <div 
              key={idx} 
              className={`text-sm ${step === 2 ? '' : 'cursor-pointer'} ${idx === step ? 'font-bold text-blue-600' : idx < step ? 'text-green-600' : 'text-gray-500'}`}
              onClick={() => idx < step && step !== 2 && setStep(idx)}
            >
              {t(stepName)}
            </div>
          ))}
        </div>
      </div>
      <div className="min-h-[500px] mb-6">
        {step === 0 && (
           <div className="space-y-6">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('setup.step0.heading')}</h2>
             <p className="text-gray-600 dark:text-gray-300">{t('setup.step0.subtitle')}</p>
             
             {/* Toggle Recommended Option */}
             <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
               <div className="flex items-center justify-between">
                 <div className="flex-1">
                   <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('setup.step0.quickActions')}</h3>
                   <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                     {getToggleRecommendedState() ? t('setup.step0.recommendedOn') : t('setup.step0.recommendedOff')}
                   </p>
                 </div>
                 <div className="flex items-center">
                   <ToggleSwitch
                     id="toggle-recommended-services"
                     checked={getToggleRecommendedState()}
                     onChange={handleToggleRecommended}
                     label={t('setup.step0.toggleRecommended')}
                   />
                 </div>
               </div>
             </div>
             


             {/* Services grouped by category */}
             <div className="space-y-6">
               {['media', 'management', 'torrent', 'indexer', 'request'].map(category => {
                 const categoryServices = serviceConfig.filter(service => service.category === category);
                 if (categoryServices.length === 0) return null;

                 const getCategoryTitle = (cat: string) =>
                   t(`setup.categories.${cat}.title`, { defaultValue: cat });

                 const getCategoryDescription = (cat: string) =>
                   t(`setup.categories.${cat}.description`, { defaultValue: '' });

                 return (
                   <div key={category} className="space-y-3">
                     <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                       <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                         {getCategoryTitle(category)}
                       </h3>
                       <p className="text-sm text-gray-600 dark:text-gray-400">
                         {getCategoryDescription(category)}
                       </p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                       {categoryServices.map((service) => (
                         <Card key={service.key} className="overflow-hidden">
                           <Card.Body>
                             <div className="flex items-start justify-between">
                               <div className="flex-1 pr-4">
                                 <label htmlFor={`service-${service.key}`} className="block text-lg font-medium text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
                                   <span>{service.name}</span>
                                   {service.required && <Badge color="blue">{t('setup.step0.required')}</Badge>}
                                   {service.recommended && !service.required && (
                                     <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-200">
                                       <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                         <path fillRule="evenodd" d="M10 15.585l-6.327 3.327 1.209-7.046L0 6.944l7.073-1.027L10 0l2.927 5.917L20 6.944l-4.882 4.922 1.209 7.046L10 15.585z" clipRule="evenodd"/>
                                       </svg>
                                       {t('setup.step0.recommended')}
                                     </span>
                                   )}
                                 </label>
                                 <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t(`services.${service.key}.description`, { defaultValue: service.description })}</p>
                               </div>
                               <div className="flex items-center mt-1">
                                 <ToggleSwitch
                                   id={`service-${service.key}`}
                                   checked={!!selected[service.key]}
                                   onChange={() => handleServiceChange(service.key)}
                                   disabled={service.required}
                                 />
                               </div>
                             </div>
                           </Card.Body>
                         </Card>
                       ))}
                     </div>
                   </div>
                 );
               })}
             </div>
             {!Object.values(selected).some(Boolean) && (
               <div className="text-sm text-amber-600 dark:text-amber-400">
                 {t('setup.selectAtLeastOne')}
               </div>
             )}
           </div>
        )}
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('setup.step1.heading')}</h2>
              <p className="text-gray-600 dark:text-gray-300">{t('setup.step1.subtitle')}</p>
            </div>
            <div className="space-y-6">
              {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
                const service = serviceConfig.find(s => s.key === svc);
                if (!service) return null;
                
                return (
                  <ServiceConfiguration
                    key={svc}
                    service={service}
                    paths={paths[svc] || []}
                    pathErrors={pathErrors[svc] || []}
                    port={ports[svc] || service.defaultPort}
                    portError={portErrors[svc]}
                    onPathChange={(idx, value) => handlePathChange(svc, idx, value)}
                    onPortChange={(port) => handlePortChange(svc, port)}
                    layout="card"
                  />
                );
              })}
            </div>
            
            {/* Environment Variables Section */}
            <Card>
              <Card.Header>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('setup.step1.environmentSettings')}</h3>
                </div>
              </Card.Header>
              <Card.Body>
                <EnvironmentSettings
                  environment={{ tz, puid, pgid }}
                  errors={envErrors}
                  onEnvironmentChange={(field, value) => {
                    if (field === 'tz') setTz(value as string);
                    else if (field === 'puid') setPuid(value as number);
                    else if (field === 'pgid') setPgid(value as number);
                  }}
                  layout="grid"
                />
              </Card.Body>
            </Card>

            {selected['jellyfin'] && (
              <Card>
                <Card.Header>
                  <div className="flex items-center gap-2">
                    <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded text-sm font-medium">Jellyfin</span>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white">{t('setup.step1.jellyfinAccount')}</h3>
                  </div>
                </Card.Header>
                <Card.Body>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 text-left">
                    {t('setup.step1.jellyfinIntro')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">{t('setup.step1.adminUsername')}</label>
                      <TextInput
                        value={jellyfinUsername}
                        onChange={e => setJellyfinUsername(e.target.value)}
                        color={envErrors.jellyfinUsername ? 'failure' : 'gray'}
                      />
                      {envErrors.jellyfinUsername && <p className="text-sm text-red-500 mt-1 text-left">{envErrors.jellyfinUsername}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 text-left">{t('setup.step1.adminPassword')}</label>
                      <TextInput
                        type="password"
                        value={jellyfinPassword}
                        onChange={e => setJellyfinPassword(e.target.value)}
                        color={envErrors.jellyfinPassword ? 'failure' : 'gray'}
                      />
                      {envErrors.jellyfinPassword && <p className="text-sm text-red-500 mt-1 text-left">{envErrors.jellyfinPassword}</p>}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Compact review folded into configuration, so applying is one
                click from here rather than a separate review step. */}
            <Card>
              <Card.Body>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-left">{t('setup.step1.readyToSetUp')}</h3>
                <div className="space-y-1.5">
                  {Object.keys(selected).filter(key => selected[key]).map((key) => {
                    const service = serviceConfig.find(s => s.key === key);
                    const primaryPath = (paths[key] || []).find(Boolean);
                    return (
                      <div key={key} className="flex items-center gap-2 text-sm text-left">
                        <span className="font-medium text-gray-900 dark:text-white min-w-[120px]">{service?.name || key}</span>
                        <Badge color="blue">{t('setup.step1.port', { port: ports[key] || service?.defaultPort })}</Badge>
                        {primaryPath && <span className="text-gray-500 dark:text-gray-400 font-mono truncate">{primaryPath}</span>}
                      </div>
                    );
                  })}
                </div>
              </Card.Body>
            </Card>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-left">
                {applyDone ? t('setup.apply.titleDone') : applyError ? t('setup.apply.titleError') : t('setup.apply.titleRunning')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-left">
                {applyDone
                  ? t('setup.apply.subtitleDone')
                  : applyError
                    ? t('setup.apply.subtitleError')
                    : t('setup.apply.subtitleRunning')}
              </p>
            </div>

            <Card>
              <Card.Body>
                <div className="space-y-4">
                  {applyPhases.map((phase) => (
                    <div key={phase.key} className="flex items-start gap-3 text-left">
                      <div className="mt-0.5 shrink-0">
                        {phase.status === 'done' && <HiCheckCircle className="w-6 h-6 text-green-500" />}
                        {phase.status === 'error' && <HiXCircle className="w-6 h-6 text-red-500" />}
                        {phase.status === 'active' && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400 animate-spin" />
                        )}
                        {phase.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                      </div>
                      <div className="flex-1">
                        <div className={`font-medium ${
                          phase.status === 'pending' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                        }`}>
                          {phase.label}
                        </div>
                        {phase.status === 'active' && phase.detail && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{phase.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>

            {applyError && (
              <Card>
                <Card.Body>
                  <div className="flex items-start gap-3 text-left">
                    <HiExclamationCircle className="w-6 h-6 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-900 dark:text-white font-medium">{applyError}</p>
                      <Button color="gray" outline className="mt-3" onClick={() => setStep(1)}>
                        {t('setup.apply.backToConfig')}
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            )}

            {applyDone && (
              <Card>
                <Card.Body>
                  {connectResults.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      {connectResults.map((r, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-left">
                          {r.success
                            ? <HiCheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            : <HiExclamationCircle className="w-4 h-4 text-yellow-500 shrink-0" />}
                          <span className="text-gray-700 dark:text-gray-300">{apiMessage(t, r)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button color="green" onClick={onComplete}>
                    {t('setup.apply.goToDashboard')}
                  </Button>
                </Card.Body>
              </Card>
            )}
          </div>
        )}
      </div>
      {/* The Apply step (2) drives its own actions; no wizard nav there. */}
      {step < 2 && (
        <div className="flex justify-between mt-6">
          <div>
            {step > 0 && (
              <Button color="gray" outline onClick={() => setStep(s => Math.max(0, s - 1))}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                {t('setup.nav.previous')}
              </Button>
            )}
          </div>
          <div>
            {step === 0 ? (
              <Button color="blue" onClick={handleNext} disabled={!Object.values(selected).some(Boolean)}>
                {t('setup.nav.next')}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            ) : (
              <Button variant="primary" onClick={handleApply}>
                {t('setup.nav.apply')}
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Appearance-only settings (theme + language) reachable during setup. */}
      <Drawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        position="right"
        className="!w-[900px] max-w-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700"
      >
        <div className="h-full bg-white dark:bg-gray-800">
          <AdvancedSettings appearanceOnly onClose={() => setShowSettings(false)} />
        </div>
      </Drawer>
    </div>
  );
}