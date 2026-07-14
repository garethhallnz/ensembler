import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import es from './locales/es.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import zhHans from './locales/zh-Hans.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';

// Native names so each option reads in its own language/script in the picker.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'ru', label: 'Русский' },
] as const;

// Set once the user has explicitly picked a language, so the first-launch
// chooser only shows until then.
export const LANGUAGE_CHOSEN_KEY = 'ensembler:languageChosen';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      de: { translation: de },
      fr: { translation: fr },
      'zh-Hans': { translation: zhHans },
      'pt-BR': { translation: ptBR },
      ru: { translation: ru },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(language => language.code),
    // NB: do NOT set nonExplicitSupportedLngs — it strips codes to their base
    // for the supported-check (zh-Hans→zh, pt-BR→pt), which aren't in
    // supportedLngs, so those languages would wrongly fall back to English.
    load: 'currentOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });
