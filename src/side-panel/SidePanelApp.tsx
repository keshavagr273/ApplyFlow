import React, { useEffect, useState, useCallback } from 'react';
import { useStore } from '../shared/store';
import { Screen, TabContext } from '../shared/types';
import { isJobPage, detectPlatformFromUrl } from '../shared/platformUtils';

import Dashboard from './screens/Dashboard.tsx';
import AIAssistant from './screens/AIAssistant.tsx';
import Profile from './screens/Profile.tsx';
import Tracker from './screens/Tracker.tsx';
import Analytics from './screens/Analytics.tsx';
import SideNav from './components/nav/SideNav.tsx';
import ToastStack from './components/common/ToastStack.tsx';

import AuthGate from './components/common/AuthGate.tsx';

export default function SidePanelApp() {
  const [activeScreen, setActiveScreen] = useState<Screen>('dashboard');
  const { loadData, loadChatSessions, setTabContext, showToast, settings, updateSettings, syncFromCloud } = useStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ── Google Authentication Handlers ─────────────────────────────────────────
  const handleGoogleLogin = useCallback(() => {
    setIsLoggingIn(true);

    const performUserFetch = async (token: string) => {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          const user = await res.json();
          await updateSettings({
            userEmail: user.email,
            userDisplayName: user.name,
            userAvatar: user.picture
          });
          await syncFromCloud();
          showToast(`Welcome back, ${user.name}!`, 'success');
        }
      } catch (err) {
        console.error("Failed to load user info:", err);
        showToast("Failed to fetch Google user profile info.", 'error');
      } finally {
        setIsLoggingIn(false);
      }
    };

    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.getAuthToken) {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        const actualToken = (typeof token === 'string' ? token : (token as any)?.token) || '';
        if (chrome.runtime.lastError || !actualToken) {
          console.error("GCP OAuth Error:", chrome.runtime.lastError);
          showToast(`OAuth Login Failed: ${chrome.runtime.lastError?.message || 'Empty Token'}`, 'error');
          setIsLoggingIn(false);
          return;
        }
        await performUserFetch(actualToken);
      });
    } else if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.launchWebAuthFlow) {
      const clientId = "106618788934-7jo01eofmkp9pe73selaanlko4r6ickl.apps.googleusercontent.com";
      const redirectUri = chrome.identity.getRedirectURL();
      const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}`;

      chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      }, async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          console.error("GCP OAuth Error:", chrome.runtime.lastError);
          showToast(`OAuth Login Failed: ${chrome.runtime.lastError?.message || 'Redirect URL empty'}`, 'error');
          setIsLoggingIn(false);
          return;
        }

        try {
          const urlObj = new URL(redirectUrl);
          const params = new URLSearchParams(urlObj.hash.substring(1));
          const token = params.get('access_token');
          if (!token) {
            showToast("Failed to fetch access token from redirect.", 'error');
            setIsLoggingIn(false);
            return;
          }
          await performUserFetch(token);
        } catch (err: any) {
          console.error("OAuth parse error:", err);
          showToast("Failed to parse authentication redirect.", 'error');
          setIsLoggingIn(false);
        }
      });
    } else {
      showToast("Authentication is not supported on this platform.", 'error');
      setIsLoggingIn(false);
    }
  }, [updateSettings, syncFromCloud, showToast]);

  const handleGoogleLogout = useCallback(() => {
    if (!confirm("Are you sure you want to sign out?")) return;
    const performSignOut = async () => {
      await updateSettings({
        userEmail: undefined,
        userDisplayName: undefined,
        userAvatar: undefined
      });
      showToast("Signed out successfully.", 'success');
    };

    if (typeof chrome !== 'undefined' && chrome.identity && chrome.identity.clearAllCachedAuthTokens) {
      chrome.identity.clearAllCachedAuthTokens(async () => {
        await performSignOut();
      });
    } else {
      performSignOut();
    }
  }, [updateSettings, showToast]);

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
    loadChatSessions();
  }, [loadData, loadChatSessions]);

  // ── Side Panel Lifecycle & Toggle Close ──────────────────────────────────
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'SIDE_PANEL_MOUNTED' }).catch(() => {});

    const handleUnload = () => {
      chrome.runtime.sendMessage({ type: 'SIDE_PANEL_UNMOUNTED' }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleUnload);

    const handleMessage = (msg: any) => {
      if (msg.type === 'CLOSE_SIDE_PANEL') {
        window.close();
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      chrome.runtime.onMessage.removeListener(handleMessage);
      handleUnload();
    };
  }, []);

  // ── Tab context detection ─────────────────────────────────────────────────
  const refreshTabContext = useCallback(() => {
    const handleTabs = (tabs: chrome.tabs.Tab[]) => {
      const tab = tabs[0];
      if (!tab?.url) return;

      const url = tab.url;
      const platform = detectPlatformFromUrl(url);
      const onJobPage = isJobPage(url);

      if (onJobPage) {
        // Inject scanner to get job info from the page
        chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: () => {
            const url = window.location.href;
            const u = url.toLowerCase();
            let role = '';
            let company = '';
            let description = '';

            // JSON-LD Extraction first
            try {
              const scripts = document.querySelectorAll('script[type="application/ld+json"]');
              for (const script of Array.from(scripts)) {
                const text = script.textContent?.trim();
                if (!text) continue;
                try {
                  const parsed = JSON.parse(text);
                  const findJobPosting = (obj: any): any => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj['@type'] === 'JobPosting' || (Array.isArray(obj['@type']) && obj['@type'].includes('JobPosting'))) {
                      return obj;
                    }
                    if (Array.isArray(obj)) {
                      for (const item of obj) {
                        const res = findJobPosting(item);
                        if (res) return res;
                      }
                    }
                    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
                      return findJobPosting(obj['@graph']);
                    }
                    return null;
                  };
                  const jobObj = findJobPosting(parsed);
                  if (jobObj) {
                    role = jobObj.title || '';
                    if (typeof jobObj.hiringOrganization === 'object' && jobObj.hiringOrganization) {
                      company = jobObj.hiringOrganization.name || '';
                    } else if (typeof jobObj.hiringOrganization === 'string') {
                      company = jobObj.hiringOrganization;
                    }
                    description = jobObj.description || '';
                    if (description) {
                      const tempDiv = document.createElement('div');
                      tempDiv.innerHTML = description;
                      description = tempDiv.innerText || tempDiv.textContent || description;
                    }
                    if (role || company) break;
                  }
                } catch (e) {}
              }
            } catch (err) {}

            // LinkedIn
            if (u.includes('linkedin.com')) {
              if (!role) {
                const titleSelectors = [
                  '.job-details-jobs-unified-top-card__job-title h1',
                  '.job-details-jobs-unified-top-card__title-container h2',
                  '.job-details-jobs-unified-top-card__job-title',
                  '.jobs-unified-top-card__job-title',
                  '.t-24'
                ];
                for (const sel of titleSelectors) {
                  role = document.querySelector<HTMLElement>(sel)?.innerText?.trim() || '';
                  if (role) break;
                }
              }
              if (!company) {
                const companySelectors = [
                  '.job-details-jobs-unified-top-card__company-name a',
                  '.job-details-jobs-unified-top-card__company-name',
                  '.jobs-unified-top-card__company-name-link a',
                  '.jobs-unified-top-card__company-name',
                  '.jobs-unified-top-card__company-name-link'
                ];
                for (const sel of companySelectors) {
                  company = document.querySelector<HTMLElement>(sel)?.innerText?.trim() || '';
                  if (company) break;
                }
              }
              if (!description) {
                const descSelectors = [
                  '.jobs-description-content__text',
                  '.jobs-description__container',
                  '.jobs-box__html-content',
                  '#job-details'
                ];
                for (const sel of descSelectors) {
                  description = document.querySelector<HTMLElement>(sel)?.innerText?.trim() || '';
                  if (description) break;
                }
              }
            }
            // Internshala
            else if (u.includes('internshala.com')) {
              // 1. Try to find the application form modal elements first
              const modalForm = document.querySelector('#application_form, #application_form_container, .modal-content, .popup_container');
              const formHeading = document.querySelector<HTMLElement>('.profile_heading');

              if (formHeading) {
                let text = formHeading.innerText?.trim() || '';
                if (text.toLowerCase().startsWith('application for')) {
                  text = text.replace(/application for/i, '').trim();
                }
                role = text;
                company = document.querySelector<HTMLElement>('.company_name, .company-name, #company_name')?.innerText?.trim() || '';
              } else if (modalForm) {
                const headingEl = modalForm.querySelector<HTMLElement>('.profile_heading, .profile, .heading_3, h1, h2, h3');
                if (headingEl) {
                  let text = headingEl.innerText?.trim() || '';
                  if (text.toLowerCase().startsWith('application for')) {
                    text = text.replace(/application for/i, '').trim();
                  }
                  role = text;
                }
                company = modalForm.querySelector<HTMLElement>('.company_name, .company-name, [class*="company" i]')?.innerText?.trim() || '';
              }

              // 2. If not found, look for listing or detail page elements
              if (!role) {
                role = document.querySelector<HTMLElement>('.internship-heading h1, .profile h3')?.innerText?.trim() || '';
              }
              if (!company) {
                company = document.querySelector<HTMLElement>('.company-name a, .heading_6.company_name')?.innerText?.trim() || '';
              }

              if (modalForm) {
                description = modalForm.querySelector<HTMLElement>('.internship-details-container, #about_company, .job_description, .description_container')?.innerText?.trim() || '';
              }
              if (!description) {
                description = document.querySelector<HTMLElement>('.internship-details-container, #about_company, .job_description, .description_container')?.innerText?.trim() || '';
              }
            }
            // Unstop
            else if (u.includes('unstop.com')) {
              role = document.querySelector<HTMLElement>('h1.opportunity-title, h1')?.innerText?.trim() || '';
              company = document.querySelector<HTMLElement>('.company-name, .employer-name')?.innerText?.trim() || '';
              description = document.querySelector<HTMLElement>('.opportunity-details, .description-content')?.innerText?.trim() || '';
            }
            // Greenhouse
            else if (u.includes('greenhouse.io') || u.includes('grnh.se')) {
              role = document.querySelector<HTMLElement>('h1.app-title, h1')?.innerText?.trim() || '';
              company = document.querySelector<HTMLElement>('.company-name')?.innerText?.trim() || '';
              description = document.querySelector<HTMLElement>('#content, .job-post-body')?.innerText?.trim() || '';
            }
            // Lever
            else if (u.includes('lever.co')) {
              role = document.querySelector<HTMLElement>('.posting-headline h2, h2')?.innerText?.trim() || '';
              company = document.querySelector<HTMLElement>('.posting-headline .sort-by-team, title')?.innerText?.split(' - ')[1] || '';
              description = document.querySelector<HTMLElement>('.posting-description')?.innerText?.trim() || '';
            }
            // Workday
            else if (u.includes('myworkdayjobs.com')) {
              role = document.querySelector<HTMLElement>('[data-automation-id="jobPostingHeader"], h1')?.innerText?.trim() || '';
              company = document.title.split(' - ').pop()?.trim() || '';
              description = document.querySelector<HTMLElement>('[data-automation-id="jobPostingDescription"]')?.innerText?.trim() || '';
            }

            // Generic fallbacks
            if (!role) role = document.querySelector<HTMLElement>('h1')?.innerText?.trim() || document.title.split(' - ')[0].trim();
            if (!company) {
              const metaCompany = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"], meta[name="author"]');
              company = metaCompany?.content || document.querySelector<HTMLElement>('[class*="company" i], [class*="employer" i]')?.innerText?.trim() || '';
            }
            if (!description) {
              const textBlocks = Array.from(document.querySelectorAll<HTMLElement>('p, li, [class*="description" i], [class*="requirement" i]'));
              description = textBlocks
                .map(el => el.innerText?.trim() || '')
                .filter(t => t.length > 60)
                .slice(0, 10)
                .join('\n\n');
            }

            // Clean up
            company = company.split('\n')[0].replace(/•.*/, '').trim().substring(0, 100);
            role = role.split('\n')[0].trim().substring(0, 100);

            return { role, company, description };
          }
        }).then(results => {
          const info = results?.[0]?.result as { role: string; company: string; description: string } | null;
          const ctx: TabContext = {
            url,
            title: tab.title || '',
            platform,
            isJobPage: true,
            company: info?.company || '',
            role: info?.role || tab.title?.split(' | ')[0] || '',
            jobDescription: info?.description || ''
          };
          setTabContext(ctx);
        }).catch(() => {
          setTabContext({ url, title: tab.title || '', platform, isJobPage: true, company: '', role: '', jobDescription: '' });
        });
      } else {
        setTabContext({ url, title: tab.title || '', platform: 'other', isJobPage: false, company: '', role: '', jobDescription: '' });
      }
    };

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        chrome.tabs.query({ active: true, currentWindow: true }, (fallbackTabs) => {
          handleTabs(fallbackTabs);
        });
      } else {
        handleTabs(tabs);
      }
    });
  }, [setTabContext]);

  useEffect(() => {
    refreshTabContext();

    // Listen for tab changes
    const handleTabActivated = () => refreshTabContext();
    const handleTabUpdated = (_: number, changeInfo: any) => {
      if (changeInfo.status === 'complete') refreshTabContext();
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    // Listen for storage changes (stay in sync with popup/widget writes)
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.applications || changes.profile || changes.settings) {
        loadData();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Auto-navigate to dashboard when a job page is detected (once)
    const handleMessage = (msg: any) => {
      if (msg.type === 'JOB_PAGE_DETECTED') {
        setActiveScreen('dashboard');
      }
      if (msg.type === 'JOB_CLIPPED') {
        loadData();
        showToast('Job saved to tracker!', 'success');
      }
      if (msg.type === 'JOB_CONTEXT_UPDATED') {
        const { url, platform, company, role, jobDescription } = msg.payload;
        setTabContext({
          url,
          title: '',
          platform,
          isJobPage: true,
          company,
          role,
          jobDescription
        });
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [refreshTabContext, loadData, showToast]);

  const renderScreen = () => {
    if (!settings?.userEmail) {
      return <AuthGate onLogin={handleGoogleLogin} isLoggingIn={isLoggingIn} />;
    }

    switch (activeScreen) {
      case 'dashboard':  return <Dashboard onNavigate={setActiveScreen} />;
      case 'assistant':  return <AIAssistant />;
      case 'profile':    return <Profile />;
      case 'tracker':    return <Tracker />;
      case 'analytics':  return <Analytics />;
      default:           return <Dashboard onNavigate={setActiveScreen} />;
    }
  };

  const theme = 'light';
  return (
    <div className={`sp-root flex flex-row w-full h-screen overflow-hidden ${theme}`}>
      {/* Left nav rail */}
      <SideNav active={activeScreen} onChange={setActiveScreen} />

      {/* Main content area */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {renderScreen()}
        </div>
        <SidePanelFooter
          isLoggingIn={isLoggingIn}
          onLogin={handleGoogleLogin}
          onLogout={handleGoogleLogout}
        />
      </main>

      <ToastStack />
    </div>
  );
}

interface SidePanelFooterProps {
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

function SidePanelFooter({ isLoggingIn, onLogin, onLogout }: SidePanelFooterProps) {
  const { settings } = useStore();
  const displayName = settings?.userDisplayName || 'Guest';
  const avatar = settings?.userAvatar;

  return (
    <footer className="h-10 border-t border-slate-200/60 bg-white px-4 flex items-center justify-between text-xs text-slate-500 shrink-0 select-none">
      <div className="flex items-center gap-2 min-w-0">
        {avatar ? (
          <img src={avatar} alt="Avatar" className="w-5 h-5 rounded-full border border-slate-200 shrink-0" />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
            {displayName[0].toUpperCase()}
          </div>
        )}
        <span className="truncate">
          Logged in as <strong className="text-slate-800">{displayName}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {settings?.userEmail ? (
          <button 
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-0.5 rounded text-[9px] transition-all flex items-center gap-1.5 shadow-sm"
          >
            Sign Out
          </button>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-2.5 py-0.5 rounded text-[9px] transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isLoggingIn && (
              <span className="w-1.5 h-1.5 rounded-full border border-white/30 border-t-white animate-spin shrink-0" />
            )}
            <span>{isLoggingIn ? 'Connecting...' : 'Sign In'}</span>
          </button>
        )}
      </div>
    </footer>
  );
}
