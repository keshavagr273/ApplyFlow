/**
 * 1_database.spec.ts — Storage / Database Layer Unit Tests
 *
 * Covers every public method on the Storage object:
 *   • getSettings / setSettings  (defaults, merging, premium override)
 *   • getProfile / setProfile    (null, minimal, full, Supabase sync path)
 *   • getApplications / setApplications / addApplication /
 *     updateApplication / deleteApplication
 *   • getUsageStats / incrementDailyUsage
 *   • syncAllToCloud / syncAllFromCloud  (success, partial, network error)
 *   • Premium email hard-code  (keshavagrawal273@gmail.com → isPremium=true)
 *   • Write-lock / serialisation of concurrent writes
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { UserProfile, Application, AIServiceSettings } from '../../src/shared/types';

// ── Chrome storage mock ────────────────────────────────────────────────────────
const mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockImplementation((key: string) =>
        Promise.resolve({ [key]: mockStorage[key] })
      ),
      set: vi.fn().mockImplementation((data: Record<string, any>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation(() => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(true)
  }
} as any;

const fetchMock = vi.fn();
global.fetch = fetchMock;

import { Storage } from '../../src/shared/storage';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Test User',
  email: 'test@example.com',
  phone: '9876543210',
  college: 'Test College',
  degree: 'B.Tech CS',
  graduationYear: '2025',
  skills: ['TypeScript', 'React'],
  resumeLink: 'https://drive.google.com/resume',
  linkedinUrl: 'https://linkedin.com/in/test',
  portfolioUrl: 'https://testuser.dev',
  customAnswers: [],
  projects: [],
  workExperience: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides
});

const makeApp = (overrides: Partial<Application> = {}): Application => ({
  id: `app-${Math.random().toString(36).slice(2)}`,
  company: 'Acme Corp',
  role: 'Engineer',
  url: `https://acme.com/jobs/${Math.random()}`,
  platform: 'company_site',
  status: 'applied',
  appliedAt: Date.now(),
  notes: '',
  ...overrides
});

// ── Reset before each test ────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  vi.clearAllMocks();
  fetchMock.mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

describe('Settings API', () => {
  test('getSettings returns safe defaults when storage is empty', async () => {
    const s = await Storage.getSettings();
    expect(s.demoMode).toBe(false);
    expect(s.enableOverlay).toBe(true);
    expect(s.autofillMode).toBe('ats-first');
    expect(s.showClipButton).toBe(true);
    expect(s.isPremium).toBe(false);
    expect(s.supabaseSyncEnabled).toBe(false);
    expect(s.theme).toBe('light');
  });

  test('getSettings returns empty geminiApiKey by default (no hardcoded key shipped)', async () => {
    // SECURITY: Hardcoded fallback keys were removed. The key is empty until the
    // user enters their own in Settings, or VITE_GEMINI_API_KEY env var is set.
    const s = await Storage.getSettings();
    expect(s.geminiApiKey).toBe('');
  });

  test('getSettings returns empty supabaseUrl by default (no hardcoded URL shipped)', async () => {
    // SECURITY: Hardcoded fallback URLs were removed. The URL is empty until
    // VITE_SUPABASE_URL env var is set.
    const s = await Storage.getSettings();
    expect(s.supabaseUrl).toBe('');
  });

  test('getSettings always forces demoMode=false even if stored as true', async () => {
    mockStorage['settings'] = { demoMode: true };
    const s = await Storage.getSettings();
    expect(s.demoMode).toBe(false);
  });

  test('getSettings does NOT auto-grant isPremium for any email (dev bypass removed)', async () => {
    // SECURITY: The hardcoded email bypass was a P2 vulnerability. It is removed.
    // Premium is now only granted server-side via Supabase.
    mockStorage['settings'] = { userEmail: 'keshavagrawal273@gmail.com', isPremium: false };
    const s = await Storage.getSettings();
    expect(s.isPremium).toBe(false);
  });

  test('getSettings enables supabaseSyncEnabled only when isPremium AND userEmail present', async () => {
    mockStorage['settings'] = { isPremium: true, userEmail: 'user@test.com' };
    const s = await Storage.getSettings();
    expect(s.supabaseSyncEnabled).toBe(true);
  });

  test('getSettings keeps supabaseSyncEnabled=false when premium but no email', async () => {
    mockStorage['settings'] = { isPremium: true };
    const s = await Storage.getSettings();
    expect(s.supabaseSyncEnabled).toBe(false);
  });

  test('getSettings keeps supabaseSyncEnabled=false when email present but not premium', async () => {
    mockStorage['settings'] = { isPremium: false, userEmail: 'user@test.com' };
    const s = await Storage.getSettings();
    expect(s.supabaseSyncEnabled).toBe(false);
  });

  test('setSettings persists partial updates and merges with defaults', async () => {
    await Storage.setSettings({ showClipButton: false, theme: 'light' });
    const s = await Storage.getSettings();
    expect(s.showClipButton).toBe(false);
    expect(s.theme).toBe('light');
    expect(s.demoMode).toBe(false); // unchanged default
  });

  test('setSettings does NOT auto-grant isPremium for any email (dev bypass removed)', async () => {
    // SECURITY: The hardcoded email bypass was a P2 vulnerability. It is removed.
    await Storage.setSettings({ userEmail: 'keshavagrawal273@gmail.com', isPremium: false });
    const s = await Storage.getSettings();
    expect(s.isPremium).toBe(false);
  });

  test('setSettings updates userDisplayName and userAvatar', async () => {
    await Storage.setSettings({
      userEmail: 'test@gmail.com',
      userDisplayName: 'Test Name',
      userAvatar: 'https://avatar.url/photo.jpg'
    });
    const s = await Storage.getSettings();
    expect(s.userDisplayName).toBe('Test Name');
    expect(s.userAvatar).toBe('https://avatar.url/photo.jpg');
  });

  test('setSettings handles updating all autofill modes', async () => {
    for (const mode of ['ai', 'heuristic', 'ats-first'] as const) {
      await Storage.setSettings({ autofillMode: mode });
      const s = await Storage.getSettings();
      expect(s.autofillMode).toBe(mode);
    }
  });

  test('setSettings handles concurrent writes without data corruption', async () => {
    const writes = Array.from({ length: 10 }, (_, i) =>
      Storage.setSettings({ licenseKey: `key-${i}` })
    );
    await Promise.all(writes);
    const s = await Storage.getSettings();
    expect(s.licenseKey).toMatch(/^key-\d$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────────────────────

describe('Profile API', () => {
  test('getProfile returns null when nothing is stored', async () => {
    const p = await Storage.getProfile();
    expect(p).toBeNull();
  });

  test('setProfile and getProfile round-trip correctly', async () => {
    const profile = makeProfile();
    await Storage.setProfile(profile);
    const loaded = await Storage.getProfile();
    expect(loaded).toEqual(profile);
  });

  test('setProfile stores a minimal profile (only required fields)', async () => {
    const minimal = makeProfile({
      skills: [],
      customAnswers: [],
      projects: [],
      workExperience: []
    });
    await Storage.setProfile(minimal);
    const loaded = await Storage.getProfile();
    expect(loaded?.name).toBe(minimal.name);
    expect(loaded?.skills).toEqual([]);
  });

  test('setProfile stores a full profile with all optional fields', async () => {
    const full = makeProfile({
      address: '123 Main St',
      currentCity: 'Bengaluru',
      currentState: 'Karnataka',
      currentCountry: 'India',
      postalCode: '560001',
      nationality: 'Indian',
      noticePeriod: '30 days',
      expectedSalary: '10-15 LPA',
      preferredRole: 'Full Stack Engineer',
      yearsOfExperience: '2',
      gender: 'male',
      disability: 'no',
      veteran: 'no',
      workAuthorized: true,
      requiresSponsorship: false,
      ethnicity: 'South Asian',
      tenthPercent: '92',
      twelfthPercent: '88',
      cgpa: '8.5',
      githubUrl: 'https://github.com/testuser',
      alternatePhone: '9876543211',
      resumeText: 'Full resume text here...',
      customAnswers: [{ id: 'ca1', trigger: 'Why work here?', answer: 'Passion for tech.' }],
      projects: [{ id: 'p1', title: 'Portfolio Site', description: 'My portfolio', githubUrl: '', deploymentUrl: '' }],
      workExperience: [{ id: 'w1', company: 'Startup', role: 'Intern', startDate: '2024-01', endDate: '2024-06', description: 'Worked on React.' }],
      education: [{ id: 'e1', institution: 'IIT Delhi', degree: 'B.Tech', field: 'CS', startYear: '2021', endYear: '2025', grade: '8.5' }]
    });
    await Storage.setProfile(full);
    const loaded = await Storage.getProfile();
    expect(loaded?.nationality).toBe('Indian');
    expect(loaded?.customAnswers).toHaveLength(1);
    expect(loaded?.projects).toHaveLength(1);
    expect(loaded?.workExperience).toHaveLength(1);
    expect(loaded?.education).toHaveLength(1);
  });

  test('setProfile with very large resumeText stores without truncation', async () => {
    const large = makeProfile({ resumeText: 'X'.repeat(100000) });
    await Storage.setProfile(large);
    const loaded = await Storage.getProfile();
    expect(loaded?.resumeText?.length).toBe(100000);
  });

  test('setProfile does NOT call Supabase when supabaseSyncEnabled=false', async () => {
    const profile = makeProfile();
    await Storage.setProfile(profile);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('setProfile calls Supabase POST when supabaseSyncEnabled=true', async () => {
    mockStorage['settings'] = {
      supabaseSyncEnabled: true,
      isPremium: true,
      userEmail: 'test@gmail.com',
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key'
    };
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => 'true' });
    const profile = makeProfile({ email: 'test@gmail.com' });
    await Storage.setProfile(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/profile'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('setProfile survives Supabase network error gracefully', async () => {
    mockStorage['settings'] = {
      supabaseSyncEnabled: true, isPremium: true, userEmail: 'test@gmail.com',
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co', supabaseAnonKey: 'key'
    };
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    const profile = makeProfile();
    await expect(Storage.setProfile(profile)).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────────────────────────────────────

describe('Applications API', () => {
  test('getApplications returns empty array when nothing stored', async () => {
    const apps = await Storage.getApplications();
    expect(apps).toEqual([]);
  });

  test('setApplications persists the full list', async () => {
    const list = [makeApp({ company: 'Google' }), makeApp({ company: 'Meta' })];
    await Storage.setApplications(list);
    const loaded = await Storage.getApplications();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].company).toBe('Google');
    expect(loaded[1].company).toBe('Meta');
  });

  test('addApplication prepends to the list', async () => {
    const a1 = makeApp({ company: 'Alpha' });
    const a2 = makeApp({ company: 'Beta' });
    await Storage.addApplication(a1);
    await Storage.addApplication(a2);
    const apps = await Storage.getApplications();
    expect(apps[0].company).toBe('Beta');
    expect(apps[1].company).toBe('Alpha');
  });

  test('addApplication prevents duplicate applied URL', async () => {
    const app = makeApp({ status: 'applied' });
    await Storage.addApplication(app);
    await Storage.addApplication({ ...app }); // duplicate
    const apps = await Storage.getApplications();
    expect(apps).toHaveLength(1);
  });

  test('addApplication allows same URL for different statuses', async () => {
    const base = makeApp({ url: 'https://same.url.com', status: 'saved' });
    await Storage.addApplication(base);
    await Storage.addApplication({ ...base, id: 'app-new', status: 'applied' });
    const apps = await Storage.getApplications();
    expect(apps).toHaveLength(2);
  });

  test('updateApplication merges partial updates', async () => {
    const app = makeApp({ status: 'applied', notes: 'original' });
    await Storage.setApplications([app]);
    await Storage.updateApplication(app.id, { status: 'interview', notes: 'updated' });
    const apps = await Storage.getApplications();
    expect(apps[0].status).toBe('interview');
    expect(apps[0].notes).toBe('updated');
  });

  test('updateApplication does not affect other applications', async () => {
    const a1 = makeApp({ company: 'A' });
    const a2 = makeApp({ company: 'B' });
    await Storage.setApplications([a1, a2]);
    await Storage.updateApplication(a1.id, { notes: 'changed' });
    const apps = await Storage.getApplications();
    const bApp = apps.find(a => a.company === 'B');
    expect(bApp?.notes).toBe('');
  });

  test('deleteApplication removes correct entry', async () => {
    const a1 = makeApp({ company: 'ToDelete' });
    const a2 = makeApp({ company: 'ToKeep' });
    await Storage.setApplications([a1, a2]);
    await Storage.deleteApplication(a1.id);
    const apps = await Storage.getApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0].company).toBe('ToKeep');
  });

  test('deleteApplication on non-existent id is a no-op', async () => {
    const app = makeApp();
    await Storage.setApplications([app]);
    await Storage.deleteApplication('non-existent-id');
    const apps = await Storage.getApplications();
    expect(apps).toHaveLength(1);
  });

  test('addApplication supports all defined platforms', async () => {
    const platforms: Application['platform'][] = [
      'internshala', 'linkedin', 'unstop', 'company_site', 'other',
      'naukri', 'indeed', 'workday', 'greenhouse', 'lever',
      'smartrecruiters', 'icims', 'bamboohr', 'jobvite', 'taleo',
      'angellist', 'wellfound'
    ];
    for (const platform of platforms) {
      const app = makeApp({ platform });
      await Storage.addApplication(app);
    }
    const apps = await Storage.getApplications();
    expect(apps).toHaveLength(platforms.length);
  });

  test('addApplication calls Supabase POST when supabaseSyncEnabled=true', async () => {
    mockStorage['settings'] = {
      supabaseSyncEnabled: true, isPremium: true, userEmail: 'test@gmail.com',
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co', supabaseAnonKey: 'key'
    };
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => 'true' });
    await Storage.addApplication(makeApp());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/rest/v1/applications'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  test('deleteApplication calls Supabase DELETE when supabaseSyncEnabled=true', async () => {
    const app = makeApp();
    mockStorage['settings'] = {
      supabaseSyncEnabled: true, isPremium: true, userEmail: 'test@gmail.com',
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co', supabaseAnonKey: 'key'
    };
    mockStorage['applications'] = [app];
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' });
    await Storage.deleteApplication(app.id);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`id=eq.${app.id}`),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  test('stores all ApplicationStatus values correctly', async () => {
    const statuses = ['saved', 'applied', 'assessment', 'interview', 'offer', 'rejected', 'withdrawn'] as const;
    for (const status of statuses) {
      const app = makeApp({ status });
      await Storage.addApplication(app);
    }
    const apps = await Storage.getApplications();
    const storedStatuses = apps.map(a => a.status);
    for (const status of statuses) {
      expect(storedStatuses).toContain(status);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// USAGE STATS
// ─────────────────────────────────────────────────────────────────────────────

describe('Usage Stats API', () => {
  test('getUsageStats returns zero counts and limit=999999 for non-premium', async () => {
    const stats = await Storage.getUsageStats();
    expect(stats.dailyFillsUsed).toBe(0);
    expect(stats.totalFills).toBe(0);
    expect(stats.dailyFillsLimit).toBe(999999);
  });

  test('getUsageStats returns limit=999999 for premium users', async () => {
    mockStorage['settings'] = {
      isPremium: true, userEmail: 'premium@test.com',
      supabaseUrl: '', supabaseAnonKey: ''
    };
    const stats = await Storage.getUsageStats();
    expect(stats.dailyFillsLimit).toBe(999999);
  });

  test('incrementDailyUsage increments both daily and total counts', async () => {
    const s1 = await Storage.incrementDailyUsage();
    expect(s1.dailyFillsUsed).toBe(1);
    expect(s1.totalFills).toBe(1);
    const s2 = await Storage.incrementDailyUsage();
    expect(s2.dailyFillsUsed).toBe(2);
    expect(s2.totalFills).toBe(2);
  });

  test('getUsageStats resets daily count if date has changed', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    mockStorage['usage'] = {
      dailyFillsUsed: 99,
      totalFills: 200,
      dailyFillsLimit: 3,
      lastUsedTimestamp: yesterday.getTime()
    };
    const stats = await Storage.getUsageStats();
    expect(stats.dailyFillsUsed).toBe(0);
    expect(stats.totalFills).toBe(200); // Total persists
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLOUD SYNC
// ─────────────────────────────────────────────────────────────────────────────

describe('Cloud Sync', () => {
  test('syncAllToCloud returns false when supabase keys are missing', async () => {
    mockStorage['settings'] = { supabaseUrl: '', supabaseAnonKey: '' };
    const result = await Storage.syncAllToCloud();
    expect(result).toBe(false);
  });

  test('syncAllToCloud returns true when all requests succeed', async () => {
    mockStorage['settings'] = {
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key', isPremium: false
    };
    mockStorage['profile'] = makeProfile();
    mockStorage['applications'] = [makeApp()];
    fetchMock.mockResolvedValue({ ok: true, text: async () => 'true' });
    const result = await Storage.syncAllToCloud();
    expect(result).toBe(true);
  });

  test('syncAllToCloud returns false when any Supabase call fails', async () => {
    mockStorage['settings'] = {
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key', isPremium: false
    };
    mockStorage['profile'] = makeProfile();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error' });
    const result = await Storage.syncAllToCloud();
    expect(result).toBe(false);
  });

  test('syncAllToCloud skips profile sync when profile is null', async () => {
    mockStorage['settings'] = {
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key', isPremium: false
    };
    // No profile in storage
    const result = await Storage.syncAllToCloud();
    expect(result).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('syncAllFromCloud returns null when supabase keys are missing', async () => {
    mockStorage['settings'] = { supabaseUrl: '', supabaseAnonKey: '' };
    const result = await Storage.syncAllFromCloud();
    expect(result).toBeNull();
  });

  test('syncAllFromCloud populates storage with fetched data', async () => {
    const profile = makeProfile();
    const apps = [makeApp()];
    mockStorage['settings'] = {
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key', userEmail: 'test@gmail.com', isPremium: false
    };
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'anon', ...profile }] }) // profile
      .mockResolvedValueOnce({ ok: true, json: async () => apps }); // apps

    const result = await Storage.syncAllFromCloud();
    expect(result).not.toBeNull();
    expect(result?.profile?.name).toBe(profile.name);
    expect(result?.applications).toHaveLength(1);
  });

  test('syncAllFromCloud handles network error gracefully', async () => {
    mockStorage['settings'] = {
      supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
      supabaseAnonKey: 'test-key', isPremium: false
    };
    fetchMock.mockRejectedValueOnce(new Error('Network down'));
    const result = await Storage.syncAllFromCloud();
    expect(result).toBeNull();
  });
});
