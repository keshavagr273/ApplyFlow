import React, { useEffect, useState } from 'react';
import { Storage } from '../shared/storage';
import { Application, AIServiceSettings } from '../shared/types';
import { isJobPage } from '../shared/platformUtils';
import { t } from '../shared/i18n';

// ─── Platform detection util ──────────────────────────────────────────────────

function detectPlatformLabel(url: string): { name: string; color: string; emoji: string } {
  const u = url.toLowerCase();
  if (u.includes('linkedin.com'))        return { name: 'LinkedIn', color: '#0077b5', emoji: '💼' };
  if (u.includes('internshala.com'))     return { name: 'Internshala', color: '#00aaff', emoji: '🎓' };
  if (u.includes('unstop.com'))          return { name: 'Unstop', color: '#f59e0b', emoji: '🏆' };
  if (u.includes('myworkdayjobs.com') || u.includes('workday.com'))
                                         return { name: 'Workday', color: '#f59e0b', emoji: '🏢' };
  if (u.includes('greenhouse.io') || u.includes('grnh.se'))
                                         return { name: 'Greenhouse', color: '#10b981', emoji: '🌿' };
  if (u.includes('lever.co'))            return { name: 'Lever', color: '#4a6cf7', emoji: '⚙️' };
  if (u.includes('smartrecruiters.com')) return { name: 'SmartRecruiters', color: '#aa3bff', emoji: '🎯' };
  if (u.includes('naukri.com'))          return { name: 'Naukri', color: '#ef4444', emoji: '📋' };
  if (u.includes('indeed.com'))          return { name: 'Indeed', color: '#003A9B', emoji: '🔍' };
  return { name: 'Job Page', color: '#64748b', emoji: '📄' };
}

// ─── MiniPopup ────────────────────────────────────────────────────────────────

