import { useTranslation } from 'react-i18next';

import TextInput from '../atoms/TextInput';
import Alert from '../atoms/Alert';

interface EnvironmentConfig {
  tz: string;
  puid: number;
  pgid: number;
}

interface EnvironmentSettingsProps {
  environment: EnvironmentConfig;
  errors?: { [key: string]: string };
  onEnvironmentChange: (field: keyof EnvironmentConfig, value: string | number) => void;
  layout?: 'grid' | 'vertical';
  className?: string;
}

const timezoneOptions = [
  { value: '', label: 'Select timezone...' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'America/Vancouver', label: 'America/Vancouver' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Rome', label: 'Europe/Rome (CET/CEST)' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
  { value: 'Europe/Stockholm', label: 'Europe/Stockholm (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong (HKT)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST/AEDT)' },
  { value: 'Australia/Perth', label: 'Australia/Perth (AWST)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
];

export default function EnvironmentSettings({
  environment,
  errors = {},
  onEnvironmentChange,
  layout = 'grid',
  className = ''
}: EnvironmentSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className={`space-y-6 ${className}`}>
      
      <div className={layout === 'grid' ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {/* Timezone */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('environment.timezone.label')} <span className="text-red-500">*</span>
          </label>
          <select
            value={environment.tz}
            onChange={(e) => onEnvironmentChange('tz', e.target.value)}
            className={`block w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              errors.tz 
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
            } text-gray-900 dark:text-white`}
          >
            {timezoneOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.value === '' ? t('environment.timezone.placeholder') : option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('environment.timezone.help')}
          </p>
          {errors.tz && (
            <Alert color="red" className="text-xs">{errors.tz}</Alert>
          )}
        </div>

        {/* PUID */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('environment.puid.label')} <span className="text-red-500">*</span>
          </label>
          <TextInput
            type="number"
            value={String(environment.puid)}
            onChange={(e) => onEnvironmentChange('puid', parseInt(e.target.value) || 0)}
            color={errors.puid ? 'failure' : 'gray'}
            min="0"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('environment.puid.help')}
          </p>
          {errors.puid && (
            <Alert color="red" className="text-xs">{errors.puid}</Alert>
          )}
        </div>

        {/* PGID */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('environment.pgid.label')} <span className="text-red-500">*</span>
          </label>
          <TextInput
            type="number"
            value={String(environment.pgid)}
            onChange={(e) => onEnvironmentChange('pgid', parseInt(e.target.value) || 0)}
            color={errors.pgid ? 'failure' : 'gray'}
            min="0"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('environment.pgid.help')}
          </p>
          {errors.pgid && (
            <Alert color="red" className="text-xs">{errors.pgid}</Alert>
          )}
        </div>
      </div>
    </div>
  );
}