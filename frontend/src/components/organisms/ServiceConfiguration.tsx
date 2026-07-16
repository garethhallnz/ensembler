import { useTranslation } from 'react-i18next';
import TextInput from '../atoms/TextInput';
import Alert from '../atoms/Alert';
import Card from '../atoms/Card';
import PathConfiguration from '../molecules/PathConfiguration';

interface ServiceConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultPort: number;
  pathRequirements: { label: string; required: boolean; description: string }[];
  required: boolean;
}

// The port column is identical whether or not the service needs paths, so both
// branches render it from here rather than duplicating the markup.
function PortConfigurationColumn({ service, port, portError, onPortChange }: {
  service: ServiceConfig;
  port: number;
  portError?: string;
  onPortChange: (port: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-medium">
          {t('serviceConfiguration.portBadge')}
        </span>
        <h4 className="text-sm font-medium text-gray-800 dark:text-white">{t('serviceConfiguration.portConfiguration')}</h4>
      </div>
      <div className="space-y-2">
        <label htmlFor={`port-${service.key}`} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('serviceConfiguration.servicePort', { name: service.name })}
        </label>
        <TextInput
          id={`port-${service.key}`}
          type="number"
          value={String(port)}
          onChange={(e) => onPortChange(parseInt(e.target.value))}
          color={portError ? 'failure' : 'gray'}
          className="w-32"
          min="1024"
          max="65535"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('serviceConfiguration.portDefault', { port: service.defaultPort })}
        </p>
        {portError && (
          <Alert color="red" className="text-xs">{portError}</Alert>
        )}
      </div>
    </div>
  );
}

interface ServiceConfigurationProps {
  service: ServiceConfig;
  paths: string[];
  pathErrors?: string[];
  port: number;
  portError?: string;
  onPathChange: (idx: number, value: string) => void;
  onPortChange: (port: number) => void;
  onBrowse?: (idx: number) => void;
  showDefaultButton?: boolean;
  showBrowseButton?: boolean;
  layout?: 'card' | 'inline';
  className?: string;
}

export default function ServiceConfiguration({
  service,
  paths,
  pathErrors = [],
  port,
  portError,
  onPathChange,
  onPortChange,
  onBrowse,
  showDefaultButton = true,
  showBrowseButton = true,
  layout = 'card',
  className = ''
}: ServiceConfigurationProps) {
  const { t } = useTranslation();
  const content = (
    <>
      {service.pathRequirements && service.pathRequirements.length > 0 ? (
        /* Services with paths: Two-column layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* File Paths Column */}
          <PathConfiguration
            serviceKey={service.key}
            serviceName={service.name}
            pathRequirements={service.pathRequirements}
            paths={paths}
            pathErrors={pathErrors}
            onPathChange={onPathChange}
            onBrowse={onBrowse}
            showDefaultButton={showDefaultButton}
            showBrowseButton={showBrowseButton}
          />

          <PortConfigurationColumn service={service} port={port} portError={portError} onPortChange={onPortChange} />
        </div>
      ) : (
        /* Services without paths: Consistent layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Information Column (replaces File Paths) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded text-xs font-medium">
                {t('serviceConfiguration.infoBadge')}
              </span>
              <h4 className="text-sm font-medium text-gray-800 dark:text-white">{t('serviceConfiguration.serviceInformation')}</h4>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-blue-600 dark:text-blue-400 text-2xl">📌</div>
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {t('serviceConfiguration.noPathsRequired')}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {t('serviceConfiguration.noPathsDescription')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <PortConfigurationColumn service={service} port={port} portError={portError} onPortChange={onPortChange} />
        </div>
      )}
    </>
  );

  if (layout === 'card') {
    return (
      <Card key={service.key} className={className}>
        <Card.Header>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{service.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t(`services.${service.key}.description`)}</p>
        </Card.Header>
        <Card.Body>
          {content}
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}