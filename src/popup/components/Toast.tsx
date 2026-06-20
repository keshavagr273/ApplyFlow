import React from 'react';
import { useStore } from '../../shared/store';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-[320px] flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((toast) => {
        let bgColor = 'bg-emerald-50 border-emerald-200 text-emerald-800';
        let Icon = CheckCircle2;
        let iconColor = 'text-emerald-500';

        if (toast.type === 'error') {
          bgColor = 'bg-rose-50 border-rose-200 text-rose-800';
          Icon = AlertCircle;
          iconColor = 'text-rose-500';
        } else if (toast.type === 'info') {
          bgColor = 'bg-sky-50 border-sky-200 text-sky-800';
          Icon = Info;
          iconColor = 'text-sky-500';
        } else if (toast.type === 'warning') {
          bgColor = 'bg-amber-50 border-amber-200 text-amber-800';
          Icon = AlertTriangle;
          iconColor = 'text-amber-500';
        }

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 animate-slide-in pointer-events-auto ${bgColor}`}
            role="alert"
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
            <div className="flex-1 text-xs font-medium leading-relaxed break-words pr-1">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 -mt-0.5 -mr-1 p-0.5 rounded-full hover:bg-black/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
