import React from 'react';
import { Section } from './Shared';
import { FileDown, Trash2 } from 'lucide-react';

export function DangerZone({ handleExport, handleClearAll }: { handleExport: () => void, handleClearAll: () => void }) {
  return (
    <Section title="💾 Data Management">
      <div className="flex flex-col gap-3">
        <button onClick={handleExport}
          className="flex items-center justify-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl py-3 text-sm font-bold transition"
        >
          <FileDown size={16} /> Export Backup (JSON)
        </button>
        <button onClick={handleClearAll}
          className="flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl py-3 text-sm font-bold transition"
        >
          <Trash2 size={16} /> Clear All Local Data
        </button>
        <p className="text-[11px] text-slate-400 font-medium text-center">
          Clearing local data removes your profile and applications from this device only. Cloud data is unaffected.
        </p>
      </div>
    </Section>
  );
}
