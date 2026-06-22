import React from 'react';
import { Section, Toggle } from './Shared';
import { CheckCircle2 } from 'lucide-react';
import { AIServiceSettings, UsageStats } from '../../../src/shared/types';
import { t } from '../../shared/i18n';

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
      <Section title={t('general_settings_title')}>
        <div className="flex flex-col gap-5">
          <Toggle
            label={t('setting_show_linkedin')}
            description={t('setting_show_linkedin_desc')}
            checked={settings.enableOverlay}
            onChange={v => updateSettings({ enableOverlay: v })}
          />
          <Toggle
            label={t('setting_show_clipper')}
            description={t('setting_show_clipper_desc')}
            checked={settings.showClipButton !== false}
            onChange={v => updateSettings({ showClipButton: v })}
          />
          <Toggle
            label={t('setting_log_after_apply')}
            description={t('setting_log_after_apply_desc')}
            checked={settings.logOnlyAfterSubmission || false}
            onChange={v => updateSettings({ logOnlyAfterSubmission: v })}
          />
        </div>
      </Section>

      <Section title={t('settings_analytics_title')}>
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
              <div className="text-[10px] text-slate-400 font-extrabold uppercase">{t('credits_left')}</div>
            </div>
          </div>

          <div className="w-full max-w-sm grid grid-cols-2 gap-3">
            {[
              { label: t('credits_remaining'), value: remaining },
              { label: t('total_credits'), value: total },
              { label: t('all_time_autofills'), value: usage.totalFills || 0 },
              { label: t('plan_status'), value: settings.isPremium ? t('plan_status_premium') : t('plan_status_free') },
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
              <strong>{t('pro_tip_title')}</strong> {t('pro_tip_desc')}
            </span>
          </div>
        </div>
      </Section>
    </>
  );
}