export default function MiniPopup() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [settings, setSettings] = useState<AIServiceSettings | null>(null);
  const [activeTab, setActiveTab] = useState<{ url: string; title: string } | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);

  const getActiveWebTab = (callback: (tab: chrome.tabs.Tab | null) => void) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const active = tabs[0];
      if (!active || !active.url || active.url.startsWith('chrome-extension://') || active.url.startsWith('chrome://')) {
        chrome.tabs.query({ active: true }, (allActiveTabs) => {
          const firstRealTab = allActiveTabs.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://'));
          callback(firstRealTab || null);
        });
      } else {
        callback(active);
      }
    });
  };

  useEffect(() => {
    // Load data directly from storage (no Zustand overhead for popup speed)
    Promise.all([
      Storage.getApplications(),
      Storage.getSettings(),
    ]).then(([apps, sets]) => {
      setApplications(apps);
      setSettings(sets);
    });

    // Get active tab info
    getActiveWebTab((tab) => {
      if (tab) {
        setActiveTab({ url: tab.url || '', title: tab.title || '' });
      }
    });
  }, []);

  const stats = {
    applied:    applications.filter(a => a.status === 'applied').length,
    interview:  applications.filter(a => a.status === 'interview').length,
    offer:      applications.filter(a => a.status === 'offer').length,
    total:      applications.length,
  };

  const onJobPage = activeTab ? isJobPage(activeTab.url) : false;
  const platformInfo = activeTab ? detectPlatformLabel(activeTab.url) : null;

  const openSidePanel = () => {
    console.log('[ApplyFlow Popup] openSidePanel called.');
    getActiveWebTab((tab) => {
      const tabId = tab?.id;
      if (tabId) {
        console.log('[ApplyFlow Popup] Opening side panel for tab:', tabId);
        if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
          chrome.sidePanel.open({ tabId }).catch((err) => {
            console.error('[ApplyFlow Popup] direct sidePanel.open failed, sending background message:', err);
            chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
          });
        } else if (typeof (globalThis as any).browser !== 'undefined' && (globalThis as any).browser.sidebarAction && (globalThis as any).browser.sidebarAction.open) {
          (globalThis as any).browser.sidebarAction.open().catch((err: any) => {
            console.error('[ApplyFlow Popup] browser.sidebarAction.open failed:', err);
          });
        } else {
          chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        }
        setTimeout(() => {
          window.close();
        }, 150);
      } else {
        console.log('[ApplyFlow Popup] No web tab ID found to open side panel. Falling back to options.');
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        setTimeout(() => {
          window.close();
        }, 150);
      }
    });
  };

  const handleQuickAutofill = async () => {
    console.log('[ApplyFlow Popup] handleQuickAutofill clicked.');
    if (isAutofilling) return;
    setIsAutofilling(true);

    if (!settings?.userEmail) {
      alert(t('signin_warning'));
      setIsAutofilling(false);
      return;
    }

    const profile = await Storage.getProfile();
    console.log('[ApplyFlow Popup] Profile retrieved:', profile);
    if (!profile) {
      console.warn('[ApplyFlow Popup] Profile not found. Informing user.');
      alert(t('profile_warning'));
      setIsAutofilling(false);
      return;
    }

    getActiveWebTab((tab) => {
      if (!tab) {
        console.log('[ApplyFlow Popup] No active web tab found for autofill.');
        setIsAutofilling(false);
        return;
      }

      const pendingApp = {
        id: crypto.randomUUID(),
        company: tab.title?.split(' | ')[0] || 'Company',
        role: 'Role',
        url: tab.url || '',
        platform: 'company_site' as const,
        status: 'applied' as const,
        appliedAt: Date.now(),
        notes: t('quick_fill_notes')
      };

      console.log('[ApplyFlow Popup] Sending ATS_FILL message for tab:', tab.id, pendingApp);
      chrome.runtime.sendMessage({ type: 'ATS_FILL', payload: { profile, pendingApp } });

      if (!settings?.logOnlyAfterSubmission) {
        console.log('[ApplyFlow Popup] logOnlyAfterSubmission is false, saving application immediately.');
        Storage.addApplication(pendingApp).catch(err => console.error('[ApplyFlow Popup] Immediate log error:', err));
      }

      setTimeout(() => {
        setIsAutofilling(false);
        window.close();
      }, 800);
    });
  };

  const handleAnalyze = () => {
    console.log('[ApplyFlow Popup] handleAnalyze clicked.');
    chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
    setTimeout(() => {
      openSidePanel();
    }, 150);
  };

  return (
    <div className="w-[360px] bg-[#f8f9fc] text-slate-800 font-sans flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 bg-white border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            <img 
              src={chrome.runtime.getURL('icons/icon128.png')} 
              alt="ApplyFlow Logo" 
              className="w-full h-full object-cover rounded-full" 
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-800">{t('brandName')}</span>
              {settings?.isPremium ? (
                <span className="text-[9px] font-black bg-gradient-to-r from-brand-600 to-accent-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">{t('pro')}</span>
              ) : (
                <span className="text-[9px] font-bold text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">{t('free')}</span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">{t('copilot_sub')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title={t('active')}></div>
          <span className="text-[10px] text-slate-500 font-medium">{t('active')}</span>
        </div>
      </div>

      {/* ── Stats Row ────────────────────────────────────────── */}
      <div className="mx-4 mt-4 mb-3 grid grid-cols-3 gap-2">
        {[
          { label: t('applied'), value: stats.applied, bg: 'bg-blue-50/50 border-blue-100/70', color: 'text-blue-600', labelColor: 'text-blue-500' },
          { label: t('interview'), value: stats.interview, bg: 'bg-purple-50/50 border-purple-100/70', color: 'text-purple-600', labelColor: 'text-purple-500' },
          { label: t('offer'), value: stats.offer, bg: 'bg-emerald-50/50 border-emerald-100/70', color: 'text-emerald-600', labelColor: 'text-emerald-500' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} border rounded-xl p-2.5 text-center shadow-sm hover:scale-[1.02] transition-transform duration-200`}>
            <div className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className={`text-[9px] ${stat.labelColor} font-bold uppercase tracking-wider mt-0.5`}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Active Tab Context ───────────────────────────────── */}
      {activeTab && (
        <div className="mx-4 mb-3">
          {onJobPage && platformInfo ? (
            <div className="bg-white border border-slate-200/60 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-300 transition-colors">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                style={{ background: `${platformInfo.color}15`, border: `1px solid ${platformInfo.color}30` }}
              >
                {platformInfo.emoji}
              </div>
              <div className="overflow-hidden flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: platformInfo.color }}>
                  {t('job_detected', platformInfo.name)}
                </div>
                <div className="text-xs text-slate-700 font-semibold truncate mt-0.5">{activeTab.title}</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping-once shrink-0"></div>
            </div>
          ) : (
            <div className="bg-slate-100/50 border border-slate-200/40 rounded-xl p-3 flex items-center gap-3 opacity-90">
              <div className="w-8 h-8 rounded-lg bg-slate-200/50 flex items-center justify-center text-base shrink-0">🌐</div>
              <div className="overflow-hidden flex-1">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t('no_job_detected')}</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{t('visit_job_listing')}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div className="mx-4 mb-3 flex flex-col gap-2">
        <button
          onClick={handleQuickAutofill}
          disabled={!onJobPage || isAutofilling}
          className="w-full gradient-premium text-white font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 active:scale-95 shadow-md shadow-brand-500/20"
        >
          <span className={isAutofilling ? 'animate-spin' : ''}>⚡</span>
          {isAutofilling ? t('filling') : t('quick_autofill')}
        </button>

        <button
          onClick={handleAnalyze}
          disabled={!onJobPage}
          className="w-full bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm"
        >
          <span>🔍</span> {t('analyze_job')}
        </button>
      </div>

      {/* ── Open Sidebar ────────────────────────────────────── */}
      <div className="mx-4 mb-4">
        <button
          onClick={openSidePanel}
          className="w-full bg-brand-50 border border-brand-200/60 text-brand-600 font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 hover:bg-brand-100/60 transition-all active:scale-[0.98] shadow-sm"
        >
          <span>📋</span> {t('open_sidebar')}
        </button>
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="border-t border-slate-200/60 bg-white px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-semibold">{t('applications_tracked_short', String(stats.total))}</span>
        <button
          onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })}
          className="text-[10px] text-slate-500 hover:text-brand-600 font-bold transition-colors"
        >
          {t('settings')} ⚙️
        </button>
      </div>
    </div>
  );
}
