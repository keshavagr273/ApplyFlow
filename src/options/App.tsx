import React, { useEffect, useState } from 'react';
import { useStore } from '../shared/store';
import { Storage } from '../shared/storage';
import { UsageStats } from '../shared/types';
import {
  Sparkles, User, ChevronDown, ChevronUp, HelpCircle, Lock, Keyboard, Settings, Home
} from 'lucide-react';
import { GeneralSettings } from './components/GeneralSettings';
import { SyncSettings } from './components/SyncSettings';
import { DangerZone } from './components/DangerZone';
import { Section } from './components/Shared';
import ToastContainer from '../popup/components/Toast';
import { t } from '../shared/i18n';

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const getFaqItems = () => [
  { q: t('faq_q1'), a: t('faq_a1') },
  { q: t('faq_q2'), a: t('faq_a2') },
  { q: t('faq_q3'), a: t('faq_a3') },
  { q: t('faq_q4'), a: t('faq_a4') },
  { q: t('faq_q5'), a: t('faq_a5') },
  { q: t('faq_q6'), a: t('faq_a6') },
  { q: t('faq_q7'), a: t('faq_a7') },
  { q: t('faq_q8'), a: t('faq_a8') },
  { q: t('faq_q9'), a: t('faq_a9') },
  { q: t('faq_q10'), a: t('faq_a10') },
  { q: t('faq_q11'), a: t('faq_a11') },
  { q: t('faq_q12'), a: t('faq_a12') },
  { q: t('faq_q13'), a: t('faq_a13') },
  { q: t('faq_q14'), a: t('faq_a14') },
  { q: t('faq_q15'), a: t('faq_a15') },
];

// ─── Privacy Policy Text ──────────────────────────────────────────────────────

const getPrivacyPolicy = () => t('privacy_policy_content');

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

