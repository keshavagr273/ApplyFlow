import React from 'react';
import {
  Home,
  Bot,
  User,
  ClipboardCheck,
  BarChart3,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';
import { Screen } from '../../../shared/types';
import { useStore } from '../../../shared/store';

const NAV_ITEMS: Array<{ id: Screen; icon: React.ComponentType<any>; label: string }> = [
  { id: 'dashboard', icon: Home, label: 'Dashboard' },
  { id: 'assistant', icon: Bot, label: 'AI Copilot' },
  { id: 'profile', icon: User, label: 'Profile' },
  { id: 'tracker', icon: ClipboardCheck, label: 'Tracker' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
];

interface SideNavProps {
  active: Screen;
  onChange: (screen: Screen) => void;
}

export default function SideNav({ active, onChange }: SideNavProps) {
  const { settings, billing } = useStore();
  const activeIndex = NAV_ITEMS.findIndex(item => item.id === active);

  return (
    <nav className="w-[64px] flex flex-col items-center bg-white border-r border-slate-200/60 py-4 gap-2 shrink-0 h-full select-none sp-nav">
      {/* Brand Logo */}
      <div className="mb-4 flex flex-col items-center shrink-0">
        <img
          src={chrome.runtime.getURL('icons/icon128.png')}
          alt="ApplyFlow Logo"
          className="w-9 h-9 object-contain"
        />
      </div>

      {/* Nav Items */}
      <div className="flex flex-col gap-1.5 w-full items-center relative">
        {/* Sliding Active Indicator Line */}
        {activeIndex !== -1 && (
          <div
            className="absolute left-0 w-0.5 h-4 bg-brand-500 rounded-r-full transition-all duration-200 ease-out pointer-events-none"
            style={{
              transform: `translateY(${activeIndex * 50 + 14}px)`,
            }}
          />
        )}
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            icon={item.icon}
            label={item.label}
            active={active === item.id}
            onClick={() => onChange(item.id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings & Premium Section */}
      <div className="flex flex-col gap-3 w-full items-center shrink-0">
        {/* Remaining Credits */}
        {billing && (
          <div className="flex flex-col items-center gap-0.5" title={`${(billing.creditsAllocated + billing.creditsPurchased) - billing.creditsUsed} credits left`}>
            <span className="text-[10px] font-black text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full select-none leading-none">
              {Math.max(0, (billing.creditsAllocated + billing.creditsPurchased) - billing.creditsUsed)}
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider leading-none">Credits</span>
          </div>
        )}

        {/* Premium Upgrade Button */}
        {!settings?.isPremium && (
          <button
            onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' })}
            className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_12px_rgba(74,108,247,0.2)] group relative"
            title="Upgrade to Pro"
          >
            <Sparkles
              size={18}
              className="text-white group-hover:animate-pulse transition-transform"
            />
            {/* Pulsing Outer Glow */}
            <div className="absolute inset-0 rounded-xl bg-brand-500 opacity-20 blur-sm group-hover:opacity-40 transition-opacity -z-10" />
          </button>
        )}
      </div>
    </nav>
  );
}

function NavItem({ id, icon: Icon, label, active, onClick }: {
  id: Screen; icon: React.ComponentType<any>; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        relative w-11 h-11 flex flex-col items-center justify-center rounded-xl border transition-all duration-200 group
        ${active
          ? 'bg-brand-600/10 text-brand-600 border-brand-500/20 shadow-sm'
          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-transparent bg-transparent'
        }
      `}
    >
      <Icon
        size={18}
        className={`${active ? 'text-brand-600' : 'text-slate-400 group-hover:scale-110 transition-transform duration-200'}`}
      />
    </button>
  );
}
