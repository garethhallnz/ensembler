import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from './index';
import { SUPPORTED_LANGUAGES } from '../i18n/config';

// First-launch language chooser. English is the default; the currently detected
// language is preselected when it's one we support.
export default function LanguageSelect({ onDone }: { onDone: (code: string) => void }) {
  const { t, i18n } = useTranslation();
  const detected = SUPPORTED_LANGUAGES.find(language => language.code === i18n.resolvedLanguage)?.code ?? 'en';
  const [selected, setSelected] = useState<string>(detected);

  const choose = async () => {
    await i18n.changeLanguage(selected);
    onDone(selected);
  };

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('language.chooseTitle')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{t('language.chooseSubtitle')}</p>
        </div>

        <div role="radiogroup" aria-label={t('language.chooseTitle')} className="space-y-2">
          {SUPPORTED_LANGUAGES.map(language => {
            const isActive = selected === language.code;
            return (
              <button
                key={language.code}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setSelected(language.code)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-gray-900 dark:text-white'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span className="font-medium">{language.label}</span>
                <span className={`w-4 h-4 rounded-full border-2 ${isActive ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`} />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={choose}
          className="mt-6 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          {t('language.continue')}
        </button>
      </div>
    </div>
  );
}
