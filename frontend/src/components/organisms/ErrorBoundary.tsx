import React from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../atoms/Button';
import Card from '../atoms/Card';

// A render throw in a feature subtree must not take down the whole app shell.
// React only supports error boundaries as class components, so this stays a
// class; the fallback is a function component so it can use i18n and the design
// system.
function ErrorFallback({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
      <Card className="max-w-md w-full">
        <Card.Body>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('errorBoundary.heading')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            {t('errorBoundary.message')}
          </p>
          <Button variant="primary" onClick={onReload}>
            {t('errorBoundary.reload')}
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled render error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
