import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ServiceTab {
  key: string;
  name: string;
  url: string;
}

// 'dashboard' is the always-present home tab; any other id is a service key.
type ActiveTabId = 'dashboard' | (string & {});

interface ServiceTabsValue {
  tabs: ServiceTab[];
  activeId: ActiveTabId;
  openService: (tab: ServiceTab) => void;
  closeService: (key: string) => void;
  setActive: (id: ActiveTabId) => void;
}

const ServiceTabsContext = createContext<ServiceTabsValue | undefined>(undefined);

export const useServiceTabs = () => {
  const context = useContext(ServiceTabsContext);
  if (!context) throw new Error('useServiceTabs must be used within a ServiceTabsProvider');
  return context;
};

export function ServiceTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<ServiceTab[]>([]);
  const [activeId, setActiveId] = useState<ActiveTabId>('dashboard');

  const openService = useCallback((tab: ServiceTab) => {
    setTabs(prev => (prev.some(t => t.key === tab.key) ? prev : [...prev, tab]));
    setActiveId(tab.key);
  }, []);

  const closeService = useCallback((key: string) => {
    setTabs(prev => prev.filter(t => t.key !== key));
    setActiveId(prev => (prev === key ? 'dashboard' : prev));
  }, []);

  const setActive = useCallback((id: ActiveTabId) => setActiveId(id), []);

  return (
    <ServiceTabsContext.Provider value={{ tabs, activeId, openService, closeService, setActive }}>
      {children}
    </ServiceTabsContext.Provider>
  );
}
