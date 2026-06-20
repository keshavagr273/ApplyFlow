/**
 * 2_store.spec.ts — Zustand AppState Store Unit Tests
 *
 * Covers every action in the store:
 *   • loadData, updateProfile, setApplications, addApplication,
 *     updateApplication, deleteApplication, updateSettings,
 *     syncToCloud, syncFromCloud
 *   • Chat session lifecycle: loadChatSessions, createChatSession,
 *     addChatMessage, clearChatSession
 *   • Toast system: showToast, removeToast
 *   • tabContext: setTabContext
 *   • Premium email override logic in updateSettings
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Application, UserProfile, AIServiceSettings, ChatMessage } from '../../src/shared/types';

// ── Chrome mocks ───────────────────────────────────────────────────────────────

const mockChromeStorage: Record<string, any> = {};

global.chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(true)
  },
  storage: {
    local: {
      get: vi.fn().mockImplementation((key: string | string[]) => {
        if (typeof key === 'string') return Promise.resolve({ [key]: mockChromeStorage[key] });
        const result: Record<string, any> = {};
        (key as string[]).forEach(k => { result[k] = mockChromeStorage[k]; });
        return Promise.resolve(result);
      }),
      set: vi.fn().mockImplementation((data: Record<string, any>) => {
        Object.assign(mockChromeStorage, data);
        return Promise.resolve();
      })
    }
  }
} as any;

// ── Storage mock ──────────────────────────────────────────────────────────────

const DUMMY_PROFILE: Partial<UserProfile> = {
  name: 'Store User',
  email: 'store@test.com',
  phone: '1234567890',
  college: 'Store College',
  degree: 'M.Tech',
  graduationYear: '2024',
  skills: ['Go', 'Rust'],
  resumeLink: '',
  linkedinUrl: '',
  portfolioUrl: '',
  customAnswers: [],
  projects: [],
  workExperience: [],
  createdAt: 1000,
  updatedAt: 1000
};

const DUMMY_APPS: Application[] = [
  { id: 'a1', company: 'StoreInc', role: 'Dev', url: 'http://store.inc', platform: 'company_site', status: 'saved', appliedAt: 1000, notes: '' }
];

const DUMMY_SETTINGS: Partial<AIServiceSettings> = {
  isPremium: false, enableOverlay: true, demoMode: false,
  autofillMode: 'ats-first', supabaseUrl: '', supabaseAnonKey: '',
  supabaseSyncEnabled: false
};

vi.mock('../../src/shared/storage', () => {
  const MOCK_PROFILE = {
    name: 'Store User',
    email: 'store@test.com',
    phone: '1234567890',
    college: 'Store College',
    degree: 'M.Tech',
    graduationYear: '2024',
    skills: ['Go', 'Rust'],
    resumeLink: '',
    linkedinUrl: '',
    portfolioUrl: '',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: 1000,
    updatedAt: 1000
  };
  const MOCK_APPS = [
    { id: 'a1', company: 'StoreInc', role: 'Dev', url: 'http://store.inc', platform: 'company_site', status: 'saved', appliedAt: 1000, notes: '' }
  ];
  const MOCK_SETTINGS = {
    isPremium: false, enableOverlay: true, demoMode: false,
    autofillMode: 'ats-first', supabaseUrl: '', supabaseAnonKey: '',
    supabaseSyncEnabled: false
  };
  const MOCK_BILLING = {
    userEmail: 'store@test.com',
    plan: 'free',
    creditsAllocated: 10,
    creditsUsed: 0,
    creditsPurchased: 0,
    premiumUntil: null,
    subscriptionStatus: 'active'
  };
  return {
    Storage: {
      getProfile:        vi.fn().mockResolvedValue(MOCK_PROFILE),
      getApplications:   vi.fn().mockResolvedValue(MOCK_APPS),
      getSettings:       vi.fn().mockResolvedValue(MOCK_SETTINGS),
      getUserBilling:    vi.fn().mockResolvedValue(MOCK_BILLING),
      deductCredits:     vi.fn().mockResolvedValue(true),
      setProfile:        vi.fn().mockResolvedValue(undefined),
      setSettings:       vi.fn().mockResolvedValue(undefined),
      setApplications:   vi.fn().mockResolvedValue(undefined),
      addApplication:    vi.fn().mockResolvedValue(undefined),
      updateApplication: vi.fn().mockResolvedValue(undefined),
      deleteApplication: vi.fn().mockResolvedValue(undefined),
      syncAllToCloud:    vi.fn().mockResolvedValue(true),
      syncAllFromCloud:  vi.fn().mockResolvedValue({ profile: MOCK_PROFILE, applications: MOCK_APPS }),
      getResumeHistory:  vi.fn().mockResolvedValue([]),
      addResumeToHistory: vi.fn().mockResolvedValue(undefined),
      deleteResumeFromHistory: vi.fn().mockResolvedValue(undefined),
    }
  };
});

import { useStore } from '../../src/shared/store';
import { Storage } from '../../src/shared/storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

const resetStore = () => {
  useStore.setState({
    profile: null,
    applications: [],
    settings: null,
    tabContext: null,
    chatSessions: [],
    currentSessionId: null,
    toasts: [],
    resumeHistory: []
  });
};

const freshApp = (overrides: Partial<Application> = {}): Application => ({
  id: `app-${Date.now()}-${Math.random()}`,
  company: 'FreshCo',
  role: 'Tester',
  url: `https://fresh.co/${Math.random()}`,
  platform: 'company_site',
  status: 'applied',
  appliedAt: Date.now(),
  notes: '',
  ...overrides
});

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  Object.keys(mockChromeStorage).forEach(k => delete mockChromeStorage[k]);
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

describe('loadData', () => {
  test('calls all three Storage getters and populates state', async () => {
    await useStore.getState().loadData();
    const state = useStore.getState();
    expect(Storage.getProfile).toHaveBeenCalledOnce();
    expect(Storage.getApplications).toHaveBeenCalledOnce();
    expect(Storage.getSettings).toHaveBeenCalledOnce();
    expect(state.profile?.name).toBe('Store User');
    expect(state.applications).toHaveLength(1);
    expect(state.settings?.isPremium).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

describe('updateProfile', () => {
  test('merges updates onto the existing profile', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateProfile({ name: 'Updated Name', phone: '9999999999' });
    const { profile } = useStore.getState();
    expect(profile?.name).toBe('Updated Name');
    expect(profile?.phone).toBe('9999999999');
    expect(profile?.email).toBe('store@test.com'); // unchanged
  });

  test('calls Storage.setProfile with merged data', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateProfile({ name: 'Merged' });
    expect(Storage.setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Merged', email: 'store@test.com' })
    );
  });

  test('initialises default profile if none exists', async () => {
    // No loadData called — profile is null
    await useStore.getState().updateProfile({ name: 'Fresh User' });
    const { profile } = useStore.getState();
    expect(profile?.name).toBe('Fresh User');
    expect(profile?.skills).toEqual([]);
    expect(profile?.customAnswers).toEqual([]);
  });

  test('sets updatedAt to a recent timestamp', async () => {
    const before = Date.now();
    await useStore.getState().updateProfile({ name: 'Timestamped' });
    const { profile } = useStore.getState();
    expect(profile?.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('setApplications', () => {
  test('replaces the applications array in state and calls Storage', async () => {
    const apps = [freshApp({ company: 'ReplaceMe' })];
    await useStore.getState().setApplications(apps);
    const { applications } = useStore.getState();
    expect(applications).toHaveLength(1);
    expect(applications[0].company).toBe('ReplaceMe');
    expect(Storage.setApplications).toHaveBeenCalledWith(apps);
  });
});

describe('addApplication', () => {
  test('prepends new application to state optimistically', async () => {
    await useStore.getState().loadData(); // seeds with 1 app
    const newApp = freshApp({ company: 'NewCo' });
    await useStore.getState().addApplication(newApp);
    const { applications } = useStore.getState();
    expect(applications[0].company).toBe('NewCo');
    expect(applications).toHaveLength(2);
  });

  test('prevents duplicate applied URL', async () => {
    await useStore.getState().loadData();
    const a1 = freshApp({ url: 'http://dup.com', status: 'applied' });
    await useStore.getState().addApplication(a1);
    await useStore.getState().addApplication({ ...a1, id: 'dup-2' });
    const { applications } = useStore.getState();
    const dups = applications.filter(a => a.url === 'http://dup.com' && a.status === 'applied');
    expect(dups).toHaveLength(1);
  });

  test('rolls back optimistic state on Storage failure', async () => {
    (Storage.addApplication as any).mockRejectedValueOnce(new Error('DB error'));
    const initialCount = useStore.getState().applications.length;
    const app = freshApp();
    await useStore.getState().addApplication(app);
    // After rollback, count should be back to what it was (optimistic add then rolled back)
    const { applications } = useStore.getState();
    expect(applications).toHaveLength(initialCount);
  });

  test('calls Storage.addApplication with the app data', async () => {
    const app = freshApp({ company: 'StorageTarget' });
    await useStore.getState().addApplication(app);
    expect(Storage.addApplication).toHaveBeenCalledWith(app);
  });
});

describe('updateApplication', () => {
  test('merges updates into the matching application', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateApplication('a1', { status: 'interview', notes: 'round 1 done' });
    const { applications } = useStore.getState();
    expect(applications[0].status).toBe('interview');
    expect(applications[0].notes).toBe('round 1 done');
  });

  test('schedules a chrome alarm when remindAt is in the future', async () => {
    await useStore.getState().loadData();
    const futureTime = Date.now() + 1_000_000;
    await useStore.getState().updateApplication('a1', { remindAt: futureTime });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_REMINDER', payload: expect.objectContaining({ appId: 'a1' }) })
    );
  });

  test('does NOT send SET_REMINDER for past remindAt', async () => {
    await useStore.getState().loadData();
    const pastTime = Date.now() - 1_000_000;
    await useStore.getState().updateApplication('a1', { remindAt: pastTime });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SET_REMINDER' })
    );
  });

  test('calls Storage.updateApplication with correct id and updates', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateApplication('a1', { status: 'offer' });
    expect(Storage.updateApplication).toHaveBeenCalledWith('a1', expect.objectContaining({ status: 'offer' }));
  });
});

describe('deleteApplication', () => {
  test('removes application from state', async () => {
    await useStore.getState().loadData();
    await useStore.getState().deleteApplication('a1');
    expect(useStore.getState().applications).toHaveLength(0);
  });

  test('calls Storage.deleteApplication with the id', async () => {
    await useStore.getState().loadData();
    await useStore.getState().deleteApplication('a1');
    expect(Storage.deleteApplication).toHaveBeenCalledWith('a1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

describe('updateSettings', () => {
  test('merges updates into existing settings', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateSettings({ enableOverlay: false, theme: 'light' });
    const { settings } = useStore.getState();
    expect(settings?.enableOverlay).toBe(false);
    expect(settings?.theme).toBe('light');
  });

  test('forces isPremium=true for keshavagrawal273@gmail.com', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateSettings({ userEmail: 'keshavagrawal273@gmail.com', isPremium: false });
    expect(useStore.getState().settings?.isPremium).toBe(true);
  });

  test('sets supabaseSyncEnabled=true when premium and userEmail present', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateSettings({ isPremium: true, userEmail: 'x@x.com' });
    expect(useStore.getState().settings?.supabaseSyncEnabled).toBe(true);
  });

  test('calls Storage.setSettings with merged settings', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateSettings({ showClipButton: false });
    expect(Storage.setSettings).toHaveBeenCalledWith(
      expect.objectContaining({ showClipButton: false })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLOUD SYNC
// ─────────────────────────────────────────────────────────────────────────────

describe('syncToCloud / syncFromCloud', () => {
  test('syncToCloud calls Storage.syncAllToCloud and returns true', async () => {
    const result = await useStore.getState().syncToCloud();
    expect(result).toBe(true);
    expect(Storage.syncAllToCloud).toHaveBeenCalled();
  });

  test('syncFromCloud updates state with cloud data and returns true', async () => {
    const result = await useStore.getState().syncFromCloud();
    expect(result).toBe(true);
    const { profile, applications } = useStore.getState();
    expect(profile?.name).toBe('Store User');
    expect(applications).toHaveLength(1);
  });

  test('syncFromCloud returns false when Storage returns null', async () => {
    (Storage.syncAllFromCloud as any).mockResolvedValueOnce(null);
    const result = await useStore.getState().syncFromCloud();
    expect(result).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT SESSIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Chat sessions', () => {
  test('createChatSession adds a session and sets it as current', () => {
    const session = useStore.getState().createChatSession();
    const { chatSessions, currentSessionId } = useStore.getState();
    expect(chatSessions).toHaveLength(1);
    expect(currentSessionId).toBe(session.id);
    expect(session.messages).toEqual([]);
  });

  test('createChatSession with jobContext stores it on the session', () => {
    const ctx = { company: 'Stripe', role: 'SWE', platform: 'greenhouse', jobDescription: 'Build payments' };
    const session = useStore.getState().createChatSession(ctx);
    expect(session.jobContext?.company).toBe('Stripe');
  });

  test('createChatSession keeps only last 20 sessions', () => {
    for (let i = 0; i < 25; i++) {
      useStore.getState().createChatSession();
    }
    expect(useStore.getState().chatSessions).toHaveLength(20);
  });

  test('addChatMessage appends message to the right session', async () => {
    const session = useStore.getState().createChatSession();
    const msg: ChatMessage = {
      id: 'msg-1', role: 'user', type: 'text', content: 'Hello!', createdAt: Date.now()
    };
    await useStore.getState().addChatMessage(session.id, msg);
    const s = useStore.getState().chatSessions.find(s => s.id === session.id);
    expect(s?.messages).toHaveLength(1);
    expect(s?.messages[0].content).toBe('Hello!');
  });

  test('clearChatSession removes session from list', async () => {
    const session = useStore.getState().createChatSession();
    await useStore.getState().clearChatSession(session.id);
    expect(useStore.getState().chatSessions).toHaveLength(0);
    expect(useStore.getState().currentSessionId).toBeNull();
  });

  test('loadChatSessions loads sessions from chrome.storage', async () => {
    const storedSessions = [
      { id: 's1', messages: [], createdAt: 1000, updatedAt: 1000 }
    ];
    mockChromeStorage['chatSessions'] = storedSessions;
    await useStore.getState().loadChatSessions();
    expect(useStore.getState().chatSessions).toHaveLength(1);
    expect(useStore.getState().currentSessionId).toBe('s1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAB CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

describe('setTabContext', () => {
  test('sets the tab context in state', () => {
    const ctx = { url: 'https://jobs.lever.co/company/role', title: 'Role @ Co', platform: 'lever', isJobPage: true, company: 'Co', role: 'Role', jobDescription: '' };
    useStore.getState().setTabContext(ctx);
    expect(useStore.getState().tabContext).toEqual(ctx);
  });

  test('can clear tab context by setting null', () => {
    useStore.getState().setTabContext(null);
    expect(useStore.getState().tabContext).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

describe('Toast system', () => {
  test('showToast adds a toast to state', () => {
    vi.useFakeTimers();
    useStore.getState().showToast('Test message', 'success', 5000);
    const { toasts } = useStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Test message');
    expect(toasts[0].type).toBe('success');
    vi.useRealTimers();
  });

  test('showToast defaults to success and 3500ms duration', () => {
    vi.useFakeTimers();
    useStore.getState().showToast('Default toast');
    const { toasts } = useStore.getState();
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].duration).toBe(3500);
    vi.useRealTimers();
  });

  test('showToast supports all toast types', () => {
    vi.useFakeTimers();
    const types = ['success', 'error', 'info', 'warning'] as const;
    for (const type of types) {
      useStore.getState().showToast(`${type} message`, type);
    }
    const { toasts } = useStore.getState();
    expect(toasts).toHaveLength(4);
    vi.useRealTimers();
  });

  test('removeToast removes the specified toast', () => {
    vi.useFakeTimers();
    useStore.getState().showToast('Remove me', 'error', 99999);
    const id = useStore.getState().toasts[0].id;
    useStore.getState().removeToast(id);
    expect(useStore.getState().toasts).toHaveLength(0);
    vi.useRealTimers();
  });
});
