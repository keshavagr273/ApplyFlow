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

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'What is ApplyFlow and how does it work?',
    a: 'ApplyFlow is an AI-powered Chrome extension that automatically detects and fills job application forms across 15+ platforms including LinkedIn, Internshala, Unstop, Workday, Greenhouse, Lever, and more. It reads your saved profile and uses intelligent matching to fill text fields, dropdowns, radio buttons, and checkboxes — including EEO/demographic questions.'
  },
  {
    q: 'Is my personal data safe with ApplyFlow?',
    a: 'Yes. Your data is stored locally in your browser\'s chrome.storage.local by default. It is never sent to any third-party server other than your own optional Supabase database (which you control). ApplyFlow never sells, shares, or monetizes your personal information.'
  },
  {
    q: 'Which job platforms does ApplyFlow support?',
    a: 'ApplyFlow supports 15+ platforms out of the box: LinkedIn Easy Apply, Internshala, Unstop, Workday, Greenhouse, Lever, iCIMS, SmartRecruiters, BambooHR, Jobvite, Taleo, Naukri, Indeed, Wellfound/AngelList, and any other site via our intelligent generic fallback matcher.'
  },
  {
    q: 'What is the Web Clipper?',
    a: 'The Web Clipper is a floating "Save Job" button (📌) that automatically appears when you visit any job listing page. Clicking it extracts the job title, company, salary, and description, then saves it to your ApplyFlow tracker as a "Saved" application — so you can track jobs before applying.'
  },
  {
    q: 'How do I update my profile?',
    a: 'Open the ApplyFlow popup, click the "Profile" tab, and upload your resume PDF. The AI will auto-populate all your fields. You can also manually edit any field including your EEO preferences, work authorization, and cover letters.'
  },
  {
    q: 'What are EEO fields and why do I need them?',
    a: 'EEO (Equal Employment Opportunity) fields are questions that many US and global employers ask about gender, disability status, veteran status, and work authorization. ApplyFlow stores your preferred answers and automatically fills these radio button groups so you don\'t have to answer them manually every time.'
  },
  {
    q: 'Does ApplyFlow require any API keys or configuration?',
    a: 'No! ApplyFlow handles all form detection, smart matching, cover letter generation, and compatibility scoring automatically. You do not need to obtain or configure any API keys.'
  },
  {
    q: 'What is Supabase sync and do I need it?',
    a: 'Supabase sync is an optional cloud backup feature. When you sign in with Google and enable it, your profile and application tracker are synced to a private cloud database so your data is backed up and accessible from multiple devices. This is completely optional — the extension works fully offline.'
  },
  {
    q: 'Why does ApplyFlow need access to all websites?',
    a: 'ApplyFlow requests access to all websites so it can inject the autofill engine on any job application form, and show the "Save Job" clipper button on any job listing. This permission is required for broad platform support. We only inject scripts on pages that are clearly job-related.'
  },
  {
    q: 'What is the Kanban Board?',
    a: 'The Kanban Board is a visual job tracking view in the Tracker tab. It shows your applications organized in columns: Saved → Applied → Assessment → Interview → Offer. You can drag and drop cards between columns to update the status of any application.'
  },
  {
    q: 'How does submission detection work?',
    a: 'When you enable "Log only after submission" in settings, ApplyFlow watches for page changes that indicate a successful submission (like a URL containing "/success" or body text saying "Thank you for applying"). It only logs the application to your tracker after it detects a real submission.'
  },
  {
    q: 'Can I store multiple cover letters?',
    a: 'Yes! The Profile screen has a "Cover Letter Vault" section where you can store unlimited cover letters tailored to different roles or companies. When autofilling, ApplyFlow will use your most recent or most relevant cover letter.'
  },
  {
    q: 'How do I export my application data?',
    a: 'Go to Account & Sync → scroll to the bottom → click "Export Backup (JSON)". This downloads all your profile and application data as a JSON file for safekeeping.'
  },
  {
    q: 'Does ApplyFlow work in Demo Mode?',
    a: 'Demo Mode was a legacy setting used for testing. It is now disabled by default. All features are live and functional with the built-in Gemini API key.'
  },
  {
    q: 'How do I report a bug or request a feature?',
    a: 'Please open an issue on our GitHub repository (linked in the About section) or email us at support@applyflow.in. We typically respond within 48 hours.'
  },
];

