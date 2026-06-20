import React from 'react';

interface PremiumGateProps {
  feature: string;
  description?: string;
  children: React.ReactNode;
  isPremium: boolean;
  /** If true, shows the lock overlay over blurred content. Default: true */
  blurContent?: boolean;
}

export default function PremiumGate({ feature, description, children, isPremium, blurContent = true }: PremiumGateProps) {
  if (isPremium) return <>{children}</>;

  return (
    <div className="relative">
      {blurContent && (
        <div className="select-none pointer-events-none blur-sm opacity-60">
          {children}
        </div>
      )}
      <div className={`${blurContent ? 'absolute inset-0' : ''} flex flex-col items-center justify-center p-4`}>
        <div className="gradient-premium-subtle rounded-2xl p-4 text-center max-w-[240px] mx-auto border">
          <div className="text-2xl mb-2">✨</div>
          <div className="text-sm font-bold text-gray-100 mb-1">{feature}</div>
          {description && (
            <p className="text-xs text-gray-400 font-medium leading-relaxed mb-3">{description}</p>
          )}
          <button
            onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })}
            className="w-full gradient-premium text-white text-xs font-bold py-2 px-4 rounded-xl hover:opacity-90 transition-opacity"
          >
            Unlock Pro
          </button>
          <button
            className="text-[10px] text-gray-600 mt-2 hover:text-gray-400 transition-colors"
            onClick={() => {}}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
