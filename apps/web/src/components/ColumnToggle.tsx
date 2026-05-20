import { useEffect, useState } from 'react';
import clsx from 'clsx';

/**
 * Hook pour gérer un toggle booléen persisté en localStorage.
 */
export function usePersistedToggle(key: string, defaultValue = true): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === '1';
  });

  useEffect(() => {
    localStorage.setItem(key, value ? '1' : '0');
  }, [key, value]);

  return [value, setValue];
}

interface ColumnToggleProps {
  columns: { key: string; label: string; show: boolean; onToggle: (v: boolean) => void }[];
}

export function ColumnToggle({ columns }: ColumnToggleProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs uppercase tracking-wider text-reform-gray font-medium">Colonnes :</span>
      {columns.map(c => (
        <button
          key={c.key}
          type="button"
          onClick={() => c.onToggle(!c.show)}
          className={clsx(
            'px-3 py-1 rounded-full text-xs font-medium transition border',
            c.show
              ? 'bg-reform-violet-light text-reform-violet border-reform-violet-light'
              : 'bg-transparent text-reform-gray border-reform-border hover:text-reform-ink'
          )}
        >
          {c.show ? '✓ ' : ''}{c.label}
        </button>
      ))}
    </div>
  );
}
