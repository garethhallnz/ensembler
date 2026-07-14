import { useState, useRef, useEffect } from 'react';
import { HiDotsHorizontal } from 'react-icons/hi';
import { useTranslation } from 'react-i18next';

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  // Show an attention dot (e.g. an update is available)
  highlight?: boolean;
}

// A compact "⋯ More" menu for a service card's secondary/maintenance actions,
// keeping the card face limited to the primary controls.
export default function ServiceActionsMenu({ items }: { items: MenuItem[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={t('actionsMenu.moreActions')}
        className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <HiDotsHorizontal className="w-5 h-5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
          {items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {item.icon}
              <span>{item.label}</span>
              {item.highlight && <span className="ml-auto w-2 h-2 rounded-full bg-amber-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
