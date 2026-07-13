import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Documentation is authored as markdown in the repo-root docs/ folder and
// bundled at build time, so the in-app help works offline and stays in sync
// with the shipped version. English lives at docs/*.md; each translation lives
// under docs/<lang>/*.md. All imports are static so Vite can resolve them.
import overviewEn from '../../../docs/overview.md?raw';
import gettingStartedEn from '../../../docs/getting-started.md?raw';
import managingEn from '../../../docs/managing-services.md?raw';
import troubleshootingEn from '../../../docs/troubleshooting.md?raw';

import overviewEs from '../../../docs/es/overview.md?raw';
import gettingStartedEs from '../../../docs/es/getting-started.md?raw';
import managingEs from '../../../docs/es/managing-services.md?raw';
import troubleshootingEs from '../../../docs/es/troubleshooting.md?raw';

import overviewDe from '../../../docs/de/overview.md?raw';
import gettingStartedDe from '../../../docs/de/getting-started.md?raw';
import managingDe from '../../../docs/de/managing-services.md?raw';
import troubleshootingDe from '../../../docs/de/troubleshooting.md?raw';

import overviewFr from '../../../docs/fr/overview.md?raw';
import gettingStartedFr from '../../../docs/fr/getting-started.md?raw';
import managingFr from '../../../docs/fr/managing-services.md?raw';
import troubleshootingFr from '../../../docs/fr/troubleshooting.md?raw';

import overviewZhHans from '../../../docs/zh-Hans/overview.md?raw';
import gettingStartedZhHans from '../../../docs/zh-Hans/getting-started.md?raw';
import managingZhHans from '../../../docs/zh-Hans/managing-services.md?raw';
import troubleshootingZhHans from '../../../docs/zh-Hans/troubleshooting.md?raw';

import overviewPtBR from '../../../docs/pt-BR/overview.md?raw';
import gettingStartedPtBR from '../../../docs/pt-BR/getting-started.md?raw';
import managingPtBR from '../../../docs/pt-BR/managing-services.md?raw';
import troubleshootingPtBR from '../../../docs/pt-BR/troubleshooting.md?raw';

import overviewRu from '../../../docs/ru/overview.md?raw';
import gettingStartedRu from '../../../docs/ru/getting-started.md?raw';
import managingRu from '../../../docs/ru/managing-services.md?raw';
import troubleshootingRu from '../../../docs/ru/troubleshooting.md?raw';

type DocName = 'overview' | 'getting-started' | 'managing' | 'troubleshooting';

// [language][docName] → markdown. English is the guaranteed-complete baseline
// used as the fallback when a language is missing a page.
const DOCS: Record<string, Partial<Record<DocName, string>>> = {
  en: {
    overview: overviewEn,
    'getting-started': gettingStartedEn,
    managing: managingEn,
    troubleshooting: troubleshootingEn,
  },
  es: {
    overview: overviewEs,
    'getting-started': gettingStartedEs,
    managing: managingEs,
    troubleshooting: troubleshootingEs,
  },
  de: {
    overview: overviewDe,
    'getting-started': gettingStartedDe,
    managing: managingDe,
    troubleshooting: troubleshootingDe,
  },
  fr: {
    overview: overviewFr,
    'getting-started': gettingStartedFr,
    managing: managingFr,
    troubleshooting: troubleshootingFr,
  },
  'zh-Hans': {
    overview: overviewZhHans,
    'getting-started': gettingStartedZhHans,
    managing: managingZhHans,
    troubleshooting: troubleshootingZhHans,
  },
  'pt-BR': {
    overview: overviewPtBR,
    'getting-started': gettingStartedPtBR,
    managing: managingPtBR,
    troubleshooting: troubleshootingPtBR,
  },
  ru: {
    overview: overviewRu,
    'getting-started': gettingStartedRu,
    managing: managingRu,
    troubleshooting: troubleshootingRu,
  },
};

// User-facing help only — no internal roadmap/infrastructure notes here.
const PAGES: { id: DocName; titleKey: string }[] = [
  { id: 'overview', titleKey: 'docsViewer.pages.overview' },
  { id: 'getting-started', titleKey: 'docsViewer.pages.gettingStarted' },
  { id: 'managing', titleKey: 'docsViewer.pages.managing' },
  { id: 'troubleshooting', titleKey: 'docsViewer.pages.troubleshooting' },
];

// Map markdown elements to Tailwind so rendered docs match the app and adapt to
// dark mode, without pulling in a typography plugin.
const md: Components = {
  h1: (p) => <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-3 first:mt-0" {...p} />,
  h2: (p) => <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-2" {...p} />,
  h3: (p) => <h3 className="text-base font-semibold text-gray-900 dark:text-white mt-5 mb-1.5" {...p} />,
  p: (p) => <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300 my-3" {...p} />,
  ul: (p) => <ul className="list-disc pl-6 my-3 space-y-1.5 text-[15px] text-gray-700 dark:text-gray-300" {...p} />,
  ol: (p) => <ol className="list-decimal pl-6 my-3 space-y-1.5 text-[15px] text-gray-700 dark:text-gray-300" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  a: (p) => <a className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noreferrer" {...p} />,
  strong: (p) => <strong className="font-semibold text-gray-900 dark:text-white" {...p} />,
  code: (p) => <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[13px] font-mono text-gray-800 dark:text-gray-200" {...p} />,
  blockquote: (p) => <blockquote className="border-l-4 border-amber-400 dark:border-amber-500 pl-4 my-4 text-gray-600 dark:text-gray-400" {...p} />,
  hr: () => <hr className="my-6 border-gray-200 dark:border-gray-700" />,
  table: (p) => <div className="overflow-x-auto my-4"><table className="min-w-full text-[14px] border border-gray-200 dark:border-gray-700 rounded" {...p} /></div>,
  th: (p) => <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 bg-gray-50 dark:bg-gray-800 text-left font-semibold text-gray-900 dark:text-white" {...p} />,
  td: (p) => <td className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300" {...p} />,
};

export default function Docs() {
  const { t, i18n } = useTranslation();
  const [active, setActive] = useState<DocName>(PAGES[0].id);
  const page = PAGES.find((p) => p.id === active) ?? PAGES[0];

  const language = i18n.resolvedLanguage ?? 'en';
  const content = DOCS[language]?.[page.id] ?? DOCS.en[page.id] ?? '';

  return (
    <div className="h-full flex bg-white dark:bg-gray-800">
      <aside className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">{t('docsViewer.heading')}</h2>
        <nav className="space-y-1">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                p.id === active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {t(p.titleKey)}
            </button>
          ))}
        </nav>
      </aside>
      <article className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-2xl">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
