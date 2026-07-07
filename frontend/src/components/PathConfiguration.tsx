import { TextInput, Button, Alert } from './index';
import { getDefaultPath } from '../utils/pathDefaults';

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

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
  const handleBrowse = async (idx: number) => {
    if (onBrowse) {
      onBrowse(idx);
    } else if ('showDirectoryPicker' in window && window.showDirectoryPicker) {
      try {
        const handle = await window.showDirectoryPicker();
        const path = await handle.resolve(handle);
        if (path) {
          onPathChange(idx, path.join('/'));
        }
      } catch (err) {
        console.error('Directory picker error:', err);
      }
    }
  };

  if (pathRequirements.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
          Paths
        </span>
        <h4 className="text-sm font-medium text-gray-800 dark:text-white">File Paths</h4>
      </div>
      
      {pathRequirements.map((field, idx) => (
        <div key={idx} className="space-y-2">
          <label 
            htmlFor={`path-${serviceKey}-${idx}`} 
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          >
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          
          <div className={`flex gap-2 ${layout === 'horizontal' ? 'items-center' : 'flex-col sm:flex-row'}`}>
            <TextInput
              id={`path-${serviceKey}-${idx}`}
              type="text"
              value={paths[idx] || ''}
              onChange={e => onPathChange(idx, e.target.value)}
              placeholder={`${field.description} (default: ${getDefaultPath(serviceKey, field.label)})`}
              color={pathErrors[idx] ? 'failure' : 'gray'}
              className="flex-1"
            />
            
            <div className="flex gap-2">
              {showDefaultButton && (
                <Button 
                  onClick={() => onPathChange(idx, getDefaultPath(serviceKey, field.label))}
                  outline
                  size="sm"
                  title="Use default path"
                >
                  Default
                </Button>
              )}
              
              {showBrowseButton && (
                <Button 
                  onClick={() => handleBrowse(idx)} 
                  variant="secondary"
                  size="sm"
                  title="Browse for directory"
                >
                  Browse
                </Button>
              )}
            </div>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
          
          {pathErrors[idx] && (
            <Alert color="red" className="text-xs">{pathErrors[idx]}</Alert>
          )}
        </div>
      ))}
    </div>
  );
}