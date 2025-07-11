import React from 'react';
import { Toast as FlowbiteToast } from 'flowbite-react';

interface ToastProps {
  children: React.ReactNode;
  className?: string;
}

export default function Toast({
  children,
  className = '',
}: ToastProps) {
  return (
    <FlowbiteToast
      className={className}
    >
      {children}
    </FlowbiteToast>
  );
}

interface ToastToggleProps {
  onDismiss?: () => void;
  className?: string;
}

Toast.Toggle = function ToastToggle({ onDismiss, className = '' }: ToastToggleProps) {
  return (
    <button
      type="button"
      className={`-mx-1.5 -my-1.5 ml-auto inline-flex h-8 w-8 rounded-lg p-1.5 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-gray-300 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-white ${className}`}
      onClick={onDismiss}
    >
      <span className="sr-only">Close</span>
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
    </button>
  );
};