import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { HiHome, HiX, HiRefresh, HiExternalLink } from 'react-icons/hi';
import { useServiceTabs } from '../../contexts/ServiceTabsContext';

// React types <webview> as a plain HTMLWebViewElement; Electron's runtime element
// adds control methods. We only reach for reload() here.
interface WebviewElement extends HTMLElement {
  reload(): void;
}

interface TabPillProps {
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function TabPill({ active, onSelect, children }: TabPillProps) {
  const activeClasses = 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm';
  const idleClasses = 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/70 dark:hover:bg-gray-700/70';
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? activeClasses : idleClasses}`}
    >
      {children}
    </button>
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
            <TabPill key={tab.key} active={activeId === tab.key} onSelect={() => setActive(tab.key)}>
              <span className="truncate max-w-[160px]">{tab.name}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={t('tabs.closeService', { name: tab.name })}
                onClick={e => { e.stopPropagation(); closeService(tab.key); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); closeService(tab.key); } }}
                className="ml-1 -mr-1 p-0.5 rounded hover:bg-gray-300/70 dark:hover:bg-gray-600"
              >
                <HiX className="w-3.5 h-3.5" />
              </span>
            </TabPill>
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
