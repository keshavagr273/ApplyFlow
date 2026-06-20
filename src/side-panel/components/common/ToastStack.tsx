import React from 'react';
import { useStore } from '../../../shared/store';

export default function ToastStack() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  const icons: Record<string, string> = {
    success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️'
  };
  const colors: Record<string, string> = {
    success: 'border-emerald-500/40 bg-emerald-500/10',
    error:   'border-red-500/40 bg-red-500/10',
    info:    'border-blue-500/40 bg-blue-500/10',
    warning: 'border-amber-500/40 bg-amber-500/10',
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '300px' }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-md
            animate-slide-in pointer-events-auto cursor-pointer
            ${colors[toast.type] || colors.info}
          `}
          onClick={() => removeToast(toast.id)}
        >
          <span className="text-sm shrink-0">{icons[toast.type]}</span>
          <span className="text-xs text-gray-200 font-medium leading-snug">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
