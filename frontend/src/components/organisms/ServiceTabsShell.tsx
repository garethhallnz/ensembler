import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HiHome, HiX, HiRefresh, HiExternalLink } from 'react-icons/hi';
import { useServiceTabs } from '../../contexts/ServiceTabsContext';

// React types <webview> as a plain HTMLWebViewElement; Electron's runtime element
// adds control methods. We only reach for reload() here.
interface WebviewElement extends HTMLElement {
  reload(): void;
}

const PILL_ACTIVE = 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm';
const PILL_IDLE = 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700/70';

interface TabPillProps {
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function TabPill({ active, onSelect, children }: TabPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? PILL_ACTIVE : PILL_IDLE}`}
    >
      {children}
    </button>
  );
}

interface ClosableTabProps {
  active: boolean;
  name: string;
  closeLabel: string;
  onSelect: () => void;
  onClose: () => void;
}

// Select and close are separate sibling buttons sharing one pill background,
// so neither is nested inside the other (a button-in-button is invalid HTML
// and unpredictable for assistive tech).
function ClosableTab({ active, name, closeLabel, onSelect, onClose }: ClosableTabProps) {
  return (
    <div className={`inline-flex items-center rounded-lg text-sm font-medium transition-colors ${active ? PILL_ACTIVE : PILL_IDLE}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className="flex items-center gap-1.5 pl-3 pr-1 py-1.5 rounded-l-lg"
      >
        <span className="truncate max-w-[160px]">{name}</span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="mr-1 p-0.5 rounded hover:bg-gray-300/70 dark:hover:bg-gray-600"
      >
        <HiX className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Wraps the dashboard in a tabbed shell: the dashboard is the home tab, and each
// opened service renders in-app via <webview> so users never see a browser's
// "Not Secure" address bar. Inactive views are kept mounted (hidden via
// visibility, not display:none, which breaks <webview> rendering on re-show).
export default function ServiceTabsShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { tabs, activeId, closeService, setActive } = useServiceTabs();
  const webviews = useRef<Record<string, WebviewElement | null>>({});
  const activeTab = tabs.find(t => t.key === activeId);

  return (
    <div className="flex flex-col h-screen">
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1.5">
          <TabPill active={activeId === 'dashboard'} onSelect={() => setActive('dashboard')}>
            <HiHome className="w-4 h-4 shrink-0" />
            <span>{t('tabs.dashboard')}</span>
          </TabPill>

          {tabs.map(tab => (
            <ClosableTab
              key={tab.key}
              active={activeId === tab.key}
              name={tab.name}
              closeLabel={t('tabs.closeService', { name: tab.name })}
              onSelect={() => setActive(tab.key)}
              onClose={() => closeService(tab.key)}
            />
          ))}

          {activeTab && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => webviews.current[activeTab.key]?.reload()}
                aria-label={t('tabs.reloadService', { name: activeTab.name })}
                title={t('tabs.reload')}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <HiRefresh className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => window.open(activeTab.url, '_blank')}
                aria-label={t('tabs.openServiceInBrowser', { name: activeTab.name })}
                title={t('tabs.openInBrowser')}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <HiExternalLink className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <div
          className="absolute inset-0 overflow-auto bg-gray-50 dark:bg-gray-900"
          style={{ visibility: activeId === 'dashboard' ? 'visible' : 'hidden' }}
        >
          {children}
        </div>

        {tabs.map(tab => (
          <webview
            key={tab.key}
            ref={el => { webviews.current[tab.key] = el as WebviewElement | null; }}
            src={tab.url}
            partition="persist:services"
            allowpopups={true}
            className="absolute inset-0 w-full h-full"
            style={{ visibility: activeId === tab.key ? 'visible' : 'hidden' }}
          />
        ))}
      </div>
    </div>
  );
}
