import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../shared/store';
import { Screen } from '../../shared/types';
import { GroqAIService } from '../../shared/aiService';
import { Storage } from '../../shared/storage';
import { Sparkles, Compass, Check, AlertTriangle, Mail, HelpCircle, Briefcase } from 'lucide-react';
import { t } from '../../shared/i18n';

const PLATFORM_STYLES: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  linkedin:        { label: 'LinkedIn',        color: '#0077b5', bg: '#0077b515', emoji: '💼' },
  internshala:     { label: 'Internshala',     color: '#00aaff', bg: '#00aaff15', emoji: '🎓' },
  unstop:          { label: 'Unstop',          color: '#f59e0b', bg: '#f59e0b15', emoji: '🏆' },
  workday:         { label: 'Workday',         color: '#f59e0b', bg: '#f59e0b15', emoji: '🏢' },
  greenhouse:      { label: 'Greenhouse',      color: '#10b981', bg: '#10b98115', emoji: '🌿' },
  lever:           { label: 'Lever',           color: '#4a6cf7', bg: '#4a6cf715', emoji: '⚙️' },
  smartrecruiters: { label: 'SmartRecruiters', color: '#aa3bff', bg: '#aa3bff15', emoji: '🎯' },
  icims:           { label: 'iCIMS',           color: '#3b82f6', bg: '#3b82f615', emoji: '🔗' },
  naukri:          { label: 'Naukri',          color: '#ef4444', bg: '#ef444415', emoji: '📋' },
  indeed:          { label: 'Indeed',          color: '#003A9B', bg: '#003A9B15', emoji: '🔍' },
  bamboohr:        { label: 'BambooHR',        color: '#7db93d', bg: '#7db93d15', emoji: '🎋' },
  angellist:       { label: 'AngelList',       color: '#000000', bg: '#ffffff15', emoji: '😇' },
};

