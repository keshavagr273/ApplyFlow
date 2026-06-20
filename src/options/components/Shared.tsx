import React from 'react';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">{title}</h2>
      {children}
    </div>
  );
}

export function Toggle({
  label, description, checked, onChange
}: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-700 group-hover:text-brand-600 transition-colors">{label}</span>
        {description && <span className="text-[11px] text-slate-400 font-medium mt-0.5">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`shrink-0 relative w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-brand-600' : 'bg-slate-200'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}
