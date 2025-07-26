interface ConfirmationModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  destructive?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmationModal({ 
  show, 
  onClose, 
  onConfirm, 
  message, 
  destructive = false,
  confirmText = "Yes, I'm sure",
  cancelText = "No, cancel"
}: ConfirmationModalProps) {
  if (!show) {
    return null;
  }

  const isDestructive = destructive || message.includes('DESTRUCTIVE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-auto border border-gray-200 dark:border-gray-700">
        <div className="text-center">
          {isDestructive && (
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
              <span className="text-red-600 dark:text-red-400 text-2xl">⚠️</span>
            </div>
          )}
          <h3 className={`mb-5 text-lg font-medium ${
            isDestructive 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-700 dark:text-gray-300'
          }`}>
            {isDestructive ? 'Destructive Action' : 'Confirm Action'}
          </h3>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onConfirm}
              className={`px-6 py-2 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {confirmText}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}