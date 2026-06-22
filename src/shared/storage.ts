import { UserProfile, Application, AIServiceSettings, UsageStats, UserBilling, SubscriptionPlan, ParsedResume } from './types';

let writeLock = Promise.resolve();

async function enqueueWrite(operation: () => Promise<void>): Promise<void> {
  const currentLock = writeLock;
  writeLock = (async () => {
    try { await currentLock; } catch { /* ignore */ }
    await operation();
  })();
  return writeLock;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AIServiceSettings = {
  // SECURITY: Never use hardcoded fallback API keys. If the env var is absent,
  // the feature is disabled until the user enters their own key in Settings.
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  demoMode: false,
  enableOverlay: true,
  autofillMode: 'ats-first',
  logOnlyAfterSubmission: false,
  showClipButton: true,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: '',
  supabaseSyncEnabled: false,
  isPremium: false,
  licenseKey: '',
  theme: 'light'
};

// ─── Supabase REST Helper ─────────────────────────────────────────────────────

async function callSupabase(settings: AIServiceSettings, table: string, method: string, body?: Record<string, unknown>): Promise<unknown> {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
  const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}`;
  const headers: Record<string, string> = {
    'apikey': settings.supabaseAnonKey,
    'Authorization': `Bearer ${settings.supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      console.warn(`Supabase ${table} sync failed: ${response.status} ${response.statusText}`);
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : true;
  } catch (err) {
    console.error(`Error syncing with Supabase ${table}:`, err);
    return null;
  }
}

// ─── Storage API ─────────────────────────────────────────────────────────────

