import { UserProfile, Application, AIServiceSettings, UsageStats, UserBilling, SubscriptionPlan, ParsedResume, ChatSession, ChatMessage } from './types';

let writeLock = Promise.resolve();

async function enqueueWrite(operation: () => Promise<void>): Promise<void> {
  const currentLock = writeLock;
  writeLock = (async () => {
    try { await currentLock; } catch { /* ignore */ }
    await operation();
  })();
  return writeLock;
}

// ─── Cache System ────────────────────────────────────────────────────────────

const storageCache: Record<string, any> = {};
let lastSyncTime = 0;
const SYNC_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AIServiceSettings = {
  geminiApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GROQ_API_KEY || '',
  demoMode: false,
  enableOverlay: true,
  autofillMode: 'ats-first',
  logOnlyAfterSubmission: false,
  showClipButton: true,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
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

// Background Sync Wrapper
const backgroundSync = async (table: string, payload: any) => {
  try {
    const settings = await Storage.getSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey || !settings.userEmail) return;
    await callSupabase(settings, table, 'POST', payload);
  } catch (e) {
    console.error(`Background sync failed for ${table}:`, e);
  }
};

// ─── Storage API ─────────────────────────────────────────────────────────────

export const Storage = {
  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings: (): Promise<AIServiceSettings> => {
    if (storageCache['settings']) {
      return Promise.resolve(storageCache['settings']);
    }
    return chrome.storage.local.get('settings').then((r) => {
      const s = { ...DEFAULT_SETTINGS, ...((r.settings as Partial<AIServiceSettings>) || {}) };
      // Env vars always win over stored values
      if (import.meta.env.VITE_SUPABASE_URL) s.supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (import.meta.env.VITE_SUPABASE_ANON_KEY) s.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const envKey = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_GROQ_API_KEY;
      if (envKey) s.geminiApiKey = envKey;
      s.demoMode = false;
      s.supabaseSyncEnabled = s.isPremium ? !!s.userEmail : false;
      storageCache['settings'] = s;
      return s;
    });
  },

  setSettings: (s: Partial<AIServiceSettings>): Promise<void> =>
    enqueueWrite(async () => {
      const current = await Storage.getSettings();
      const newSettings = { ...current, ...s };
      newSettings.supabaseSyncEnabled = newSettings.isPremium ? !!newSettings.userEmail : false;
      storageCache['settings'] = newSettings;
      await chrome.storage.local.set({ settings: newSettings });

      if (newSettings.userEmail) {
        // Sync Users Table
        const userPayload = {
          email: newSettings.userEmail,
          display_name: newSettings.userDisplayName || '',
          avatar_url: newSettings.userAvatar || '',
          theme: newSettings.theme || 'light',
          is_premium: newSettings.isPremium || false,
          created_at: new Date().toISOString()
        };
        callSupabase(newSettings, 'users', 'POST', userPayload).catch(()=>{});
        
        // Sync Settings Table
        const settingsPayload = {
          user_email: newSettings.userEmail,
          theme: newSettings.theme,
          autofill_mode: newSettings.autofillMode,
          enable_overlay: newSettings.enableOverlay,
          is_premium: newSettings.isPremium,
          updated_at: new Date().toISOString()
        };
        callSupabase(newSettings, 'settings', 'POST', settingsPayload).catch(()=>{});
      }
    }),

  // ── Profile ───────────────────────────────────────────────────────────────

  getProfile: (): Promise<UserProfile | null> => {
    if (storageCache['profile']) {
      return Promise.resolve(storageCache['profile']);
    }
    return chrome.storage.local.get('profile').then((r) => {
      const p = (r.profile as UserProfile) ?? null;
      if (p) storageCache['profile'] = p;
      return p;
    });
  },

  setProfile: (p: UserProfile): Promise<void> =>
    enqueueWrite(async () => {
      storageCache['profile'] = p;
      await chrome.storage.local.set({ profile: p });
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        backgroundSync('profiles', { user_email: settings.userEmail, ...p });
      }
    }),

  // ── Applications ──────────────────────────────────────────────────────────

  getApplications: (): Promise<Application[]> => {
    if (storageCache['applications']) {
      return Promise.resolve(storageCache['applications']);
    }
    return chrome.storage.local.get('applications').then((r) => {
      const apps = (r.applications as Application[]) ?? [];
      storageCache['applications'] = apps;
      return apps;
    });
  },

  setApplications: (apps: Application[]): Promise<void> =>
    enqueueWrite(async () => {
      storageCache['applications'] = apps;
      await chrome.storage.local.set({ applications: apps });
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        for (const app of apps) {
          backgroundSync('applications', { user_email: settings.userEmail, ...app });
        }
      }
    }),

  addApplication: (app: Application): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      // Prevent duplicate URLs for 'applied' status
      const existing = apps.find(a => a.url === app.url && a.status === 'applied');
      if (existing && app.status === 'applied') {
        return;
      }
      const newApps = [app, ...apps];
      storageCache['applications'] = newApps;
      await chrome.storage.local.set({ applications: newApps });
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        backgroundSync('applications', { user_email: settings.userEmail, ...app });
      }
    }),

  updateApplication: (id: string, updates: Partial<Application>): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      const updatedApps = apps.map(a => a.id === id ? { ...a, ...updates } : a);
      storageCache['applications'] = updatedApps;
      await chrome.storage.local.set({ applications: updatedApps });
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        const appToUpdate = updatedApps.find(a => a.id === id);
        if (appToUpdate) {
          backgroundSync('applications', { user_email: settings.userEmail, ...appToUpdate });
        }
      }
    }),

  deleteApplication: (id: string): Promise<void> =>
    enqueueWrite(async () => {
      const apps = await Storage.getApplications();
      const updated = apps.filter(a => a.id !== id);
      storageCache['applications'] = updated;
      await chrome.storage.local.set({ applications: updated });
      const settings = await Storage.getSettings();
      if (settings.userEmail && settings.supabaseUrl && settings.supabaseAnonKey) {
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/applications?id=eq.${id}&user_email=eq.${encodeURIComponent(settings.userEmail)}`;
        fetch(url, { method: 'DELETE', headers: { 'apikey': settings.supabaseAnonKey, 'Authorization': `Bearer ${settings.supabaseAnonKey}` } }).catch(()=>{});
      }
    }),

  // ── Auto Sync Pull (Startup) ──────────────────────────────────────────────

  syncAllFromCloud: async (force = false): Promise<boolean> => {
    const settings = await Storage.getSettings();
    if (!settings.supabaseUrl || !settings.supabaseAnonKey || !settings.userEmail) return false;
    
    // Throttling logic
    const now = Date.now();
    if (!force && (now - lastSyncTime < SYNC_THROTTLE_MS)) {
      console.log('Supabase syncAllFromCloud: Throttled (returning cached cache)');
      return true;
    }

    try {
      const headers = { 'apikey': settings.supabaseAnonKey, 'Authorization': `Bearer ${settings.supabaseAnonKey}` };
      const email = settings.userEmail;

      const fetchTable = async (table: string) => {
        const res = await fetch(`${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?user_email=eq.${encodeURIComponent(email)}`, { headers });
        return res.ok ? await res.json() : null;
      };

      const [profiles, apps, usages, resumes, chats] = await Promise.all([
        fetchTable('profiles'),
        fetchTable('applications'),
        fetchTable('usage'),
        fetchTable('resume_history'),
        fetchTable('chat_sessions')
      ]);

      if (profiles && profiles.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { user_email, ...p } = profiles[0];
        storageCache['profile'] = p;
        await chrome.storage.local.set({ profile: p });
      }
      if (apps) {
        storageCache['applications'] = apps;
        await chrome.storage.local.set({ applications: apps });
      }
      if (usages && usages.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { user_email, ...u } = usages[0];
        storageCache['usage'] = u;
        await chrome.storage.local.set({ usage: u });
      }
      if (resumes) {
        storageCache['resumeHistory'] = resumes;
        await chrome.storage.local.set({ resumeHistory: resumes });
      }
      if (chats) {
        storageCache['chatSessions'] = chats;
        await chrome.storage.local.set({ chatSessions: chats });
      }
      
      lastSyncTime = Date.now();
      return true;
    } catch (err) {
      console.error('Error pulling from Supabase:', err);
      return false;
    }
  },

  // ── User Billing & Credits ──────────────────────────────────────────────────

  getUserBilling: async (): Promise<UserBilling> => {
    const settings = await Storage.getSettings();
    
    if (storageCache['billing']) {
      return Promise.resolve(storageCache['billing']);
    }

    const res = await chrome.storage.local.get('billing');
    let plan: SubscriptionPlan = 'free';
    let allocated = 10;
    
    if (settings.isPremium) {
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
    billing.plan = plan;
    billing.creditsAllocated = allocated;
    if (settings.isPremium) {
      billing.premiumUntil = billing.premiumUntil || (Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else {
      billing.premiumUntil = null;
    }

    storageCache['billing'] = billing;
    await chrome.storage.local.set({ billing });
    return billing;
  },

  addTransaction: async (cost: number, description: string): Promise<boolean> => {
    const billing = await Storage.getUserBilling();
    if (billing.creditsUsed + cost > billing.creditsAllocated + billing.creditsPurchased && billing.plan !== 'ultimate_yearly') {
      return false;
    }
    
    billing.creditsUsed += cost;
    storageCache['billing'] = billing;
    await chrome.storage.local.set({ billing });
    
    const settings = await Storage.getSettings();
    if (settings.userEmail) {
      const payload = {
        id: crypto.randomUUID(),
        user_email: settings.userEmail,
        amount: 0,
        credits_added: -cost,
        timestamp: new Date().toISOString(),
        description
      };
      backgroundSync('transactions', payload);
    }
    return true;
  },

  // ── Usage Stats ───────────────────────────────────────────────────────────

  getUsageStats: async (): Promise<UsageStats> => {
    if (storageCache['usage']) {
      return Promise.resolve(storageCache['usage']);
    }

    const billing = await Storage.getUserBilling();
    const limit = 999999;
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
    storageCache['usage'] = usage;
    return usage;
  },

  incrementDailyUsage: async (): Promise<UsageStats> => {
    const usage = await Storage.getUsageStats();
    usage.dailyFillsUsed += 1;
    usage.totalFills = (usage.totalFills || 0) + 1;
    usage.lastUsedTimestamp = Date.now();
    storageCache['usage'] = usage;
    await chrome.storage.local.set({ usage });
    
    const settings = await Storage.getSettings();
    if (settings.userEmail) {
      backgroundSync('usage', { user_email: settings.userEmail, ...usage });
    }
    return usage;
  },

  deductCredits: async (cost: number, description: string): Promise<boolean> => {
    const billing = await Storage.getUserBilling();
    if (billing.creditsUsed + cost > billing.creditsAllocated + billing.creditsPurchased && billing.plan !== 'ultimate_yearly') {
      return false;
    }
    
    billing.creditsUsed += cost;
    storageCache['billing'] = billing;
    await chrome.storage.local.set({ billing });
    
    const settings = await Storage.getSettings();
    if (settings.userEmail) {
      const payload = {
        id: crypto.randomUUID(),
        user_email: settings.userEmail,
        amount: 0,
        credits_added: -cost,
        timestamp: new Date().toISOString(),
        description
      };
      backgroundSync('transactions', payload);
    }
    return true;
  },

  // ─── Resume History ────────────────────────────────────────────────────────

  getResumeHistory: (): Promise<ParsedResume[]> => {
    if (storageCache['resumeHistory']) {
      return Promise.resolve(storageCache['resumeHistory']);
    }
    return chrome.storage.local.get('resumeHistory').then((r) => {
      const history = (r.resumeHistory as ParsedResume[]) ?? [];
      storageCache['resumeHistory'] = history;
      return history;
    });
  },

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
      const updated = [newResume, ...history].slice(0, 10);
      storageCache['resumeHistory'] = updated;
      await chrome.storage.local.set({ resumeHistory: updated });
      
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        backgroundSync('resume_history', { user_email: settings.userEmail, ...newResume });
      }
    }),

  deleteResumeFromHistory: (id: string): Promise<void> =>
    enqueueWrite(async () => {
      const history = await Storage.getResumeHistory();
      const updated = history.filter((r) => r.id !== id);
      storageCache['resumeHistory'] = updated;
      await chrome.storage.local.set({ resumeHistory: updated });
      
      const settings = await Storage.getSettings();
      if (settings.userEmail && settings.supabaseUrl && settings.supabaseAnonKey) {
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/resume_history?id=eq.${id}&user_email=eq.${encodeURIComponent(settings.userEmail)}`;
        fetch(url, { method: 'DELETE', headers: { 'apikey': settings.supabaseAnonKey, 'Authorization': `Bearer ${settings.supabaseAnonKey}` } }).catch(()=>{});
      }
    }),

  // ─── Chat Sessions ─────────────────────────────────────────────────────────

  getChatSessions: (): Promise<ChatSession[]> => {
    if (storageCache['chatSessions']) {
      return Promise.resolve(storageCache['chatSessions']);
    }
    return chrome.storage.local.get('chatSessions').then((r) => {
      const sessions = (r.chatSessions as ChatSession[]) ?? [];
      storageCache['chatSessions'] = sessions;
      return sessions;
    });
  },

  setChatSessions: (sessions: ChatSession[]): Promise<void> =>
    enqueueWrite(async () => {
      storageCache['chatSessions'] = sessions;
      await chrome.storage.local.set({ chatSessions: sessions });
      const settings = await Storage.getSettings();
      if (settings.userEmail) {
        for (const session of sessions) {
           backgroundSync('chat_sessions', { user_email: settings.userEmail, ...session });
        }
      }
    }),
  
  deleteChatSession: (id: string): Promise<void> =>
    enqueueWrite(async () => {
      const sessions = await Storage.getChatSessions();
      const updated = sessions.filter(s => s.id !== id);
      storageCache['chatSessions'] = updated;
      await chrome.storage.local.set({ chatSessions: updated });
      
      const settings = await Storage.getSettings();
      if (settings.userEmail && settings.supabaseUrl && settings.supabaseAnonKey) {
        const url = `${settings.supabaseUrl.replace(/\/$/, '')}/rest/v1/chat_sessions?id=eq.${id}&user_email=eq.${encodeURIComponent(settings.userEmail)}`;
        fetch(url, { method: 'DELETE', headers: { 'apikey': settings.supabaseAnonKey, 'Authorization': `Bearer ${settings.supabaseAnonKey}` } }).catch(()=>{});
      }
    })
};
