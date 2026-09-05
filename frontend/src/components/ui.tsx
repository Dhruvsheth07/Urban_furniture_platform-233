import React from 'react';
import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

// ---- Card ----
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-slate-200/70 ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

// ---- Button ----
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};
export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: BtnProps) {
  const variants: Record<string, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes: Record<string, string> = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };
  return (
    <button className={`rounded-lg font-medium transition-colors disabled:cursor-not-allowed inline-flex items-center gap-2 ${variants[variant]} ${sizes[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

// ---- Status badge ----
const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-100 text-emerald-700',
  OPEN: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-rose-100 text-rose-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-200 text-slate-500',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  POSTED: 'bg-emerald-100 text-emerald-700',
  HIGH: 'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-600',
};
export function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const style = STATUS_STYLES[String(tone ?? children).toUpperCase()] || 'bg-slate-100 text-slate-600';
  return <span className={`px-2.5 py-1 text-xs rounded-full font-medium whitespace-nowrap ${style}`}>{children}</span>;
}

// ---- States ----
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <Loader2 className="animate-spin mb-3" size={28} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-slate-300 mb-3">{icon || <Inbox size={40} />}</div>
      <p className="text-slate-700 font-medium">{title}</p>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-sm">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="text-rose-400 mb-3" size={36} />
      <p className="text-slate-700 font-medium">Couldn’t load this</p>
      <p className="text-sm text-slate-500 mt-1">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// ---- Page header ----
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ---- Simple table primitives ----
export function Table({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm">{children}</table></div>;
}
export function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-5 py-3 font-medium text-slate-500 bg-slate-50 whitespace-nowrap ${className}`}>{children}</th>;
}
export function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-5 py-3 text-slate-700 ${className}`}>{children}</td>;
}

// ---- Toast (lightweight, context-free) ----
export function toast(message: string, type: 'success' | 'error' = 'success') {
  const el = document.createElement('div');
  el.textContent = message;
  el.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`;
  el.style.animation = 'fadeIn .2s ease';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}
