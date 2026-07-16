import { useTranslation } from 'react-i18next';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';
import EnvironmentSettings from '../molecules/EnvironmentSettings';
import ServiceConfiguration from './ServiceConfiguration';

interface ServiceConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultPort: number;
  pathRequirements: { label: string; required: boolean; description: string }[];
  required: boolean;
  recommended?: boolean;
}

interface StepConfigurationProps {
  selected: { [key: string]: boolean };
  serviceConfig: ServiceConfig[];
  paths: { [service: string]: string[] };
  pathErrors: { [service: string]: string[] };
  ports: { [key: string]: number };
  portErrors: { [key: string]: string };
  onPathChange: (svc: string, idx: number, value: string) => void;
  onPortChange: (svc: string, port: number) => void;
  environment: { tz: string; puid: number; pgid: number };
  envErrors: { [key: string]: string };
  onEnvironmentChange: (field: 'tz' | 'puid' | 'pgid', value: string | number) => void;
}

export default function StepConfiguration({
  selected, serviceConfig, paths, pathErrors, ports, portErrors, onPathChange, onPortChange,
  environment, envErrors, onEnvironmentChange,
}: StepConfigurationProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('setup.step1.heading')}</h2>
        <p className="text-gray-600 dark:text-gray-300">{t('setup.step1.subtitle')}</p>
      </div>
      <div className="space-y-6">
        {Object.keys(selected).filter((svc) => selected[svc]).map((svc) => {
          const service = serviceConfig.find(s => s.key === svc);
          if (!service) return null;

          return (
            <ServiceConfiguration
              key={svc}
              service={service}
              paths={paths[svc] || []}
              pathErrors={pathErrors[svc] || []}
              port={ports[svc] || service.defaultPort}
              portError={portErrors[svc]}
              onPathChange={(idx, value) => onPathChange(svc, idx, value)}
              onPortChange={(port) => onPortChange(svc, port)}
              layout="card"
            />
          );
        })}
      </div>

      {/* Environment Variables Section */}
      <Card>
        <Card.Header>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('setup.step1.environmentSettings')}</h3>
          </div>
        </Card.Header>
        <Card.Body>
          <EnvironmentSettings
            environment={environment}
            errors={envErrors}
            onEnvironmentChange={onEnvironmentChange}
            layout="grid"
          />
        </Card.Body>
      </Card>

      {/* Compact review folded into configuration, so applying is one
          click from here rather than a separate review step. */}
      <Card>
        <Card.Header>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('setup.step1.readyToSetUp')}</h3>
        </Card.Header>
        <Card.Body>
          <div className="space-y-1.5">
            {Object.keys(selected).filter(key => selected[key]).map((key) => {
              const service = serviceConfig.find(s => s.key === key);
              const primaryPath = (paths[key] || []).find(Boolean);
              return (
                <div key={key} className="flex items-center gap-2 text-sm text-left">
                  <span className="font-medium text-gray-900 dark:text-white min-w-[120px]">{service?.name || key}</span>
                  <Badge color="blue">{t('setup.step1.port', { port: ports[key] || service?.defaultPort })}</Badge>
                  {primaryPath && <span className="text-gray-500 dark:text-gray-400 font-mono truncate">{primaryPath}</span>}
                </div>
              );
            })}
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