// ─── Privacy Policy Text ──────────────────────────────────────────────────────

const PRIVACY_POLICY = `**ApplyFlow Chrome Extension — Privacy Policy**
Last Updated: June 2026

---

**1. Introduction**

ApplyFlow ("we", "our", "the Extension") is a Chrome browser extension that helps users autofill job application forms, track their applications, and manage their professional profile. This Privacy Policy explains how we collect, use, store, and protect your information.

By installing and using ApplyFlow, you agree to the practices described in this policy.

---

**2. Data We Collect**

We collect only the information you voluntarily provide to enable the extension's features:

• **Profile Information**: Your name, email, phone number, college, degree, skills, work history, projects, and professional links (LinkedIn, GitHub, Portfolio).
• **EEO/Demographic Information (Optional)**: Gender, disability status, veteran status, and work authorization preferences — provided only if you choose to fill these fields. This data is used exclusively to autofill optional EEO questionnaires on job applications.
• **Application Tracking Data**: Job title, company, application URL, status, and notes for positions you track using the extension.
• **Usage Statistics**: Number of autofill operations performed (stored locally to enforce daily limits).
• **Authentication Data**: If you choose to sign in with Google, we store your Google display name, email address, and profile picture URL to personalize your experience and enable cloud sync.

We do **not** collect:
• Payment or financial information
• Browser history or general browsing activity
• Any information from pages that are not job-application-related
• Any data from pages when the extension is not actively triggered

---

**3. How We Store Your Data**

**3.1 Local Storage (Default)**
All data is primarily stored in your browser's chrome.storage.local API. This data resides only on your device and is never transmitted to any server without your explicit action.

**3.2 Cloud Sync (Optional)**
If you choose to sign in with Google and enable the "Supabase Sync" feature, your profile and application data will also be synchronized to a Supabase database. You retain full ownership of this data. You can delete it at any time from the Account & Sync section.

**3.3 Gemini AI Requests**
When AI features are used (e.g., essay generation, job analysis), portions of your profile (skills, degree, summary) and the job description text are sent to Google's Gemini API to generate the response. This is processed under Google's standard API Terms of Service and Privacy Policy. We recommend not including sensitive personal identifiers in your AI-assisted content.

---

**4. Data Sharing**

We do **not** sell, trade, rent, or share your personal information with any third parties for marketing or advertising purposes.

Your data may be processed by the following trusted services:
• **Google Gemini API**: For AI-powered form filling and analysis (https://policies.google.com/privacy)
• **Google OAuth**: For account authentication (https://policies.google.com/privacy)
• **Supabase**: For optional cloud storage (https://supabase.com/privacy) — only if you enable sync

---

**5. Your Rights & Controls**

You have the right to:
• **Access** all data ApplyFlow has stored about you (via Export Backup in settings)
• **Correct** your information at any time in the Profile tab
• **Delete** all your data locally using "Clear All Profile Data" in settings
• **Withdraw consent** at any time by uninstalling the extension
• **Disable cloud sync** by toggling it off in Account & Sync settings

**GDPR (EU Users)**: If you are an EU resident, you have the rights to access, rectify, erase, restrict processing, and data portability under the General Data Protection Regulation.

**India — DPDP Act 2023**: In compliance with India's Digital Personal Data Protection Act 2023, we process personal data only for the purpose of providing the job application assistance service. You may withdraw consent and request deletion of your data at any time by contacting us.

**California — CCPA**: California residents have the right to know what personal information is collected, the right to delete, and the right to opt-out of sale (we do not sell data).

---

**6. Data Retention**

Local data is retained until you clear it manually. Cloud-synced data is retained until you delete your account or request deletion. We do not automatically delete data.

---

**7. Security**

We take reasonable technical measures to protect your data:
• All cloud communications use HTTPS/TLS encryption
• Supabase Row-Level Security (RLS) ensures users can only access their own data
• The extension does not request permissions beyond what is needed for its core function

---

**8. Children's Privacy**

ApplyFlow is not intended for users under the age of 13. We do not knowingly collect data from children. If you believe a child has provided us with personal information, please contact us immediately.

---

**9. Changes to This Policy**

We may update this Privacy Policy from time to time. Significant changes will be communicated via the extension's Options page. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

**10. Contact Us**

For any privacy-related questions, data deletion requests, or concerns:

Email: privacy@applyflow.in
GitHub: https://github.com/applyflow/extension
Website: https://applyflow.in

We aim to respond to all requests within 30 days.`;

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