const getShortcuts = () => [
  { keys: ['Alt', 'Shift', 'A'], desc: t('shortcut_desc1') },
  { keys: ['Alt', 'Shift', 'S'], desc: t('shortcut_desc2') },
  { keys: ['Alt', 'Shift', 'F'], desc: t('shortcut_desc3') },
  { keys: ['Alt', 'Shift', 'C'], desc: t('shortcut_desc4') },
  { keys: ['Alt', 'Shift', 'T'], desc: t('shortcut_desc5') },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AccordionItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-200/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
      >
        <span className="font-bold text-sm text-slate-800 flex-1 leading-snug">{q}</span>
        {open ? <ChevronUp size={16} className="text-brand-600 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-[13px] text-slate-600 leading-relaxed font-medium border-t border-slate-100 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}


// ─── Nav Items ────────────────────────────────────────────────────────────────

type Tab = 'home' | 'settings' | 'account' | 'privacy' | 'faq' | 'shortcuts' | 'billing';

const NAV_ITEMS = (isPremium?: boolean): Array<{ id: Tab; label: string; icon: React.ReactNode }> => [
  { id: 'home', label: t('nav_home'), icon: <Home size={16} /> },
  { id: 'settings', label: t('nav_settings'), icon: <Settings size={16} /> },
  { id: 'billing', label: isPremium ? t('nav_premium_plan') : t('nav_upgrade_pro'), icon: <Sparkles size={16} className="text-amber-500 animate-pulse" /> },
  { id: 'account', label: t('nav_account_sync'), icon: <User size={16} /> },
  { id: 'privacy', label: t('nav_privacy_policy'), icon: <Lock size={16} /> },
  { id: 'faq', label: t('nav_faq'), icon: <HelpCircle size={16} /> },
  { id: 'shortcuts', label: t('nav_shortcuts'), icon: <Keyboard size={16} /> },
];

// ─── Main Options App ─────────────────────────────────────────────────────────

export default function App() {
  const { settings, loadData, updateSettings, syncToCloud, syncFromCloud, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [usage, setUsage] = useState<UsageStats>({ dailyFillsUsed: 0, dailyFillsLimit: 999999, totalFills: 0, lastUsedTimestamp: 0, creditsUsed: 0, creditsAllocated: 0, creditsPurchased: 0 });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<null | 'success' | 'error'>(null);

  const [licenseInput, setLicenseInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    loadData();
    Storage.getUsageStats().then(setUsage);

    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['home', 'settings', 'account', 'privacy', 'faq', 'shortcuts', 'billing'].includes(hash)) {
        setActiveTab(hash as Tab);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [loadData]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const handleGoogleLogin = () => {
    setIsLoggingIn(true);
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        showToast(t('oauth_login_failed', chrome.runtime.lastError.message || ''), 'error');
        setIsLoggingIn(false);
        return;
      }
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const user = await res.json();
          await updateSettings({ userEmail: user.email, userDisplayName: user.name, userAvatar: user.picture });
          await syncFromCloud();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoggingIn(false);
      }
    });
  };

  const handleGoogleLogout = () => {
    chrome.identity.clearAllCachedAuthTokens(async () => {
      await updateSettings({ userEmail: undefined, userDisplayName: undefined, userAvatar: undefined });
    });
  };

  const handleSync = async (dir: 'push' | 'pull') => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const success = dir === 'push' ? await syncToCloud() : await syncFromCloud();
      setSyncStatus(success ? 'success' : 'error');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleExport = () => {
    chrome.storage.local.get(null, (data) => {
      const el = document.createElement('a');
      el.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      el.download = `ApplyFlow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      el.click();
    });
  };

  const handleClearAll = () => {
    if (confirm(t('delete_all_confirm'))) {
      chrome.storage.local.clear(() => window.location.reload());
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseInput.trim()) return;
    setIsActivating(true);

    await new Promise(r => setTimeout(r, 1200));

    const key = licenseInput.trim().toUpperCase();
    if (key === 'APPLYFLOW-PRO-2026' || (key.length >= 12 && key.includes('PRO'))) {
      await updateSettings({ isPremium: true, licenseKey: key });
      setShowConfetti(true);
      setIsActivating(false);
      setLicenseInput('');
      Storage.getUsageStats().then(setUsage);
      showToast(t('license_activated_msg'), 'success');
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setIsActivating(false);
      showToast(t('license_invalid_msg'), 'error', 5000);
    }
  };

  const handleDeactivateLicense = async () => {
    if (confirm(t('license_deactivate_confirm'))) {
      await updateSettings({ isPremium: false, licenseKey: '' });
      Storage.getUsageStats().then(setUsage);
      showToast(t('license_deactivated_msg'), 'info');
    }
  };

  // ── Gauge ────────────────────────────────────────────────────────────────



  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased relative">
      <ToastContainer />
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <img src={chrome?.runtime?.getURL ? chrome.runtime.getURL('icons/icon128.png') : '/icons/icon128.png'} alt="ApplyFlow Logo" className="w-10 h-10 rounded-2xl shadow-md object-contain bg-white p-1" />
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-none">{t('brandName')}</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 block">{t('control_center_subtitle')}</span>
          </div>
        </div>
        {settings?.userEmail && (
          <div className="bg-slate-50 border border-slate-200/50 rounded-full py-1.5 pl-2.5 pr-4 flex items-center gap-2.5 shadow-sm">
            {settings.userAvatar
              ? <img src={settings.userAvatar} alt="Avatar" className="w-7 h-7 rounded-full" />
              : <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold">
                {settings.userDisplayName?.charAt(0) || 'U'}
              </div>
            }
            <div>
              <div className="text-xs font-bold text-slate-700">{settings.userDisplayName}</div>
              <div className="text-[9px] text-slate-400 font-semibold">{settings.userEmail}</div>
            </div>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-56 flex flex-col gap-1 shrink-0">
          {NAV_ITEMS(settings?.isPremium).map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2.5 border transition-all
                ${activeTab === item.id
                  ? 'bg-white border-brand-200/60 text-brand-600 shadow-sm'
                  : 'border-transparent text-slate-500 hover:bg-slate-100/70 hover:text-slate-700'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}

          <div className="mt-auto pt-4 border-t border-slate-200/50 text-[9px] text-slate-400 font-bold text-center">
            ApplyFlow v1.1.0 🇮🇳
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col gap-6">

          {/* ── HOME ── */}
          {activeTab === 'home' && (
            <>
              <Section title={t('welcome_title')}>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {t('welcome_desc')}
                </p>
                <div className="grid grid-cols-3 gap-4 mt-1">
                  {[
                    { icon: '⚡', title: t('feature_smart_autofill_title'), desc: t('feature_smart_autofill_desc') },
                    { icon: '📌', title: t('feature_web_clipper_title'), desc: t('feature_web_clipper_desc') },
                    { icon: '📊', title: t('feature_kanban_tracker_title'), desc: t('feature_kanban_tracker_desc') },
                    { icon: '🎯', title: t('feature_eeo_autofill_title'), desc: t('feature_eeo_autofill_desc') },
                    { icon: '🤖', title: t('feature_ai_essays_title'), desc: t('feature_ai_essays_desc') },
                    { icon: '🔒', title: t('feature_secure_sync_title'), desc: t('feature_secure_sync_desc') },
                  ].map((f, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                      <span className="text-2xl block mb-1">{f.icon}</span>
                      <h4 className="font-extrabold text-xs text-slate-800">{f.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title={t('get_started_title')}>
                <ol className="flex flex-col gap-4 text-sm text-slate-600 font-medium">
                  {[
                    { step: 1, title: t('get_started_step1_title'), desc: t('get_started_step1_desc') },
                    { step: 2, title: t('get_started_step2_title'), desc: t('get_started_step2_desc') },
                    { step: 3, title: t('get_started_step3_title'), desc: t('get_started_step3_desc') },
                    { step: 4, title: t('get_started_step4_title'), desc: t('get_started_step4_desc') },
                    { step: 5, title: t('get_started_step5_title'), desc: t('get_started_step5_desc') },
                  ].map(({ step, title, desc }) => (
                    <li key={step} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 font-bold flex items-center justify-center shrink-0 border border-brand-100 text-xs">{step}</span>
                      <div>
                        <strong className="text-slate-800 block">{title}</strong>
                        <span className="text-[11px] text-slate-500 font-medium mt-0.5 block leading-relaxed">{desc}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            </>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && settings && (
            !settings.userEmail ? (
              <Section title={t('signin_required_title')}>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto my-8">
                  <div className="text-4xl mb-3">🔑</div>
                  <h3 className="text-base font-extrabold text-slate-800 mb-2">{t('signin_required_header')}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    {t('signin_required_desc')}
                  </p>
                  <button
                    onClick={() => setActiveTab('account')}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md"
                  >
                    {t('go_to_account_sync_btn')}
                  </button>
                </div>
              </Section>
            ) : (
              <GeneralSettings settings={settings} updateSettings={updateSettings} usage={usage} />
            )
          )}

          {/* ── ACCOUNT (Merged Profile Sync & Data Management) ── */}
          {activeTab === 'account' && settings && (
            <>
              <SyncSettings
                settings={settings}
                handleGoogleLogin={handleGoogleLogin}
                handleGoogleLogout={handleGoogleLogout}
                isLoggingIn={isLoggingIn}
                isSyncing={isSyncing}
                syncStatus={syncStatus}
                handleSync={handleSync}
              />
              <DangerZone handleExport={handleExport} handleClearAll={handleClearAll} />
            </>
          )}

          {/* ── BILLING (Premium Upgrade & License Key Activation) ── */}
          {activeTab === 'billing' && settings && (
            <>
              {showConfetti && (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-2xl p-6 text-center animate-bounce shadow-md">
                  <span className="text-3xl">🎉 👑 🌟</span>
                  <h3 className="font-extrabold text-base mt-2">{t('premium_confetti_title')}</h3>
                  <p className="text-xs text-green-600 mt-1 font-semibold">{t('premium_confetti_desc')}</p>
                </div>
              )}

              {/* Pricing Cards Section */}
              <Section title={t('premium_upgrade_title')}>
                <div className="bg-gradient-to-br from-slate-900 to-brand-950 text-white rounded-3xl p-8 relative overflow-hidden shadow-lg border border-slate-800">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
                  <div className="relative z-10">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                      👑 {t('nav_premium_plan')}
                    </span>
                    <h2 className="text-2xl font-black mt-4 leading-tight">{t('premium_upgrade_header')}</h2>
                    <p className="text-slate-300 text-xs mt-2 font-medium leading-relaxed max-w-xl">
                      {t('premium_upgrade_desc')}
                    </p>

                    <div className="inline-flex items-center gap-2 bg-brand-500/20 border border-brand-500/30 rounded-xl px-4 py-2 mt-5 text-[11px] font-bold text-brand-200">
                      <span>{t('early_adopter_offer')}</span>
                      <span className="text-white">{t('early_adopter_offer_desc')}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-6 pt-4">
                  {/* Monthly */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col hover:shadow-md transition-all relative">
                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900">{t('monthly_pro_title')}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">{t('monthly_pro_sub')}</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹599</span>
                        <span className="text-2xl font-black text-brand-600">{t('monthly_pro_price')}</span>
                        <span className="text-xs text-slate-500 font-bold">{t('monthly_pro_period')}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">{t('monthly_pro_day_equiv')}</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        {t('monthly_pro_bullets').split('|||').map((bullet, index) => (
                          <li key={index} className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                            <span className="text-brand-600 font-bold shrink-0">✓</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/M5T00fWS"
                      target="_blank"
                      className="w-full mt-6 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-200/60 rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-sm"
                    >
                      {t('subscribe_monthly_btn')}
                    </a>
                  </div>

                  {/* Quarterly */}
                  <div className="bg-white border-2 border-brand-600 rounded-3xl p-6 flex flex-col hover:shadow-lg transition-all relative transform -translate-y-1 shadow-md">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      {t('most_popular_label')}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">{t('quarterly_pro_title')}</h3>
                      <p className="text-[10px] text-brand-600 font-bold mt-1">{t('quarterly_pro_sub')}</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹1,499</span>
                        <span className="text-2xl font-black text-brand-600">{t('quarterly_pro_price')}</span>
                        <span className="text-xs text-slate-500 font-bold">{t('quarterly_pro_period')}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">{t('quarterly_pro_day_equiv')}</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        {t('quarterly_pro_bullets').split('|||').map((bullet, index) => (
                          <li key={index} className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                            <span className="text-brand-600 font-bold shrink-0">✓</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/qBlT2WMQ"
                      target="_blank"
                      className="w-full mt-6 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-md"
                    >
                      {t('subscribe_quarterly_btn')}
                    </a>
                  </div>

                  {/* Yearly (Ultimate) */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col hover:shadow-md transition-all relative">
                    <div className="absolute -top-3 right-4 bg-red-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                      {t('best_value_save_label')}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900">{t('yearly_ultimate_title')}</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">{t('yearly_ultimate_sub')}</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹4,999</span>
                        <span className="text-2xl font-black text-brand-600">{t('yearly_ultimate_price')}</span>
                        <span className="text-xs text-slate-500 font-bold">{t('yearly_ultimate_period')}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">{t('yearly_ultimate_day_equiv')}</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        {t('yearly_ultimate_bullets').split('|||').map((bullet, index) => (
                          <li key={index} className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                            <span className="text-brand-600 font-bold shrink-0">✓</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/mqV1UchN"
                      target="_blank"
                      className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-sm"
                    >
                      {t('subscribe_yearly_btn')}
                    </a>
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-6 flex items-center justify-between gap-6 mt-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">☕</span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">{t('support_applyflow_title')}</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1 max-w-lg">
                        {t('support_applyflow_desc')}
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://ko-fi.com/keshav12oct"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#FF5E5B] hover:bg-[#ff4844] text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-all shrink-0 flex items-center gap-1.5"
                  >
                    {t('buy_coffee_btn')}
                  </a>
                </div>

                <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-4 py-3 border-t border-slate-200/50 mt-6">
                  {t('footer_pricing_badges').split('|||').map((badge, index) => (
                    <span key={index}>{badge}</span>
                  ))}
                </div>
              </Section>

              {/* License Key Activation Section */}
              <Section title={t('premium_key_activation_title')}>
                {settings.isPremium ? (
                  <div className="bg-brand-50/50 border border-brand-200 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center text-xl">👑</div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{t('premium_active_title')}</h4>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">{t('premium_active_desc', settings.licenseKey || '')}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDeactivateLicense}
                      className="border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs px-4 py-2 rounded-xl bg-white shadow-sm transition-all"
                    >
                      {t('deactivate_license_btn')}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      {t('premium_key_activation_desc')}
                    </p>
                    <div className="flex gap-3 max-w-md">
                      <input
                        type="text"
                        placeholder="APPLYFLOW-XXXX-XXXX-XXXX"
                        value={licenseInput}
                        onChange={e => setLicenseInput(e.target.value)}
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white font-mono uppercase"
                      />
                      <button
                        onClick={handleActivateLicense}
                        disabled={isActivating || !licenseInput.trim()}
                        className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md"
                      >
                        {isActivating ? t('activating_btn') : t('activate_btn')}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      💡 {t('premium_tip').replace('APPLYFLOW-PRO-2026', '')} <code className="font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">APPLYFLOW-PRO-2026</code>.
                    </p>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── PRIVACY POLICY ── */}
          {activeTab === 'privacy' && (
            <Section title={t('privacy_policy_title')}>
              <div className="prose prose-sm max-w-none">
                <div className="text-[12.5px] text-slate-600 leading-[1.85] font-medium whitespace-pre-wrap">
                  {getPrivacyPolicy().split('\n').map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                      return <strong key={i} className="text-slate-800 font-extrabold block mt-4 mb-0.5">{line.replace(/\*\*/g, '')}</strong>;
                    }
                    if (line.startsWith('---')) {
                      return <hr key={i} className="border-slate-200 my-4" />;
                    }
                    if (line.startsWith('• ')) {
                      return <div key={i} className="flex gap-2 ml-2"><span className="text-brand-500 shrink-0 mt-0.5">•</span><span>{line.slice(2)}</span></div>;
                    }
                    return <span key={i} className="block">{line}</span>;
                  })}
                </div>
              </div>
            </Section>
          )}

          {/* ── FAQ ── */}
          {activeTab === 'faq' && (
            <Section title={t('faq_section_title')}>
              <div className="flex flex-col gap-3">
                {getFaqItems().map((item, i) => (
                  <AccordionItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </Section>
          )}

          {/* ── KEYBOARD SHORTCUTS ── */}
          {activeTab === 'shortcuts' && (
            <Section title={t('nav_shortcuts')}>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500 font-medium">
                  {t('shortcut_configure_label')} <code className="bg-slate-100 px-1.5 py-0.5 rounded text-brand-600 text-xs">chrome://extensions/shortcuts</code>
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  {getShortcuts().map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-3 px-4 rounded-xl border border-slate-200/60 bg-slate-50/50">
                      <span className="text-sm text-slate-700 font-medium">{s.desc}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, j) => (
                          <span key={j} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-bold text-slate-600 shadow-sm font-mono">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-700 font-medium leading-relaxed">
                  <strong>{t('shortcut_note_title')}</strong> {t('shortcut_note_desc', 'chrome://extensions/shortcuts')}
                </div>
              </div>
            </Section>
          )}

        </main>
      </div>
    </div>
  );
}
