import { useEffect, useState } from 'react'
import './App.css'
import SetupWizard from './SetupWizard'
import Dashboard from './Dashboard'
import { runtimeManager } from './services/runtimeManager'
import { Card, Alert, Spinner } from './components'
import ToastProvider from './contexts/ToastProvider'
import { CustomThemeProvider } from './contexts/ThemeContext'
import DarkModeToggle from './components/DarkModeToggle'

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
  // const composeVersion = useState<string>('') - removed unused state
  const os = getOs()
  const [setupComplete, setSetupComplete] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize runtime manager
        await runtimeManager.initialize();
        
        
        // Check Docker and configuration status
        const [dockerStatus, configStatus] = await Promise.all([
          fetch('http://localhost:3001/api/docker/status').then(res => res.json()),
          fetch('http://localhost:3001/api/config/status').then(res => res.json())
        ]);
        
        if (!dockerStatus.docker) setStatus('docker-missing')
        else if (!dockerStatus.compose) setStatus('compose-missing')
        else {
          setStatus('ok')
          // Removed setComposeVersion call for unused state
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
      // Removed updating unused runtimeStatus state
      runtimeManager.getStatus();
    }, 10000); // Update every 10 seconds

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      runtimeManager.shutdown();
    };
  }, [])

  return (
    <CustomThemeProvider>
      <ToastProvider>
        <div className="fixed top-4 right-4 z-50">
          <DarkModeToggle />
        </div>
  
      {status === 'checking' && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <Card className="max-w-md w-full p-6">
            <div className="flex flex-col items-center space-y-4">
              <Spinner size="xl" />
              <p className="text-lg text-gray-700 dark:text-gray-300">Checking Docker and Docker Compose status...</p>
            </div>
          </Card>
        </div>
      )}
      
      {status === 'docker-missing' && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <Card className="max-w-md w-full">
            <Card.Header>
              <h3 className="text-xl font-medium text-red-600 dark:text-red-500">Docker Not Running</h3>
            </Card.Header>
            <Card.Body>
              <Alert color="red" className="mb-4">
                <div className="font-medium">Docker is not running</div>
                <div className="mt-2">{installInstructions[os].docker}</div>
              </Alert>
            </Card.Body>
          </Card>
        </div>
      )}
      
      {status === 'compose-missing' && (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
          <Card className="max-w-md w-full">
            <Card.Header>
              <h3 className="text-xl font-medium text-red-600 dark:text-red-500">Docker Compose Not Available</h3>
            </Card.Header>
            <Card.Body>
              <Alert color="red" className="mb-4">
                <div className="font-medium">Docker Compose is not available</div>
                <div className="mt-2">{installInstructions[os].compose}</div>
              </Alert>
            </Card.Body>
          </Card>
        </div>
      )}

      {status === 'ok' && (!setupComplete || showSetupWizard) && (
        <SetupWizard
          onComplete={() => {
            setSetupComplete(true);
            setShowSetupWizard(false);
          }}
          isRerun={showSetupWizard && setupComplete}
        />
      )}

      {status === 'ok' && setupComplete && !showSetupWizard && (
        <Dashboard onEditSetup={() => setShowSetupWizard(true)} />
      )}
      </ToastProvider>
    </CustomThemeProvider>
  );
}

export default App