const SHORTCUTS = [
  { keys: ['Alt', 'Shift', 'A'], desc: 'Open ApplyFlow popup' },
  { keys: ['Alt', 'Shift', 'S'], desc: 'Scan current page for form fields' },
  { keys: ['Alt', 'Shift', 'F'], desc: 'Trigger Smart Autofill on current page' },
  { keys: ['Alt', 'Shift', 'C'], desc: 'Clip current job listing to tracker' },
  { keys: ['Alt', 'Shift', 'T'], desc: 'Open Tracker in a new tab' },
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
  { id: 'home', label: 'Home & About', icon: <Home size={16} /> },
  { id: 'settings', label: 'General Settings', icon: <Settings size={16} /> },
  { id: 'billing', label: isPremium ? 'Premium Plan 👑' : 'Upgrade to Pro 👑', icon: <Sparkles size={16} className="text-amber-500 animate-pulse" /> },
  { id: 'account', label: 'Account & Sync', icon: <User size={16} /> },
  { id: 'privacy', label: 'Privacy Policy', icon: <Lock size={16} /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle size={16} /> },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={16} /> },
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
        showToast(`Login failed: ${chrome.runtime.lastError.message}`, 'error');
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
    if (confirm('This will permanently delete ALL local profile and application data. Are you sure?')) {
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
      showToast("License Activated Successfully! Welcome to ApplyFlow Premium. 🎉", 'success');
      setTimeout(() => setShowConfetti(false), 5000);
    } else {
      setIsActivating(false);
      showToast("Invalid license key. Hint: Try using the demo key 'APPLYFLOW-PRO-2026'!", 'error', 5000);
    }
  };

  const handleDeactivateLicense = async () => {
    if (confirm("Are you sure you want to deactivate your premium license? This will return you to the Free Plan.")) {
      await updateSettings({ isPremium: false, licenseKey: '' });
      Storage.getUsageStats().then(setUsage);
      showToast("Premium license deactivated. You are now on the Free Plan.", 'info');
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
            <h1 className="text-lg font-black text-slate-900 leading-none">ApplyFlow</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 block">Control Center</span>
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
              <Section title="🚀 Welcome to ApplyFlow">
                <p className="text-sm text-slate-600 leading-relaxed">
                  ApplyFlow is an <strong>AI-powered Chrome extension</strong> built for students and job seekers who want to apply faster and smarter. It automatically detects and fills job application forms across 15+ platforms, tracks your pipeline, and helps you land more interviews.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-1">
                  {[
                    { icon: '⚡', title: 'Smart Autofill', desc: '15+ ATS platforms with precise selectors' },
                    { icon: '📌', title: 'Web Clipper', desc: 'One-click save any job listing' },
                    { icon: '📊', title: 'Kanban Tracker', desc: 'Drag & drop your application pipeline' },
                    { icon: '🎯', title: 'EEO Autofill', desc: 'Auto-fills demographic & visa questions' },
                    { icon: '🤖', title: 'AI Essays', desc: 'Gemini-powered custom answer writing' },
                    { icon: '🔒', title: 'Secure Sync', desc: 'Optional Supabase cloud backup' },
                  ].map((f, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200/50 rounded-xl p-4 text-center">
                      <span className="text-2xl block mb-1">{f.icon}</span>
                      <h4 className="font-extrabold text-xs text-slate-800">{f.title}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="📖 How to Get Started">
                <ol className="flex flex-col gap-4 text-sm text-slate-600 font-medium">
                  {[
                    { step: 1, title: 'Build your Profile', desc: 'Open the popup → Profile tab → upload your resume PDF. The AI will auto-extract all your details including skills, experience, education, and projects.' },
                    { step: 2, title: 'Set EEO Preferences', desc: 'Scroll to the EEO section in your Profile and set your work authorization, visa sponsorship needs, and demographic preferences. These are used to autofill EEO questionnaires.' },
                    { step: 3, title: 'Browse a Job Listing', desc: 'Navigate to any job listing. You\'ll see a 📌 "Save Job" button appear. Click it to instantly save the position to your tracker.' },
                    { step: 4, title: 'Open an Application Form', desc: 'Navigate to the application form. Click the ApplyFlow popup → hit "Scan Page" → then "⚡ Smart Autofill". All fields including radio buttons and dropdowns are filled instantly.' },
                    { step: 5, title: 'Track Your Pipeline', desc: 'Open the Tracker tab to see all your applications. Switch to Kanban Board view and drag cards between columns as your status updates.' },
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
              <Section title="🔒 Sign In Required">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center max-w-md mx-auto my-8">
                  <div className="text-4xl mb-3">🔑</div>
                  <h3 className="text-base font-extrabold text-slate-800 mb-2">Sign In to Customize Settings</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    General Settings are only available to signed-in users. Sign in with Google to configure your preferences, autofill behaviors, and more.
                  </p>
                  <button
                    onClick={() => setActiveTab('account')}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md"
                  >
                    Go to Account & Sync
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
                  <h3 className="font-extrabold text-base mt-2">Premium Activated!</h3>
                  <p className="text-xs text-green-600 mt-1 font-semibold">Thank you for supporting ApplyFlow. All premium features are now unlocked.</p>
                </div>
              )}

              {/* Pricing Cards Section */}
              <Section title="👑 Premium Upgrade Plan">
                <div className="bg-gradient-to-br from-slate-900 to-brand-950 text-white rounded-3xl p-8 relative overflow-hidden shadow-lg border border-slate-800">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10"></div>
                  <div className="relative z-10">
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider">
                      👑 Premium Plan
                    </span>
                    <h2 className="text-2xl font-black mt-4 leading-tight">Unlock your career exports & advanced AI features.</h2>
                    <p className="text-slate-300 text-xs mt-2 font-medium leading-relaxed max-w-xl">
                      Get premium AI credits for cover letters, custom essay answers, resume optimization, and mock interview prep. Autofill operations on supported platforms are fully <strong>unlimited and free</strong> for all premium users!
                    </p>

                    <div className="inline-flex items-center gap-2 bg-brand-500/20 border border-brand-500/30 rounded-xl px-4 py-2 mt-5 text-[11px] font-bold text-brand-200">
                      <span>🎁 Early Adopter Offer:</span>
                      <span className="text-white">Next price increase at 500 Premium users. Lock in this rate for life!</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-6 pt-4">
                  {/* Monthly */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col hover:shadow-md transition-all relative">
                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900">Monthly Pro</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Good for short-term search</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹599</span>
                        <span className="text-2xl font-black text-brand-600">₹399</span>
                        <span className="text-xs text-slate-500 font-bold">/ month</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">(Just ₹13 / day)</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>150 AI Credits</strong> per month</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>Unlimited</strong> autofills (All Portals)</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Cloud Sync & Google Backup</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Premium Themes</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Ad-free Experience</span>
                        </li>
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/M5T00fWS"
                      target="_blank"
                      className="w-full mt-6 bg-brand-50 hover:bg-brand-100 text-brand-600 border border-brand-200/60 rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-sm"
                    >
                      Subscribe Monthly
                    </a>
                  </div>

                  {/* Quarterly */}
                  <div className="bg-white border-2 border-brand-600 rounded-3xl p-6 flex flex-col hover:shadow-lg transition-all relative transform -translate-y-1 shadow-md">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                      Most Popular
                    </div>

                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900 mt-1">Quarterly Pro</h3>
                      <p className="text-[10px] text-brand-600 font-bold mt-1">Best value for most job seekers</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹1,499</span>
                        <span className="text-2xl font-black text-brand-600">₹999</span>
                        <span className="text-xs text-slate-500 font-bold">/ 3 months</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">(Just ₹11 / day)</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>500 AI Credits</strong> per quarter</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>Unlimited</strong> autofills (All Portals)</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Tailored Cover Letters & Essays</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Cloud Sync & Google Backup</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Resume Match Suggestions</span>
                        </li>
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/qBlT2WMQ"
                      target="_blank"
                      className="w-full mt-6 bg-brand-600 hover:bg-brand-700 text-white rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-md"
                    >
                      Subscribe Quarterly
                    </a>
                  </div>

                  {/* Yearly (Ultimate) */}
                  <div className="bg-white border border-slate-200/60 rounded-3xl p-6 flex flex-col hover:shadow-md transition-all relative">
                    <div className="absolute -top-3 right-4 bg-red-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-sm">
                      Best Value - Save 40%
                    </div>

                    <div className="flex-1">
                      <h3 className="text-sm font-extrabold text-slate-900">Yearly Ultimate</h3>
                      <p className="text-[10px] text-slate-400 font-semibold mt-1">Best value for power users</p>

                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-xs text-slate-400 line-through font-semibold">₹4,999</span>
                        <span className="text-2xl font-black text-brand-600">₹2,999</span>
                        <span className="text-xs text-slate-500 font-bold">/ year</span>
                      </div>
                      <span className="text-[9px] text-slate-400 font-semibold mt-0.5 block">(Equivalent to ₹249 / month)</span>

                      <ul className="flex flex-col gap-2.5 mt-6 text-[11px] font-semibold text-slate-600">
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>2,500 AI Credits</strong> per year</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span><strong>Unlimited</strong> daily autofills</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Tailored Cover Letters & Essays</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Cloud Sync & Google Backup</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Resume Match Suggestions</span>
                        </li>
                        <li className="flex items-center gap-2 text-slate-800" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>
                          <span className="text-brand-600 font-bold shrink-0">✓</span>
                          <span>Priority Email Support</span>
                        </li>
                      </ul>
                    </div>
                    <a
                      href="https://rzp.io/rzp/mqV1UchN"
                      target="_blank"
                      className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-center text-xs font-black uppercase transition-all shadow-sm"
                    >
                      Subscribe Yearly
                    </a>
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-6 flex items-center justify-between gap-6 mt-6">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">☕</span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-800">Support ApplyFlow Development</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed mt-1 max-w-lg">
                        ApplyFlow is built and maintained by independent developers. If you find the extension helpful, consider donating on Ko-fi to help keep it active, ad-free, and updated for new job boards.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://ko-fi.com/keshav12oct"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#FF5E5B] hover:bg-[#ff4844] text-white font-extrabold text-xs px-5 py-3 rounded-xl shadow-md transition-all shrink-0 flex items-center gap-1.5"
                  >
                    Buy me a coffee on Ko-fi
                  </a>
                </div>

                <div className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-4 py-3 border-t border-slate-200/50 mt-6">
                  <span>⭐ 5.0 Rating</span>
                  <span>🔒 Secure Payments</span>
                  <span>✓ Cancel Anytime</span>
                </div>
              </Section>

              {/* License Key Activation Section */}
              <Section title="🔑 License Key Activation">
                {settings.isPremium ? (
                  <div className="bg-brand-50/50 border border-brand-200 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-2xl flex items-center justify-center text-xl">👑</div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">ApplyFlow Pro Active</h4>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">License key: <code className="font-mono bg-brand-100/50 text-brand-700 px-1.5 py-0.5 rounded text-[11px] font-bold">{settings.licenseKey}</code></p>
                      </div>
                    </div>
                    <button
                      onClick={handleDeactivateLicense}
                      className="border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs px-4 py-2 rounded-xl bg-white shadow-sm transition-all"
                    >
                      Deactivate License
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                      If you have purchased a subscription or received an access code, enter your license key below to unlock ApplyFlow Premium.
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
                        {isActivating ? 'Activating...' : 'Activate'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      💡 Tip: You can activate Premium using the key <code className="font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">APPLYFLOW-PRO-2026</code>.
                    </p>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* ── PRIVACY POLICY ── */}
          {activeTab === 'privacy' && (
            <Section title="🔒 Privacy Policy">
              <div className="prose prose-sm max-w-none">
                <div className="text-[12.5px] text-slate-600 leading-[1.85] font-medium whitespace-pre-wrap">
                  {PRIVACY_POLICY.split('\n').map((line, i) => {
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
            <Section title="❓ Frequently Asked Questions">
              <div className="flex flex-col gap-3">
                {FAQ_ITEMS.map((item, i) => (
                  <AccordionItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </Section>
          )}

          {/* ── KEYBOARD SHORTCUTS ── */}
          {activeTab === 'shortcuts' && (
            <Section title="⌨️ Keyboard Shortcuts">
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500 font-medium">
                  Configure shortcuts in Chrome at <code className="bg-slate-100 px-1.5 py-0.5 rounded text-brand-600 text-xs">chrome://extensions/shortcuts</code>
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  {SHORTCUTS.map((s, i) => (
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
                  <strong>Note:</strong> Chrome extension commands require manual assignment in Chrome's shortcut manager. Go to <code>chrome://extensions/shortcuts</code> to bind the keys listed above.
                </div>
              </div>
            </Section>
          )}

        </main>
      </div>
    </div>
  );
}
