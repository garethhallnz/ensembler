import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from './requests/client';
import AdvancedSettings from './AdvancedSettings';
import Card from './components/atoms/Card';
import Button from './components/atoms/Button';
import Progress from './components/atoms/Progress';
import Spinner from './components/atoms/Spinner';
import StepSelection from './components/organisms/StepSelection';
import StepConfiguration from './components/organisms/StepConfiguration';
import StepApply from './components/organisms/StepApply';
import Logo from './components/atoms/Logo';
import DocsButton from './components/molecules/DocsButton';
import { useToast } from './contexts/ToastContext';
import { Drawer } from 'flowbite-react';
import { HiCog } from 'react-icons/hi';
import { getDefaultPath } from './utils/pathDefaults';
import { toggleService } from './utils/serviceSelection';
import { getServiceCatalog, getCurrentConfig } from './requests/services';

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
      const services = await getServiceCatalog();
      setServiceConfig(services);

      // Initialize default ports
      const defaultPorts: { [key: string]: number } = {};
      const defaultSelected: { [key: string]: boolean } = {};
      const defaultPaths: { [service: string]: string[] } = {};

      services.forEach(service => {
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
    } catch (error) {
      console.error('Error loading service configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExistingConfiguration = async () => {
    try {
      const config = await getCurrentConfig();
      setSelected(config.selectedServices);
      setPaths(config.paths);
      setPorts(prev => ({ ...prev, ...config.ports }));
      setTz(config.environment.tz || (() => {
        try {
          return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
          return 'UTC';
        }
      })());
      setPuid(config.environment.puid ?? 1000);
      setPgid(config.environment.pgid ?? 1000);
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
        res = await apiFetch('/api/paths/validate', {
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
      const res = await apiFetch('/api/ports/validate', {
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
      const saveRes = await apiFetch('/api/config/save', {
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
      const composeRes = await apiFetch('/api/config/generate-compose', { method: 'POST' });
      if (!composeRes.ok) throw new Error(t('setup.errors.compose'));
      setPhase('compose', 'done');

      setPhase('start', 'active');
      const startRes = await apiFetch('/api/services/start-all', { method: 'POST' });
      if (!startRes.ok) throw new Error(t('setup.errors.start'));
      setPhase('start', 'done');

      // Wiring failures are warnings, not errors — services still run. The
      // per-service outcomes are shown in the completion panel below.
      setPhase('connect', 'active');
      const body = selected['jellyfin']
        ? { jellyfin: { username: jellyfinUsername, password: jellyfinPassword } }
        : {};
      try {
        const connectRes = await apiFetch('/api/services/setup-connections', {
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
              key={stepName}
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
          <StepSelection
            serviceConfig={serviceConfig}
            selected={selected}
            recommendedOn={getToggleRecommendedState()}
            onToggleRecommended={handleToggleRecommended}
            onServiceChange={handleServiceChange}
          />
        )}
        {step === 1 && (
          <StepConfiguration
            selected={selected}
            serviceConfig={serviceConfig}
            paths={paths}
            pathErrors={pathErrors}
            ports={ports}
            portErrors={portErrors}
            onPathChange={handlePathChange}
            onPortChange={handlePortChange}
            environment={{ tz, puid, pgid }}
            envErrors={envErrors}
            onEnvironmentChange={(field, value) => {
              if (field === 'tz') setTz(value as string);
              else if (field === 'puid') setPuid(value as number);
              else if (field === 'pgid') setPgid(value as number);
            }}
            jellyfinUsername={jellyfinUsername}
            jellyfinPassword={jellyfinPassword}
            onJellyfinUsernameChange={setJellyfinUsername}
            onJellyfinPasswordChange={setJellyfinPassword}
          />
        )}
        {step === 2 && (
          <StepApply
            applyPhases={applyPhases}
            applyError={applyError}
            applyDone={applyDone}
            connectResults={connectResults}
            onComplete={onComplete}
            onBackToConfig={() => setStep(1)}
          />
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