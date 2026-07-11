import { HiExclamationCircle } from 'react-icons/hi';
import Button from './Button';

interface ActionErrorModalProps {
  show: boolean;
  title: string;
  detail?: string;
  onClose: () => void;
  onViewLogs?: () => void;
  onRetry?: () => void;
}

// Friendly failure dialog: a plain-language headline with clear next steps
// (view the logs, or try again) instead of a raw error toast that dead-ends.
export default function ActionErrorModal({
  show,
  title,
  detail,
  onClose,
  onViewLogs,
  onRetry,
}: ActionErrorModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full border border-gray-200 dark:border-gray-700">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <HiExclamationCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-center text-gray-900 dark:text-white mb-2">{title}</h3>
        <p className="text-sm text-center text-gray-600 dark:text-gray-400 mb-4">
          Something went wrong. Check the logs for details, or try again.
        </p>
        {detail && (
          <pre className="text-xs bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 rounded p-3 mb-4 max-h-28 overflow-auto whitespace-pre-wrap break-words">
            {detail}
          </pre>
        )}
        <div className="flex justify-center gap-2">
          <Button variant="secondary" onClick={onClose}>Dismiss</Button>
          {onViewLogs && <Button variant="secondary" onClick={onViewLogs}>View logs</Button>}
          {onRetry && <Button variant="primary" onClick={onRetry}>Retry</Button>}
        </div>
      </div>
    </div>
  );
}
