import { useTranslation } from 'react-i18next';
import { TextInput, Button, Alert } from './index';
import { getDefaultPath } from '../utils/pathDefaults';
import { selectDirectory, isDesktopApp } from '../utils/selectDirectory';

interface PathField {
  label: string;
  required: boolean;
  description: string;
}

interface PathConfigurationProps {
  serviceKey: string;
  serviceName: string;
  pathRequirements: PathField[];
  paths: string[];
  pathErrors?: string[];
  onPathChange: (idx: number, value: string) => void;
  onBrowse?: (idx: number) => void;
  showDefaultButton?: boolean;
  showBrowseButton?: boolean;
  layout?: 'vertical' | 'horizontal';
  className?: string;
}

export default function PathConfiguration({
  serviceKey,
  pathRequirements,
  paths,
  pathErrors = [],
  onPathChange,
  onBrowse,
  showDefaultButton = true,
  showBrowseButton = true,
  layout = 'vertical',
  className = ''
}: PathConfigurationProps) {
  const { t } = useTranslation();
  const handleBrowse = async (idx: number) => {
    if (onBrowse) {
      onBrowse(idx);
      return;
    }
    // Native folder picker via the Electron bridge; returns a real absolute path.
    const dir = await selectDirectory();
    if (dir) onPathChange(idx, dir);
  };

  if (pathRequirements.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
          {t('pathConfig.badge')}
        </span>
        <h4 className="text-sm font-medium text-gray-800 dark:text-white">{t('pathConfig.heading')}</h4>
      </div>
      
      {pathRequirements.map((field, idx) => (
        <div key={idx} className="space-y-2">
          <label 
            htmlFor={`path-${serviceKey}-${idx}`} 
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {t(`services.${serviceKey}.paths.${idx}.label`)} {field.required && <span className="text-red-500">*</span>}
          </label>
          
          <div className={`flex gap-2 ${layout === 'horizontal' ? 'items-center' : 'flex-col sm:flex-row'}`}>
            <TextInput
              id={`path-${serviceKey}-${idx}`}
              type="text"
              value={paths[idx] || ''}
              onChange={e => onPathChange(idx, e.target.value)}
              placeholder={t('pathConfig.placeholder', {
                description: t(`services.${serviceKey}.paths.${idx}.description`),
                default: getDefaultPath(serviceKey, field.label)
              })}
              color={pathErrors[idx] ? 'failure' : 'gray'}
              className="flex-1"
            />
            
            <div className="flex gap-2">
              {showDefaultButton && (
                <Button 
                  onClick={() => onPathChange(idx, getDefaultPath(serviceKey, field.label))}
                  outline
                  size="sm"
                  title={t('pathConfig.useDefaultTitle')}
                >
                  {t('pathConfig.default')}
                </Button>
              )}
              
              {showBrowseButton && (onBrowse || isDesktopApp()) && (
                <Button
                  onClick={() => handleBrowse(idx)}
                  variant="secondary"
                  size="sm"
                  title={t('pathConfig.browseTitle')}
                >
                  {t('pathConfig.browse')}
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400">{t(`services.${serviceKey}.paths.${idx}.description`)}</p>
          
          {pathErrors[idx] && (
            <Alert color="red" className="text-xs">{pathErrors[idx]}</Alert>
          )}
        </div>
      ))}
    </div>
  );
}