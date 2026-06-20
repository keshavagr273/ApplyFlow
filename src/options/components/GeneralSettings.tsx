import React from 'react';
import { Section, Toggle } from './Shared';
import { CheckCircle2 } from 'lucide-react';
import { AIServiceSettings, UsageStats } from '../../../src/shared/types';

function getUTCMidnightInLocal() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
}

export function GeneralSettings({ settings, updateSettings, usage }: { settings: AIServiceSettings, updateSettings: (s: Partial<AIServiceSettings>) => void, usage: UsageStats }) {
  const radius = 52;
  const circ   = 2 * Math.PI * radius;
  
  const allocated = usage.creditsAllocated || 0;
  const purchased = usage.creditsPurchased || 0;
  const used = usage.creditsUsed || 0;
  const total = allocated + purchased;
  const remaining = Math.max(0, total - used);
  
  const pctRemaining = total > 0 ? Math.round((remaining / total) * 100) : 0;
  const offset = circ - (remaining / Math.max(1, total)) * circ;
  const gaugeColor = pctRemaining > 40 ? '#10b981' : pctRemaining > 15 ? '#f59e0b' : '#ef4444';

  return (
    <>
      <Section title="⚙️ General Settings">
        <div className="flex flex-col gap-5">
          <Toggle
            label="Show on LinkedIn Job Pages"
            description="Shows a smart matching score and a one-click autofill button when you view job postings on LinkedIn."
            checked={settings.enableOverlay}
            onChange={v => updateSettings({ enableOverlay: v })}
          />
          <Toggle
            label="Show 'Save Job' Button"
            description="Shows a floating 'Save Job 📌' button on job sites so you can quickly save job details to your tracker before applying."
            checked={settings.showClipButton !== false}
            onChange={v => updateSettings({ showClipButton: v })}
          />
          <Toggle
            label="Only Log After Actually Applying"
            description="Wait until you see the 'Thank You' or 'Success' screen before adding the job to your tracker. Keeps your tracker neat by preventing half-filled forms from being saved as 'Applied'."
            checked={settings.logOnlyAfterSubmission || false}
            onChange={v => updateSettings({ logOnlyAfterSubmission: v })}
          />
        </div>
      </Section>

      <Section title="📊 AI Credits & Usage Analytics">
        <div className="flex flex-col items-center gap-6">
          {/* Gauge */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="88" cy="88" r={radius} className="stroke-slate-100 fill-none" strokeWidth="12" />
              <circle cx="88" cy="88" r={radius} fill="none" stroke={gaugeColor}
                strokeWidth="12" strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={offset}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-3xl font-black text-slate-800">{remaining}</div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase">Credits Left</div>
            </div>
          </div>

          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            {[
              { label: 'Credits Remaining', value: remaining },
              { label: 'Total Credits', value: total },
              { label: 'All-time Autofills', value: usage.totalFills || 0 },
              { label: 'Plan Status', value: settings.isPremium ? 'Premium 👑' : 'Free 🔓' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                <div className="text-lg font-black text-brand-600">{item.value}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-bold px-5 py-3 rounded-xl border border-brand-200/60 max-w-md text-center leading-relaxed" style={{ justifyContent: 'center' }}>
            <span className="shrink-0">💡</span>
            <span className="text-left leading-normal">
              <strong>Pro Tip:</strong> Smart Autofill operations consume <strong>0 credits</strong> and are 100% unlimited! Only advanced AI features like Cover Letters (5 credits) and custom Essays (3 credits) consume your credit balance.
            </span>
          </div>
        </div>
      </Section>
    </>
  );
}