export const Storage = {
  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings: (): Promise<AIServiceSettings> =>
    chrome.storage.local.get('settings').then((r) => {
      const s = { ...DEFAULT_SETTINGS, ...((r.settings as Partial<AIServiceSettings>) || {}) };
      // Env vars always win over stored values (never hardcoded fallbacks)
      if (import.meta.env.VITE_SUPABASE_URL) s.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (import.meta.env.VITE_GEMINI_API_KEY) s.geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      s.demoMode = false;
      s.supabaseSyncEnabled = s.isPremium ? !!s.userEmail : false;
      return s;
    }),

  setSettings: (s: Partial<AIServiceSettings>): Promise<void> =>
    enqueueWrite(async () => {
      const current = await Storage.getSettings();
      const newSettings = { ...current, ...s };
      newSettings.supabaseSyncEnabled = newSettings.isPremium ? !!newSettings.userEmail : false;
      await chrome.storage.local.set({ settings: newSettings });
    }),

  // ── Profile ───────────────────────────────────────────────────────────────

  getProfile: (): Promise<UserProfile | null> =>
    chrome.storage.local.get('profile').then((r) => (r.profile as UserProfile) ?? null),

  setProfile: (p: UserProfile): Promise<void> =>
    enqueueWrite(async () => {
      await chrome.storage.local.set({ profile: p });
      const settings = await Storage.getSettings();
      if (settings.supabaseSyncEnabled) {
        await callSupabase(settings, 'profile', 'POST', {
          id: settings.userEmail || 'anonymous_profile', ...p
        });
      }
    }),

  // ── Applications ──────────────────────────────────────────────────────────

  getApplications: (): Promise<Application[]> =>
    chrome.storage.local.get('applications').then((r) => (r.applications as Application[]) ?? []),

  setApplications: (apps: Application[]): Promise<void> =>
    enqueueWrite(async () => {
      await chrome.storage.local.set({ applications: apps });
    }),

  addApplication: (app: Application): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      // Prevent duplicate URLs for 'applied' status
      const existing = apps.find(a => a.url === app.url && a.status === 'applied');
      if (existing && app.status === 'applied') {
        console.log('Duplicate application detected, skipping.');
        return;
      }
      const newApps = [app, ...apps];
      await chrome.storage.local.set({ applications: newApps });
      const settings = await Storage.getSettings();
      if (settings.supabaseSyncEnabled) {
        await callSupabase(settings, 'applications', 'POST', {
          ...app, user_email: settings.userEmail || 'anonymous'
        });
      }
    }),

  updateApplication: (id: string, updates: Partial<Application>): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      const updatedApps = apps.map(a => a.id === id ? { ...a, ...updates } : a);
      await chrome.storage.local.set({ applications: updatedApps });
      const settings = await Storage.getSettings();
      if (settings.supabaseSyncEnabled) {
        const appToUpdate = updatedApps.find(a => a.id === id);
        if (appToUpdate) {
          await callSupabase(settings, 'applications', 'POST', {
            ...appToUpdate, user_email: settings.userEmail || 'anonymous'
          });
        }
      }
    }),

  deleteApplication: (id: string): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      await chrome.storage.local.set({ applications: apps.filter(a => a.id !== id) });
      const settings = await Storage.getSettings();
      if (settings.supabaseSyncEnabled) {
        const email = settings.userEmail || 'anonymous';
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/applications?id=eq.${id}&user_email=eq.${encodeURIComponent(email)}`;
        try {
          await fetch(url, {
            method: 'DELETE',
            headers: {
              'apikey': settings.supabaseAnonKey,
              'Authorization': `Bearer ${settings.supabaseAnonKey}`
            }
          });
        } catch (err) {
          console.error('Error deleting remote application:', err);
        }
      }
    }),


  // ── Cloud Sync ────────────────────────────────────────────────────────────

  syncAllToCloud: async (): Promise<boolean> => {
    const settings = await Storage.getSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return false;
    const profile = await Storage.getProfile();
    const apps = await Storage.getApplications();
    let success = true;
    if (profile) {
      const res = await callSupabase(settings, 'profile', 'POST', {
        id: settings.userEmail || 'anonymous_profile', ...profile
      });
      if (!res) success = false;
    }
    for (const app of apps) {
      const res = await callSupabase(settings, 'applications', 'POST', {
        ...app, user_email: settings.userEmail || 'anonymous'
      });
      if (!res) success = false;
    }
    return success;
  },

  syncAllFromCloud: async (): Promise<{ profile: UserProfile | null, applications: Application[] } | null> => {
    const settings = await Storage.getSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
    try {
      const headers = {
        'apikey': settings.supabaseAnonKey,
        'Authorization': `Bearer ${settings.supabaseAnonKey}`
      };
      const email = settings.userEmail || 'anonymous';
      const profileEmail = settings.userEmail || 'anonymous_profile';
      const profRes = await fetch(
        `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/profile?id=eq.${encodeURIComponent(profileEmail)}`,
        { headers }
      );
      let profile: UserProfile | null = null;
      if (profRes.ok) {
        const data = await profRes.json();
        if (data?.[0]) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: _id, ...cleanProfile } = data[0];
          profile = cleanProfile as UserProfile;
          await chrome.storage.local.set({ profile });
        }
      }
      const appsRes = await fetch(
        `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/applications?user_email=eq.${encodeURIComponent(email)}&order=appliedAt.desc`,
        { headers }
      );
      let applications: Application[] = [];
      if (appsRes.ok) {
        applications = await appsRes.json();
        await chrome.storage.local.set({ applications });
      }
      return { profile, applications };
    } catch (err) {
      console.error('Error pulling from Supabase:', err);
      return null;
    }
  },

  // ── User Billing & Credits ──────────────────────────────────────────────────

  getUserBilling: async (): Promise<UserBilling> => {
    const settings = await Storage.getSettings();
    const res = await chrome.storage.local.get('billing');
    
    let plan: SubscriptionPlan = 'free';
    let allocated = 10; // Free trial
    
    if (settings.isPremium) {
      // SECURITY: License tier is determined server-side. Do not compare against
      // a plaintext hardcoded key. Premium users get the pro tier by default.
      plan = 'pro_monthly';
      allocated = 150;
    }

    const defaultBilling: UserBilling = {
      userEmail: settings.userEmail || 'anonymous_profile',
      plan,
      creditsAllocated: allocated,
      creditsUsed: 0,
      creditsPurchased: 0,
      premiumUntil: settings.isPremium ? Date.now() + 365 * 24 * 60 * 60 * 1000 : null,
      subscriptionStatus: 'active'
    };

    let billing = { ...defaultBilling, ...((res.billing as Partial<UserBilling>) || {}) } as UserBilling;
    
    // Always sync the plan and allocation if isPremium status changed
    billing.plan = plan;
    billing.creditsAllocated = allocated;
    if (settings.isPremium) {
      billing.premiumUntil = billing.premiumUntil || (Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else {
      billing.premiumUntil = null;
    }

    if (settings.supabaseSyncEnabled && settings.supabaseUrl && settings.supabaseAnonKey) {
      try {
        const headers = {
          'apikey': settings.supabaseAnonKey,
          'Authorization': `Bearer ${settings.supabaseAnonKey}`
        };
        const email = settings.userEmail || 'anonymous';
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/user_billing?user_email=eq.${encodeURIComponent(email)}`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          const data = await response.json();
          if (data?.[0]) {
            billing = {
              userEmail: data[0].user_email,
              plan: data[0].plan,
              creditsAllocated: data[0].credits_allocated,
              creditsUsed: data[0].credits_used,
              creditsPurchased: data[0].credits_purchased,
              premiumUntil: data[0].premium_until,
              subscriptionStatus: data[0].subscription_status
            };
            await chrome.storage.local.set({ billing });
          }
        }
      } catch (err) {
        console.error('Error fetching billing from Supabase:', err);
      }
    }

    return billing;
  },

  deductCredits: async (cost: number, feature: string): Promise<boolean> => {
    if (cost < 0) return false;  // Reject invalid negative cost
    if (cost === 0) return true; // Zero-cost operations are always allowed
    const settings = await Storage.getSettings();
    const billing = await Storage.getUserBilling();
    const remaining = (billing.creditsAllocated + billing.creditsPurchased) - billing.creditsUsed;

    if (remaining < cost) {
      return false;
    }

    if (settings.supabaseSyncEnabled && settings.supabaseUrl && settings.supabaseAnonKey) {
      try {
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rpc/atomic_deduct_credits`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': settings.supabaseAnonKey,
            'Authorization': `Bearer ${settings.supabaseAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_email: settings.userEmail || 'anonymous',
            p_cost: cost
          })
        });

        if (!response.ok) {
          console.warn('Supabase credit deduction failed');
          return false;
        }

        const success = await response.json();
        if (!success) {
          return false;
        }

        // Log transaction to Supabase
        await callSupabase(settings, 'credit_transactions', 'POST', {
          user_email: settings.userEmail || 'anonymous',
          feature,
          credits_deducted: cost,
          timestamp: Date.now()
        });

        // Update local cache
        billing.creditsUsed += cost;
        await chrome.storage.local.set({ billing });
        return true;
      } catch (err) {
        console.error('Error deducting credits from Supabase:', err);
        return false;
      }
    } else {
      // Local deduction
      billing.creditsUsed += cost;
      await chrome.storage.local.set({ billing });
      
      // Save local transaction
      const res = await chrome.storage.local.get('transactions');
      const transactions = (res.transactions as any[]) || [];
      transactions.push({
        id: crypto.randomUUID(),
        feature,
        credits_deducted: cost,
        timestamp: Date.now()
      });
      await chrome.storage.local.set({ transactions });
      return true;
    }
  },

  // ── Usage Stats ───────────────────────────────────────────────────────────

  getUsageStats: async (): Promise<UsageStats> => {
    const billing = await Storage.getUserBilling();
    const limit = 999999; // Unlimited daily autofills
    const DEFAULT_USAGE: UsageStats = {
      dailyFillsUsed: 0,
      dailyFillsLimit: limit,
      totalFills: 0,
      lastUsedTimestamp: Date.now(),
      creditsUsed: billing.creditsUsed,
      creditsAllocated: billing.creditsAllocated,
      creditsPurchased: billing.creditsPurchased
    };
    const res = await chrome.storage.local.get('usage');
    const usage = { ...DEFAULT_USAGE, ...((res.usage || {}) as Partial<UsageStats>) } as UsageStats;
    usage.dailyFillsLimit = limit;
    usage.creditsUsed = billing.creditsUsed;
    usage.creditsAllocated = billing.creditsAllocated;
    usage.creditsPurchased = billing.creditsPurchased;
    let lastDate: string;
    try {
      lastDate = new Date(usage.lastUsedTimestamp).toISOString().slice(0, 10);
    } catch {
      lastDate = new Date().toISOString().slice(0, 10);
    }
    const currentDate = new Date().toISOString().slice(0, 10);
    if (lastDate !== currentDate) {
      usage.dailyFillsUsed = 0;
      usage.lastUsedTimestamp = Date.now();
      await chrome.storage.local.set({ usage });
    }
    return usage;
  },

  incrementDailyUsage: async (): Promise<UsageStats> => {
    const usage = await Storage.getUsageStats();
    usage.dailyFillsUsed += 1;
    usage.totalFills = (usage.totalFills || 0) + 1;
    usage.lastUsedTimestamp = Date.now();
    await chrome.storage.local.set({ usage });
    return usage;
  },

  // ─── Resume History ────────────────────────────────────────────────────────
  getResumeHistory: (): Promise<ParsedResume[]> =>
    chrome.storage.local.get('resumeHistory').then((r) => (r.resumeHistory as ParsedResume[]) ?? []),

  addResumeToHistory: (filename: string, profileData: Partial<UserProfile>, resumeText: string): Promise<void> =>
    enqueueWrite(async () => {
      const history = await Storage.getResumeHistory();
      const newResume: ParsedResume = {
        id: crypto.randomUUID(),
        filename,
        parsedAt: Date.now(),
        profileData,
        resumeText
      };
      // Limit to 10 items to keep storage lightweight
      const updated = [newResume, ...history].slice(0, 10);
      await chrome.storage.local.set({ resumeHistory: updated });
    }),

  deleteResumeFromHistory: (id: string): Promise<void> =>
    enqueueWrite(async () => {
      const history = await Storage.getResumeHistory();
      const updated = history.filter(r => r.id !== id);
      await chrome.storage.local.set({ resumeHistory: updated });
    })
};
