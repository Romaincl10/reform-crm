import clsx from 'clsx';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm',
        variant === 'primary' && 'bg-reform-violet text-white hover:bg-reform-violet-dark',
        variant === 'secondary' && 'bg-reform-mauve text-reform-violet hover:bg-reform-violet-light',
        variant === 'ghost' && 'text-reform-ink hover:bg-reform-beige',
        variant === 'danger' && 'bg-red-50 text-red-600 hover:bg-red-100',
        className
      )}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx('bg-white border border-reform-border rounded-2xl', className)}
    />
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'violet' | 'green' | 'amber' | 'red' | 'blue';
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        tone === 'neutral' && 'bg-reform-beige text-reform-ink',
        tone === 'violet' && 'bg-reform-violet-light text-reform-violet',
        tone === 'green' && 'bg-emerald-50 text-emerald-700',
        tone === 'amber' && 'bg-amber-50 text-amber-700',
        tone === 'red' && 'bg-red-50 text-red-700',
        tone === 'blue' && 'bg-blue-50 text-blue-700',
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl border border-reform-border bg-white text-sm text-reform-ink outline-none transition',
        'focus:border-reform-violet focus:ring-2 focus:ring-reform-violet-light',
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl border border-reform-border bg-white text-sm text-reform-ink outline-none transition resize-y min-h-[80px]',
        'focus:border-reform-violet focus:ring-2 focus:ring-reform-violet-light',
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl border border-reform-border bg-white text-sm text-reform-ink outline-none transition cursor-pointer',
        'focus:border-reform-violet focus:ring-2 focus:ring-reform-violet-light',
        props.className
      )}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-reform-gray uppercase tracking-wide mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-reform-gray-soft mt-1">{hint}</span>}
    </label>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-reform-border flex items-center justify-between">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} className="text-reform-gray hover:text-reform-ink text-2xl leading-none">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-reform-gray mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 bg-reform-mauve rounded-2xl">
      <div className="font-display text-xl text-reform-ink">{title}</div>
      {hint && <p className="text-reform-gray text-sm mt-2 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const formatMoney = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
