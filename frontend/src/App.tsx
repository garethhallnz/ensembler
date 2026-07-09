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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <div className="fixed top-4 right-4 z-50">
            <DarkModeToggle />
          </div>
  
      {status === 'checking' && (
        <div className="flex items-center justify-center min-h-screen">
          <Card className="max-w-md w-full p-6">
            <div className="flex flex-col items-center space-y-4">
              <Spinner size="xl" />
              <p className="text-lg text-gray-700 dark:text-gray-300">Checking Docker and Docker Compose status...</p>
            </div>
          </Card>
        </div>
      )}
      
      {status === 'docker-missing' && (
        <div className="flex items-center justify-center min-h-screen px-4">
          <Card className="max-w-lg w-full">
            <Card.Header>
              <div className="text-center">
                <div className="text-6xl mb-4">🐳</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Docker Required</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Dockarr needs Docker to manage your services</p>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <Alert color="info">
                  <div className="space-y-3">
                    <div className="font-semibold">To get started:</div>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Download and install Docker Desktop</li>
                      <li>Launch Docker Desktop and wait for it to start</li>
                      <li>Look for the green "Docker Desktop is running" status</li>
                      <li>Return here and click "Check Again" below</li>
                    </ol>
                  </div>
                </Alert>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 dark:text-white mb-2">Download Docker Desktop:</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{installInstructions[os].docker}</p>
                  <a 
                    href="https://www.docker.com/products/docker-desktop/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Download Docker Desktop
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Check Again
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('This will refresh the page and check Docker status again.')) {
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Having trouble? Make sure Docker Desktop is fully started (not just installed) and try refreshing this page.
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      )}
      
      {status === 'compose-missing' && (
        <div className="flex items-center justify-center min-h-screen">
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
        <Dashboard onResetComplete={() => {
          // Return to the wizard in place after a reset — no window reload.
          setSetupComplete(false);
          setShowSetupWizard(false);
        }} />
      )}
        </div>
      </ToastProvider>
    </CustomThemeProvider>
  );
}

export default App
