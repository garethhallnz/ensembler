import React, { createContext, useContext, useEffect, useState } from 'react';

// The user's stored choice. 'system' follows the OS and updates live.
export type ThemePreference = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: EffectiveTheme;                 // resolved theme actually applied
  preference: ThemePreference;           // what the user selected
  setPreference: (p: ThemePreference) => void;
  toggleTheme: () => void;               // convenience: flip light/dark
}

const STORAGE_KEY = 'ensembler-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const CustomThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    return saved ?? 'system';
  });
  const [systemDark, setSystemDark] = useState<boolean>(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Keep following the OS while the preference is 'system'.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const theme: EffectiveTheme =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, preference);
  }, [theme, preference]);

  const setPreference = (p: ThemePreference) => setPreferenceState(p);
  const toggleTheme = () => setPreferenceState(theme === 'light' ? 'dark' : 'light');

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
