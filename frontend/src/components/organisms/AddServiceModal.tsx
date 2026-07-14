import { useTranslation } from 'react-i18next';
import Button from '../atoms/Button';
import Badge from '../atoms/Badge';
import Dialog from '../atoms/Dialog';
import type { ServiceCatalogEntry } from './ServiceConfigModal';

interface AddServiceModalProps {
  // Services not yet enabled — the only ones offered here.
  available: (ServiceCatalogEntry & { category?: string; recommended?: boolean })[];
  onPick: (service: ServiceCatalogEntry) => void;
  onClose: () => void;
}

// Lightweight picker: choose a service to add, then the ServiceConfigModal
// (opened by the parent) collects its paths/port and applies it.
export default function AddServiceModal({ available, onPick, onClose }: AddServiceModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog show onClose={onClose} ariaLabel={t('addService.title')} size="3xl">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('addService.title')}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('addService.subtitle')}</p>
        </div>

        <div className="p-6">
          {available.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">{t('addService.allAdded')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {available.map(service => (
                <div
                  key={service.key}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-left min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{service.name}</h4>
                        {service.recommended && <Badge color="blue">{t('addService.recommended')}</Badge>}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t(`services.${service.key}.description`)}</p>
                    </div>
                    <Button size="sm" color="blue" onClick={() => onPick(service)} className="shrink-0">{t('addService.add')}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button color="gray" outline onClick={onClose}>{t('addService.cancel')}</Button>
        </div>
      </div>
    </Dialog>
  );
}
