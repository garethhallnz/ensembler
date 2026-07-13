import { useTranslation } from 'react-i18next';
import { HiGlobeAlt } from 'react-icons/hi';
import { SUPPORTED_LANGUAGES } from '../i18n/config';

// Compact language switcher for surfaces that don't have the full Settings panel
// (first-launch, setup wizard, Docker screens), so language is changeable anywhere.
export default function LanguageMenu() {
  const { t, i18n } = useTranslation();
  return (
    <label className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
      <HiGlobeAlt className="w-5 h-5 shrink-0" aria-hidden />
      <span className="sr-only">{t('language.label')}</span>
      <select
        aria-label={t('language.label')}
        value={i18n.resolvedLanguage}
        onChange={e => i18n.changeLanguage(e.target.value)}
        className="bg-transparent border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {SUPPORTED_LANGUAGES.map(language => (
          <option key={language.code} value={language.code} className="text-gray-900">
            {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}