const STATUS_COLORS: Record<string, string> = {
  applied:    'text-blue-400',
  interview:  'text-purple-400',
  offer:      'text-emerald-400',
  rejected:   'text-red-400',
  assessment: 'text-amber-400',
  saved:      'text-gray-400',
  withdrawn:  'text-gray-500',
};

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { profile, applications, settings, tabContext, addApplication, showToast } = useStore();
  const [analysis, setAnalysis] = useState<{ matchScore: number; strongSkills: string[]; missingSkills: string[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFilling, setIsFilling] = useState(false);

  const stats = useMemo(() => ({
    applied:    applications.filter(a => a.status === 'applied').length,
    interview:  applications.filter(a => a.status === 'interview').length,
    offer:      applications.filter(a => a.status === 'offer').length,
    saved:      applications.filter(a => a.status === 'saved').length,
    total:      applications.length,
  }), [applications]);

  const recentApps = useMemo(() =>
    [...applications].sort((a, b) => b.appliedAt - a.appliedAt).slice(0, 5),
    [applications]
  );

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? t('good_morning') : greetingHour < 17 ? t('good_afternoon') : t('good_evening');
  const userName = profile?.name?.split(' ')[0] || settings?.userDisplayName?.split(' ')[0] || t('there');

  // Auto-analyze when job page is detected
  useEffect(() => {
    if (!tabContext?.isJobPage || !tabContext.jobDescription || !profile) return;
    setIsAnalyzing(true);
    setAnalysis(null);

    chrome.storage.local.set({
      lastScanned: {
        company: tabContext.company,
        role: tabContext.role,
        jobDescription: tabContext.jobDescription,
        url: tabContext.url,
        platform: tabContext.platform,
      }
    });

    GroqAIService.analyzeJobDescription(
      profile.resumeText || '',
      tabContext.jobDescription,
      settings?.geminiApiKey || '',
      settings?.demoMode ?? true
    ).then(res => {
      setAnalysis(res);
    }).catch(() => {}).finally(() => setIsAnalyzing(false));
  }, [tabContext?.url, profile?.resumeText]);

  const handleAutofill = useCallback(async () => {
    if (!profile) return;
    setIsFilling(true);

    await Storage.incrementDailyUsage();

    const pendingApp = {
      id: crypto.randomUUID(),
      company: tabContext?.company || 'Company',
      role: tabContext?.role || 'Position',
      url: tabContext?.url || '',
      platform: (tabContext?.platform || 'company_site') as any,
      status: 'applied' as const,
      appliedAt: Date.now(),
      notes: t('autofill_notes'),
      jobDescription: tabContext?.jobDescription,
      matchScore: analysis?.matchScore,
    };

    chrome.runtime.sendMessage({ type: 'ATS_FILL', payload: { profile, pendingApp } });
    await addApplication(pendingApp);
    showToast(t('autofill_success'), 'success');
    setTimeout(() => setIsFilling(false), 1500);
  }, [profile, settings, tabContext, analysis, addApplication, showToast]);

  const handleGenerateCoverLetter = () => {
    onNavigate('assistant');
    // Signal to assistant to open cover letter flow
    chrome.storage.local.set({ assistantIntent: 'cover_letter' });
  };

  const platformStyle = tabContext?.platform ? (PLATFORM_STYLES[tabContext.platform] || null) : null;

  return (
    <div className="flex flex-col h-full bg-surface-dark">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-white/6">
        <h1 className="text-lg font-bold text-white">
          {greeting}, <span className="text-brand-400">{userName}</span>
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {stats.total > 0
            ? t('applications_tracked', String(stats.total), String(stats.interview))
            : t('start_applying')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* ── Job Page Context Panel (ATS Mode) ────────────────── */}
        {tabContext?.isJobPage ? (
          <div className="rounded-2xl border border-white/10 overflow-hidden animate-scale-in">
            {/* Platform badge */}
            {platformStyle && (
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ background: platformStyle.bg, borderBottom: `1px solid ${platformStyle.color}25` }}
              >
                <span className="text-lg">{platformStyle.emoji}</span>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: platformStyle.color }}>
                    {platformStyle.label}
                  </div>
                  {tabContext.role && (
                    <div className="text-sm font-semibold text-white truncate max-w-[280px]">
                      {tabContext.role}{tabContext.company ? ` · ${tabContext.company}` : ''}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-surface-dark50 p-3 flex flex-col gap-3">
              {/* Match Score & Autofill Row */}
              {isAnalyzing ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-3 bg-white/5 rounded w-20 animate-pulse" />
                    <div className="h-2.5 bg-white/5 rounded w-32 animate-pulse" />
                  </div>
                </div>
              ) : analysis ? (
                <div className="flex items-center justify-between gap-3">
                  {/* Compact Match Score Badge */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative w-10 h-10 shrink-0">
                      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <path className="text-white/5" stroke="currentColor" strokeWidth="3.5" fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path
                          stroke="#4a6cf7" strokeWidth="3.5" fill="none" strokeLinecap="round"
                          strokeDasharray={`${analysis.matchScore} 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          style={{ transition: 'stroke-dasharray 1s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black text-white">{analysis.matchScore}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider leading-none">{t('match_score')}</div>
                      <div className="text-xs font-black text-white leading-normal mt-1">{t('fit_percent', String(analysis.matchScore))}</div>
                    </div>
                  </div>

                  {/* Compact Autofill Button */}
                  <button
                    onClick={handleAutofill}
                    disabled={isFilling || !profile}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg py-2 px-3 text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                  >
                    <Sparkles size={11} className={isFilling ? 'animate-spin' : ''} />
                    <span>{isFilling ? t('filling') : t('autofill')}</span>
                  </button>
                </div>
              ) : null}

              {/* Compact Skills Display */}
              {analysis && (
                <div className="flex flex-wrap gap-1 border-t border-white/5 pt-2">
                  {analysis.strongSkills.slice(0, 3).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-medium leading-none">
                      {s}
                    </span>
                  ))}
                  {analysis.missingSkills.slice(0, 2).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-medium leading-none">
                      {s}
                    </span>
                  ))}
                  {(analysis.strongSkills.length > 3 || analysis.missingSkills.length > 2) && (
                    <span className="text-[9px] text-gray-500 font-semibold px-1 py-0.5 self-center">
                      {t('more_skills', String(analysis.strongSkills.length - 3 + Math.max(0, analysis.missingSkills.length - 2)))}
                    </span>
                  )}
                </div>
              )}

              {/* Secondary Actions */}
              {analysis && (
                <div className="flex gap-2 border-t border-white/5 pt-2">
                  <button
                    onClick={handleGenerateCoverLetter}
                    className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-semibold rounded-lg py-1.5 text-[10px] flex items-center justify-center gap-1.5 hover:bg-white/10 transition-all active:scale-95"
                  >
                    <Mail size={11} /> {t('cover_letter')}
                  </button>
                  <button
                    onClick={() => onNavigate('assistant')}
                    className="flex-1 bg-white/5 border border-white/10 text-gray-300 font-semibold rounded-lg py-1.5 text-[10px] flex items-center justify-center gap-1.5 hover:bg-white/10 transition-all active:scale-95"
                  >
                    <HelpCircle size={11} /> {t('qa_help')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Idle Mode ─────────────────────────────────────────── */
          <div className="rounded-2xl border border-white/8 bg-surface-dark50 p-4 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 animate-float mb-0.5">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-200">{t('ready_to_help')}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                {t('navigate_prompt')}
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['LinkedIn', 'Workday', 'Greenhouse', 'Lever', 'Internshala'].map(p => (
                <span key={p} className="chip-muted">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Weekly Stats ──────────────────────────────────────── */}
        <div>
          <div className="section-label mb-2.5">{t('this_week')}</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: t('applied'),   value: stats.applied,   color: 'text-blue-400' },
              { label: t('interview'), value: stats.interview, color: 'text-purple-400' },
              { label: t('offer'),     value: stats.offer,     color: 'text-emerald-400' },
              { label: t('saved'),     value: stats.saved,     color: 'text-gray-400' },
            ].map(s => (
              <div key={s.label} className="bg-surface-dark50 border border-white/6 rounded-2xl p-2 text-center flex flex-col justify-center items-center aspect-square shadow-sm min-w-0">
                <div className={`text-xl font-black ${s.color} leading-none`}>{s.value}</div>
                <div className="text-[8px] text-gray-500 font-bold uppercase tracking-wider mt-1.5 truncate w-full">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Activity ───────────────────────────────────── */}
        {recentApps.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="section-label">{t('recent_activity')}</div>
              <button
                onClick={() => onNavigate('tracker')}
                className="text-[10px] text-brand-400 font-semibold hover:text-brand-300 transition-colors"
              >
                {t('view_all')}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {recentApps.map(app => (
                <div key={app.id} className="flex items-center gap-3 bg-surface-dark50 border border-white/6 rounded-xl px-3.5 py-2.5 hover:border-white/12 transition-all">
                  <div className="flex-1 overflow-hidden">
                    <div className="text-sm font-semibold text-gray-200 truncate">{app.company}</div>
                    <div className="text-xs text-gray-500 truncate">{app.role}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${STATUS_COLORS[app.status] || 'text-gray-500'}`}>
                      {t(app.status)}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-0.5">
                      {new Date(app.appliedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────── */}
        {stats.total === 0 && !tabContext?.isJobPage && (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-400 mb-0.5">
              <Compass size={28} className="animate-pulse" />
            </div>
            <div className="text-sm font-bold text-gray-300">{t('start_job_hunt')}</div>
            <div className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
              {t('visit_job_board_desc')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
