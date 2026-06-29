import { create } from 'zustand';
import { Storage } from './storage';
import { UserProfile, Application, AIServiceSettings, ChatSession, ChatMessage, TabContext, UserBilling, ParsedResume } from './types';

// ─── Toast ───────────────────────────────────────────────────────────────────

export interface ToastInfo {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

// ─── Store Shape ─────────────────────────────────────────────────────────────

export interface AppState {
  // Data
  profile: UserProfile | null;
  applications: Application[];
  settings: AIServiceSettings | null;
  billing: UserBilling | null;
  resumeHistory: ParsedResume[];

  // Tab context (ATS detection)
  tabContext: TabContext | null;
  setTabContext: (ctx: TabContext | null) => void;

  // Chat sessions (stored in chrome.storage.local)
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  loadChatSessions: () => Promise<void>;
  createChatSession: (jobContext?: ChatSession['jobContext']) => ChatSession;
  addChatMessage: (sessionId: string, msg: ChatMessage) => Promise<void>;
  clearChatSession: (sessionId: string) => Promise<void>;

  // Lifecycle
  loadData: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setApplications: (apps: Application[]) => Promise<void>;
  addApplication: (app: Application) => Promise<void>;
  updateApplication: (id: string, updates: Partial<Application>) => Promise<void>;
  deleteApplication: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<AIServiceSettings>) => Promise<void>;
  addResumeToHistory: (filename: string, profileData: Partial<UserProfile>, resumeText: string) => Promise<void>;
  deleteResumeFromHistory: (id: string) => Promise<void>;

  // Toasts
  toasts: ToastInfo[];
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => void;
  removeToast: (id: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  profile: null,
  applications: [],
  settings: null,
  billing: null,
  tabContext: null,
  chatSessions: [],
  currentSessionId: null,
  resumeHistory: [],

  // ── Tab Context ────────────────────────────────────────────────────────────
  setTabContext: (ctx) => set({ tabContext: ctx }),

  // ── Data Loading ───────────────────────────────────────────────────────────
  loadData: async () => {
    // Attempt an auto-sync pull first if applicable
    await Storage.syncAllFromCloud();

    const [profile, applications, settings, billing, resumeHistory] = await Promise.all([
      Storage.getProfile(),
      Storage.getApplications(),
      Storage.getSettings(),
      Storage.getUserBilling(),
      Storage.getResumeHistory()
    ]);
    set({ profile, applications, settings, billing, resumeHistory });
  },

  // ── Profile ────────────────────────────────────────────────────────────────
  updateProfile: async (updates) => {
    const current = get().profile || {
      name: '', email: '', phone: '', college: '', degree: '',
      graduationYear: '', skills: [], resumeLink: '', linkedinUrl: '',
      portfolioUrl: '', customAnswers: [], projects: [], workExperience: [],
      createdAt: Date.now(), updatedAt: Date.now()
    };
    const newProfile = { ...current, ...updates, updatedAt: Date.now() };
    await Storage.setProfile(newProfile);
    set({ profile: newProfile });
  },

  // ── Applications ───────────────────────────────────────────────────────────
  setApplications: async (apps) => {
    await Storage.setApplications(apps);
    set({ applications: apps });
  },

  addApplication: async (app) => {
    await Storage.addApplication(app);
    const updatedApps = await Storage.getApplications();
    set({ applications: updatedApps });
  },

  updateApplication: async (id, updates) => {
    await Storage.updateApplication(id, updates);
    const updatedApps = await Storage.getApplications();
    set({ applications: updatedApps });
  },

  deleteApplication: async (id) => {
    await Storage.deleteApplication(id);
    const updatedApps = await Storage.getApplications();
    set({ applications: updatedApps });
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  updateSettings: async (updates) => {
    const current = get().settings || (await Storage.getSettings());
    const newSettings = { ...current, ...updates };
    newSettings.supabaseSyncEnabled = newSettings.isPremium ? !!newSettings.userEmail : false;
    await Storage.setSettings(newSettings);
    
    if (updates.userEmail) {
      await Storage.syncAllFromCloud(true);
    }

    const billing = await Storage.getUserBilling();
    
    // Refresh local store states after sync pull
    const [profile, applications, resumeHistory] = await Promise.all([
      Storage.getProfile(),
      Storage.getApplications(),
      Storage.getResumeHistory()
    ]);
    
    set({ settings: newSettings, billing, profile, applications, resumeHistory });
  },

  // ── Chat Sessions ──────────────────────────────────────────────────────────
  loadChatSessions: async () => {
    const sessions = await Storage.getChatSessions();
    const trimmed = sessions.slice(0, 20);
    set({ chatSessions: trimmed, currentSessionId: trimmed[0]?.id ?? null });
  },

  createChatSession: (jobContext) => {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      messages: [],
      jobContext,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const sessions = [session, ...get().chatSessions].slice(0, 20);
    Storage.setChatSessions(sessions).catch(() => {});
    set({ chatSessions: sessions, currentSessionId: session.id });
    return session;
  },

  addChatMessage: async (sessionId, msg) => {
    const sessions = get().chatSessions.map(s => {
      if (s.id !== sessionId) return s;
      return { ...s, messages: [...s.messages, msg], updatedAt: Date.now() };
    });
    await Storage.setChatSessions(sessions);
    set({ chatSessions: sessions });
  },

  clearChatSession: async (sessionId) => {
    await Storage.deleteChatSession(sessionId);
    const sessions = await Storage.getChatSessions();
    set({ chatSessions: sessions, currentSessionId: sessions[0]?.id ?? null });
  },

  // ── Resume History ─────────────────────────────────────────────────────────
  addResumeToHistory: async (filename, profileData, resumeText) => {
    await Storage.addResumeToHistory(filename, profileData, resumeText);
    const resumeHistory = await Storage.getResumeHistory();
    set({ resumeHistory });
  },

  deleteResumeFromHistory: async (id) => {
    await Storage.deleteResumeFromHistory(id);
    const resumeHistory = await Storage.getResumeHistory();
    set({ resumeHistory });
  },

  // ── Toasts ─────────────────────────────────────────────────────────────────
  toasts: [],
  showToast: (message, type = 'success', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    set(state => ({ toasts: [...state.toasts, { id, message, type, duration }] }));
    setTimeout(() => get().removeToast(id), duration);
  },
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  }
}));
