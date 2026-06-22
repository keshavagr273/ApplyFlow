import React from 'react';
import { Section } from './Shared';
import { LogOut, CloudLightning, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useStore } from '../../shared/store';
import { AIServiceSettings } from '../../../src/shared/types';
import { t } from '../../shared/i18n';

export function SyncSettings({
  settings,
  handleGoogleLogin,
  handleGoogleLogout,
  isLoggingIn,
  isSyncing,
  syncStatus,
  handleSync
}: {
  settings: AIServiceSettings;
  handleGoogleLogin: () => void;
  handleGoogleLogout: () => void;
  isLoggingIn: boolean;
  isSyncing: boolean;
  syncStatus: string | null;
  handleSync: (dir: 'push' | 'pull') => void;
}) {
  const showToast = useStore(state => state.showToast);
  return (
    <Section title={t('google_account_sync_title')}>
      {settings.userEmail ? (
        <div className="flex flex-col gap-4">
          <div className="border border-slate-200 rounded-2xl p-5 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              {settings.userAvatar
                ? <img src={settings.userAvatar} alt="Avatar" className="w-14 h-14 rounded-full border border-slate-200" />
                : <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xl font-bold">{settings.userDisplayName?.charAt(0) || 'U'}</div>
              }
              <div>
                <h4 className="font-extrabold text-slate-800">{settings.userDisplayName}</h4>
                <p className="text-sm text-slate-500 font-semibold mt-0.5">{settings.userEmail}</p>
                {settings.isPremium ? (
                  <div className="inline-flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200 mt-2">
                    <CheckCircle2 size={10} /> {t('google_sync_active')}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200 mt-2">
                    {t('google_sync_locked')}
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleGoogleLogout}
              className="border border-red-200 text-red-600 hover:bg-red-50 rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 bg-white"
            >
              <LogOut size={14} /> {t('sign_out_btn')}
            </button>
          </div>

          <div className="flex flex-col gap-3 border border-slate-200/60 rounded-2xl p-5">
            <h3 className="font-bold text-slate-700">{t('cloud_sync_header')}</h3>
            <div className="flex gap-3">
              <button onClick={() => {
                if (!settings.isPremium) {
                  showToast(t('premium_sync_warning'), "warning");
                  return;
                }
                handleSync('push');
              }} disabled={isSyncing}
                className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-brand-800 transition disabled:opacity-50"
              >
                <CloudLightning size={14} className={isSyncing ? 'animate-bounce' : ''} /> {t('push_to_cloud_btn')}
              </button>
              <button onClick={() => {
                if (!settings.isPremium) {
                  showToast(t('premium_sync_warning'), "warning");
                  return;
                }
                handleSync('pull');
              }} disabled={isSyncing}
                className="flex-1 border border-slate-200 text-slate-700 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} /> {t('pull_from_cloud_btn')}
              </button>
            </div>
            {syncStatus === 'success' && (
              <div className="text-xs text-green-600 font-bold flex items-center gap-1 bg-green-50 rounded-xl px-3 py-2 border border-green-100">
                <CheckCircle2 size={12} /> {t('sync_success')}
              </div>
            )}
            {syncStatus === 'error' && (
              <div className="text-xs text-red-600 font-bold flex items-center gap-1 bg-red-50 rounded-xl px-3 py-2 border border-red-100">
                <AlertTriangle size={12} /> {t('sync_failed')}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 flex flex-col items-center gap-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
          <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-2xl">🔑</div>
          <div>
            <h3 className="font-bold text-slate-800">{t('secure_cloud_sync_title')}</h3>
            <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto mt-1 leading-normal">
              {t('secure_cloud_sync_desc')}
            </p>
          </div>
          <button onClick={handleGoogleLogin} disabled={isLoggingIn}
            className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow flex items-center gap-2"
          >
            {isLoggingIn ? <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-brand-600 animate-spin" /> : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
            )}
            {isLoggingIn ? t('connecting_btn') : t('sign_in_google')}
          </button>
        </div>
      )}
    </Section>
  );
}
