import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from './requests/client'
import './App.css'
import SetupWizard from './SetupWizard'
import Dashboard from './Dashboard'
import { runtimeManager } from './services/runtimeManager'
import Card from './components/Card'
import Alert from './components/Alert'
import Spinner from './components/Spinner'
import Logo from './components/Logo'
import DocsButton from './components/DocsButton'
import ServiceTabsShell from './components/ServiceTabsShell'
import LanguageSelect from './components/LanguageSelect'
import ErrorBoundary from './components/ErrorBoundary'
import ToastProvider from './contexts/ToastProvider'
import { CustomThemeProvider } from './contexts/ThemeContext'
import { ServiceTabsProvider } from './contexts/ServiceTabsContext'
import { LANGUAGE_CHOSEN_KEY } from './i18n/config'

const getOs = () => {
  const platform = window.navigator.platform.toLowerCase()
  if (platform.includes('mac')) return 'mac'
  if (platform.includes('win')) return 'win'
  if (platform.includes('linux')) return 'linux'
  return 'other'
}

function App() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'checking'|'ok'|'docker-missing'|'compose-missing'>('checking')
  const os = getOs()
  const [setupComplete, setSetupComplete] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [languageChosen, setLanguageChosen] = useState(() => localStorage.getItem(LANGUAGE_CHOSEN_KEY) === 'true');

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await runtimeManager.initialize();

        const [dockerStatus, configStatus] = await Promise.all([
          apiFetch('/api/docker/status').then(res => res.json()),
          apiFetch('/api/config/status').then(res => res.json())
        ]);

        if (!dockerStatus.docker) setStatus('docker-missing')
        else if (!dockerStatus.compose) setStatus('compose-missing')
        else {
          setStatus('ok')
          setSetupComplete(configStatus.setupComplete)
        }
      } catch (error) {
        console.error('App initialization failed:', error);
        setStatus('docker-missing');
      }
    };

    initializeApp();

    const statusInterval = setInterval(() => {
      runtimeManager.getStatus();
    }, 10000);

    return () => {
      clearInterval(statusInterval);
      runtimeManager.shutdown();
    };
  }, [])

  if (!languageChosen) {
    return (
      <CustomThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <LanguageSelect
            onDone={() => {
              localStorage.setItem(LANGUAGE_CHOSEN_KEY, 'true');
              setLanguageChosen(true);
            }}
          />
        </div>
      </CustomThemeProvider>
    );
  }

  return (
    <CustomThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">

      {status === 'checking' && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center gap-3">
              <Logo className="w-11 h-11 text-gray-400 dark:text-gray-500" />
              <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Ensembler</span>
            </div>
            <div className="flex flex-col items-center space-y-3">
              <Spinner size="xl" />
              <p className="text-gray-600 dark:text-gray-400">{t('app.checkingStatus')}</p>
            </div>
          </div>
        </div>
      )}

      {status === 'docker-missing' && (
        <div className="flex items-center justify-center min-h-screen px-4">
          <Card className="max-w-lg w-full">
            <Card.Header>
              <div className="text-center">
                <div className="text-6xl mb-4">🐳</div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{t('app.dockerRequired.title')}</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">{t('app.dockerRequired.subtitle')}</p>
              </div>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <Alert color="info">
                  <div className="space-y-3">
                    <div className="font-semibold">{t('app.dockerRequired.toGetStarted')}</div>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>{t('app.dockerRequired.step1')}</li>
                      <li>{t('app.dockerRequired.step2')}</li>
                      <li>{t('app.dockerRequired.step3')}</li>
                      <li>{t('app.dockerRequired.step4')}</li>
                    </ol>
                  </div>
                </Alert>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 dark:text-white mb-2">{t('app.dockerRequired.downloadHeading')}</div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t(`app.install.${os}.docker`)}</p>
                  <a
                    href="https://www.docker.com/products/docker-desktop/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {t('app.dockerRequired.downloadButton')}
                    <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    {t('app.dockerRequired.otherRuntimes')}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                  >
                    {t('app.dockerRequired.checkAgain')}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('app.dockerRequired.refreshConfirm'))) {
                        window.location.reload();
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                  >
                    {t('app.dockerRequired.refreshPage')}
                  </button>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  {t('app.dockerRequired.havingTrouble')}
                </div>

                <div className="flex justify-center pt-2">
                  <DocsButton label={t('app.dockerRequired.readDocs')} />
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
              <h3 className="text-xl font-medium text-red-600 dark:text-red-500">{t('app.composeMissing.title')}</h3>
            </Card.Header>
            <Card.Body>
              <Alert color="red" className="mb-4">
                <div className="font-medium">{t('app.composeMissing.heading')}</div>
                <div className="mt-2">{t(`app.install.${os}.compose`)}</div>
              </Alert>
            </Card.Body>
          </Card>
        </div>
      )}

      {status === 'ok' && (!setupComplete || showSetupWizard) && (
        <ErrorBoundary>
          <SetupWizard
            onComplete={() => {
              setSetupComplete(true);
              setShowSetupWizard(false);
            }}
            isRerun={showSetupWizard && setupComplete}
          />
        </ErrorBoundary>
      )}

      {status === 'ok' && setupComplete && !showSetupWizard && (
        <ErrorBoundary>
          <ServiceTabsProvider>
            <ServiceTabsShell>
              <Dashboard onResetComplete={() => {
                setSetupComplete(false);
                setShowSetupWizard(false);
              }} />
            </ServiceTabsShell>
          </ServiceTabsProvider>
        </ErrorBoundary>
      )}
        </div>
      </ToastProvider>
    </CustomThemeProvider>
  );
}

export default App
