import { useId } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
  // Accessible name for the switch when no visible `label` is rendered.
  'aria-label'?: string;
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  label,
  className = '',
  'aria-label': ariaLabel,
}: ToggleProps) {
  const labelId = useId();
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-11 h-6', 
    lg: 'w-14 h-7'
  };

  const thumbSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const thumbTranslateClasses = {
    sm: checked ? 'translate-x-4' : 'translate-x-0',
    md: checked ? 'translate-x-5' : 'translate-x-0', 
    lg: checked ? 'translate-x-7' : 'translate-x-0'
  };

  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {label && (
        <span id={labelId} className="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ? undefined : ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        onClick={handleClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${checked 
            ? 'bg-blue-600 hover:bg-blue-700' 
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
          }
        `}
      >
        <span
          className={`
            ${thumbSizeClasses[size]}
            ${thumbTranslateClasses[size]}
            inline-block rounded-full bg-white dark:bg-gray-100
            shadow-lg transform transition-transform duration-200 ease-in-out
          `}
        />
      </button>
    </div>
  );
}