import React from 'react';
import { t } from '../../../shared/i18n';

interface AuthGateProps {
  onLogin: () => void;
  isLoggingIn: boolean;
}

export default function AuthGate({ onLogin, isLoggingIn }: AuthGateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 overflow-y-auto">
      <div className="w-full max-w-[320px] animate-scale-in flex flex-col items-center">
        {/* Floating Icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-3xl animate-float">
            🔒
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold text-white shadow-lg animate-pulse">
            ✨
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {t('unlock_title')}
        </h2>
        
        {/* Subtitle */}
        <p className="text-xs text-slate-500 leading-relaxed mb-6 px-2">
          {t('unlock_desc')}
        </p>

        {/* Feature List */}
        <div className="w-full bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 mb-6 text-left space-y-3">
          <div className="flex items-start gap-2.5">
            <span className="text-emerald-600 text-xs mt-0.5">✓</span>
            <div>
              <div className="text-[11px] font-bold text-slate-800">{t('feature_ai_title')}</div>
              <div className="text-[10px] text-slate-500">{t('feature_ai_desc')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-emerald-600 text-xs mt-0.5">✓</span>
            <div>
              <div className="text-[11px] font-bold text-slate-800">{t('feature_cloud_title')}</div>
              <div className="text-[10px] text-slate-500">{t('feature_cloud_desc')}</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-emerald-600 text-xs mt-0.5">✓</span>
            <div>
              <div className="text-[11px] font-bold text-slate-800">{t('feature_resume_title')}</div>
              <div className="text-[10px] text-slate-500">{t('feature_resume_desc')}</div>
            </div>
          </div>
        </div>

        {/* Sign In Button */}
        <button
          onClick={onLogin}
          disabled={isLoggingIn}
          className="w-full gradient-premium text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-brand-500/10 hover:shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none text-xs"
        >
          {isLoggingIn ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>{t('connecting_google')}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.615 4.45 1.635l2.45-2.45C17.265 1.55 14.95 0 12.24 0 6.03 0 1 5.03 1 11s5.03 11 11.24 11c6.48 0 10.79-4.56 10.79-11 0-.74-.065-1.3-.18-1.715H12.24z" />
              </svg>
              <span>{t('sign_in_google')}</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-gray-500 mt-4 leading-normal">
          {t('agree_sync_footer')}
        </p>
      </div>
    </div>
  );
}
