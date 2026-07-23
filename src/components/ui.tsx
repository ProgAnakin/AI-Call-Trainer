import { clsx } from 'clsx';
import { forwardRef } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent hover:bg-accent-soft text-white shadow-lg shadow-accent/25 disabled:bg-slate-700',
  secondary:
    'bg-surface-overlay hover:bg-slate-700 text-slate-100 border border-slate-700',
  ghost: 'hover:bg-surface-overlay text-slate-300',
  danger: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-2xl border border-slate-800 bg-surface-raised p-5', className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  color = 'slate',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { color?: 'slate' | 'green' | 'amber' | 'red' | 'indigo' }) {
  const colors = {
    slate: 'bg-slate-800 text-slate-300',
    green: 'bg-emerald-900/60 text-emerald-300',
    amber: 'bg-amber-900/60 text-amber-300',
    red: 'bg-red-900/60 text-red-300',
    indigo: 'bg-indigo-900/60 text-indigo-300',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colors[color],
        className,
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(
          'w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        'w-full rounded-xl border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={clsx('mb-1 block text-xs font-medium text-slate-400', className)} {...props} />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            i <= level ? (level >= 4 ? 'bg-red-400' : level === 3 ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-slate-700',
          )}
        />
      ))}
    </span>
  );
}

export const LANGUAGE_FLAGS: Record<string, string> = {
  'pt-BR': '🇧🇷',
  'pt-PT': '🇵🇹',
  'it-IT': '🇮🇹',
  'en-US': '🇺🇸',
};
