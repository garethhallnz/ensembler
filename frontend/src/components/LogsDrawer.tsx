import type { RefObject } from 'react';
import { Drawer } from 'flowbite-react';
import { useTranslation } from 'react-i18next';

interface LogsDrawerProps {
  open: boolean;
  serviceName: string | null;
  logs: string | undefined;
  scrollRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onScroll: () => void;
}

export default function LogsDrawer({ open, serviceName, logs, scrollRef, onClose, onScroll }: LogsDrawerProps) {
  const { t } = useTranslation();

  return (
    <Drawer open={open} onClose={onClose} position="right" className="!w-[900px] max-w-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700">
      <div className="h-full flex flex-col bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">
            {serviceName ? t('dashboard.logs.titleNamed', { name: serviceName }) : t('dashboard.logs.title')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> {t('dashboard.logs.live')}
          </span>
        </div>
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto bg-gray-900 px-4 py-3">
          <pre className="text-left text-gray-100 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
            {serviceName ? (logs ?? t('dashboard.logs.loading')) : ''}
          </pre>
        </div>
      </div>
    </Drawer>
  );
}
