import { useTranslation } from 'react-i18next';
import Card from '../atoms/Card';
import Select from '../atoms/Select';
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext';
import { SUPPORTED_LANGUAGES } from '../../i18n/config';

// Theme picker + language select, shared by the setup-time (appearance-only)
// panel and the full app settings. `selectId` keeps the language <label>/<select>
// association unique when both instances could exist in the DOM.
export default function AppearanceSettings({ selectId }: { selectId: string }) {
  const { t, i18n } = useTranslation();
  const { preference, setPreference } = useTheme();

  return (
    <Card>
      <Card.Header>
        <h4 className="text-lg font-medium">{t('settings.appearance.heading')}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('settings.appearance.description')}</p>
      </Card.Header>
      <Card.Body>
        <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-1 gap-1">
          {(['light', 'dark', 'system'] as ThemePreference[]).map(opt => (
            <button
              key={opt}
              onClick={() => setPreference(opt)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                preference === opt
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t(`settings.appearance.theme.${opt}`)}
            </button>
          ))}
        </div>

        <div className="mt-5">
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('language.label')}
          </label>
          <div className="max-w-[240px]">
            <Select id={selectId} value={i18n.resolvedLanguage} onChange={e => i18n.changeLanguage(e.target.value)}>
              {SUPPORTED_LANGUAGES.map(language => (
                <option key={language.code} value={language.code}>{language.label}</option>
              ))}
            </Select>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('language.settingHint')}</p>
        </div>
      </Card.Body>
    </Card>
  );
}
