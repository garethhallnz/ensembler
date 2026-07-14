import { useTranslation } from 'react-i18next';
import { ToggleSwitch } from 'flowbite-react';
import Card from '../atoms/Card';
import Badge from '../atoms/Badge';

interface ServiceConfig {
  key: string;
  name: string;
  description: string;
  category: string;
  required: boolean;
  recommended?: boolean;
}

interface StepSelectionProps {
  serviceConfig: ServiceConfig[];
  selected: { [key: string]: boolean };
  recommendedOn: boolean;
  onToggleRecommended: () => void;
  onServiceChange: (key: string) => void;
}

const CATEGORY_ORDER = ['media', 'management', 'torrent', 'indexer', 'request'];

export default function StepSelection({
  serviceConfig, selected, recommendedOn, onToggleRecommended, onServiceChange,
}: StepSelectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('setup.step0.heading')}</h2>
      <p className="text-gray-600 dark:text-gray-300">{t('setup.step0.subtitle')}</p>

      {/* Toggle Recommended Option */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{t('setup.step0.quickActions')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {recommendedOn ? t('setup.step0.recommendedOn') : t('setup.step0.recommendedOff')}
            </p>
          </div>
          <div className="flex items-center">
            <ToggleSwitch
              id="toggle-recommended-services"
              checked={recommendedOn}
              onChange={onToggleRecommended}
              label={t('setup.step0.toggleRecommended')}
            />
          </div>
        </div>
      </div>

      {/* Services grouped by category */}
      <div className="space-y-6">
        {CATEGORY_ORDER.map(category => {
          const categoryServices = serviceConfig.filter(service => service.category === category);
          if (categoryServices.length === 0) return null;

          const getCategoryTitle = (cat: string) =>
            t(`setup.categories.${cat}.title`, { defaultValue: cat });

          const getCategoryDescription = (cat: string) =>
            t(`setup.categories.${cat}.description`, { defaultValue: '' });

          return (
            <div key={category} className="space-y-3">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {getCategoryTitle(category)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {getCategoryDescription(category)}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categoryServices.map((service) => (
                  <Card key={service.key} className="overflow-hidden">
                    <Card.Body>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-4">
                          <label htmlFor={`service-${service.key}`} className="block text-lg font-medium text-gray-900 dark:text-white cursor-pointer flex items-center gap-2">
                            <span>{service.name}</span>
                            {service.required && <Badge color="blue">{t('setup.step0.required')}</Badge>}
                            {service.recommended && !service.required && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-900 dark:text-yellow-200">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 15.585l-6.327 3.327 1.209-7.046L0 6.944l7.073-1.027L10 0l2.927 5.917L20 6.944l-4.882 4.922 1.209 7.046L10 15.585z" clipRule="evenodd"/>
                                </svg>
                                {t('setup.step0.recommended')}
                              </span>
                            )}
                          </label>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t(`services.${service.key}.description`, { defaultValue: service.description })}</p>
                        </div>
                        <div className="flex items-center mt-1">
                          <ToggleSwitch
                            id={`service-${service.key}`}
                            checked={!!selected[service.key]}
                            onChange={() => onServiceChange(service.key)}
                            disabled={service.required}
                          />
                        </div>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!Object.values(selected).some(Boolean) && (
        <div className="text-sm text-amber-600 dark:text-amber-400">
          {t('setup.selectAtLeastOne')}
        </div>
      )}
    </div>
  );
}
