import { Button, Card, Badge } from './index';
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add a service</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Choose a service to add to your media center. You'll set its paths and port next.</p>
        </div>

        <div className="p-6">
          {available.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">All available services are already added.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {available.map(service => (
                <Card key={service.key} className="hover:shadow-lg transition-shadow">
                  <Card.Body>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{service.name}</h4>
                          {service.recommended && <Badge color="blue">Recommended</Badge>}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{service.description}</p>
                      </div>
                      <Button size="sm" color="blue" onClick={() => onPick(service)} className="shrink-0">Add</Button>
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <Button color="gray" outline onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
