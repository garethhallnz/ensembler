import { useEffect, useState } from 'react'
import './App.css'
import SetupWizard from './SetupWizard'
import Dashboard from './Dashboard'
import { runtimeManager, type RuntimeStatus } from './services/runtimeManager'

const getOs = () => {
  const platform = window.navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'win'
  if (platform.includes('linux')) return 'linux'
  return 'other'
}

const installInstructions = {
  mac: {
    docker: 'Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it from Applications.',
    compose: 'Docker Compose is included with Docker Desktop on macOS.'
  },
  win: {
    docker: 'Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and launch it from the Start menu.',
    compose: 'Docker Compose is included with Docker Desktop on Windows.'
  },
  linux: {
    docker: 'Install Docker Engine: https://docs.docker.com/engine/install/ and start the service (e.g., sudo systemctl start docker).',
    compose: 'Install Docker Compose: https://docs.docker.com/compose/install/'
  },
  other: {
    docker: 'Unsupported OS. Please refer to https://docs.docker.com/get-docker/',
    compose: 'Unsupported OS. Please refer to https://docs.docker.com/compose/install/'
  }
}

function App() {
  const [status, setStatus] = useState<'checking'|'ok'|'docker-missing'|'compose-missing'>('checking')
  const [composeVersion, setComposeVersion] = useState<string>('')
  const os = getOs()
  const [setupComplete, setSetupComplete] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize runtime manager
        await runtimeManager.initialize();
        setRuntimeStatus(runtimeManager.getStatus());
        
        // Check Docker and configuration status
        const [dockerStatus, configStatus] = await Promise.all([
          fetch('http://localhost:3001/api/docker/status').then(res => res.json()),
          fetch('http://localhost:3001/api/config/status').then(res => res.json())
        ]);
        
        if (!dockerStatus.docker) setStatus('docker-missing')
        else if (!dockerStatus.compose) setStatus('compose-missing')
        else {
          setStatus('ok')
          setComposeVersion(dockerStatus.composeVersion || '')
          setSetupComplete(configStatus.setupComplete)
        }
      } catch (error) {
        console.error('App initialization failed:', error);
        setStatus('docker-missing');
      }
    };

    initializeApp();

    // Setup runtime status monitoring
    const statusInterval = setInterval(() => {
      const currentStatus = runtimeManager.getStatus();
      setRuntimeStatus(currentStatus);
    }, 10000); // Update every 10 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      runtimeManager.shutdown();
    };
  }, [])

  if (status === 'checking') return <div>Checking Docker and Docker Compose status...</div>
  if (status === 'docker-missing') return <div>Docker is not running. {installInstructions[os].docker}</div>
  if (status === 'compose-missing') return <div>Docker Compose is not available. {installInstructions[os].compose}</div>

  if (status === 'ok' && (!setupComplete || showSetupWizard)) {
    return (
      <SetupWizard 
        onComplete={() => {
          setSetupComplete(true);
          setShowSetupWizard(false);
        }}
        isRerun={showSetupWizard && setupComplete}
      />
    );
  }

  return <Dashboard onEditSetup={() => setShowSetupWizard(true)} />;
}

export default App
