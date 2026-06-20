import { beforeEach, describe, expect, test, vi } from 'vitest';

// Define chrome mock before importing Storage
const mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockImplementation((key: string) => {
        return Promise.resolve({ [key]: mockStorage[key] });
      }),
      set: vi.fn().mockImplementation((data: Record<string, any>) => {
        Object.assign(mockStorage, data);
        return Promise.resolve();
      }),
      clear: vi.fn().mockImplementation((callback?: () => void) => {
        Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(true)
  }
} as any;

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Import Storage after defining mocks
import { Storage } from '../../src/shared/storage';
import { UserProfile, Application } from '../../src/shared/types';

describe('Storage Manager', () => {
  beforeEach(() => {
    // Reset local mock store
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
  });

  describe('Settings API', () => {
    test('getSettings should return DEFAULT_SETTINGS initially and override forced keys', async () => {
      const settings = await Storage.getSettings();
      expect(settings.geminiApiKey).toBe('AIzaSyBq-whqtAErXrbshvOFX9J22-7AMWSItAo');
      expect(settings.supabaseUrl).toBe('https://lqddvilwmqthidjklghv.supabase.co');
      expect(settings.demoMode).toBe(false);
    });

    test('setSettings should update settings', async () => {
      await Storage.setSettings({ showClipButton: false, userEmail: 'test@gmail.com' });
      const settings = await Storage.getSettings();
      expect(settings.showClipButton).toBe(false);
      expect(settings.userEmail).toBe('test@gmail.com');
    });
  });

  describe('Profile API', () => {
    const sampleProfile: UserProfile = {
      name: 'John Doe',
      email: 'john@doe.com',
      phone: '1234567890',
      college: 'Test College',
      degree: 'BS',
      graduationYear: '2025',
      skills: ['JS', 'TS'],
      resumeLink: 'http://resume.com',
      linkedinUrl: 'http://linkedin.com/in/john',
      portfolioUrl: 'http://john.com',
      customAnswers: [],
      projects: [],
      workExperience: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    test('getProfile should return null when no profile saved', async () => {
      const profile = await Storage.getProfile();
      expect(profile).toBeNull();
    });

    test('setProfile should save and return profile', async () => {
      await Storage.setProfile(sampleProfile);
      const profile = await Storage.getProfile();
      expect(profile).toEqual(sampleProfile);
    });

    test('setProfile should handle minimal profile', async () => {
      const minimalProfile = { ...sampleProfile, skills: [], projects: [], workExperience: [], customAnswers: [] };
      await Storage.setProfile(minimalProfile);
      const profile = await Storage.getProfile();
      expect(profile).toEqual(minimalProfile);
    });

    test('setProfile should handle large profile with extensive text', async () => {
      const largeProfile = { 
        ...sampleProfile, 
        resumeText: 'A'.repeat(50000), // 50k characters
        workExperience: Array.from({length: 20}).map((_, i) => ({
          id: `exp-${i}`, company: `Company ${i}`, role: `Role ${i}`,
          startDate: '2020-01', endDate: '2021-01', description: 'B'.repeat(1000)
        }))
      };
      await Storage.setProfile(largeProfile as any);
      const profile = await Storage.getProfile();
      expect(profile).toEqual(largeProfile);
    });
  });

  describe('Applications API', () => {
    const sampleApp: Application = {
      id: 'app-123',
      company: 'Google',
      role: 'Frontend Engineer',
      url: 'https://careers.google.com/jobs/123',
      platform: 'company_site',
      status: 'applied',
      appliedAt: Date.now(),
      notes: 'Initial note'
    };

    test('getApplications should return empty array initially', async () => {
      const apps = await Storage.getApplications();
      expect(apps).toEqual([]);
    });

    test('addApplication should add an application and ignore duplicate urls with applied status', async () => {
      await Storage.addApplication(sampleApp);
      let apps = await Storage.getApplications();
      expect(apps).toHaveLength(1);
      expect(apps[0]).toEqual(sampleApp);

      // Attempt to add duplicate
      await Storage.addApplication(sampleApp);
      apps = await Storage.getApplications();
      expect(apps).toHaveLength(1); // Length remains 1
    });

    test('updateApplication should merge updates', async () => {
      await Storage.setApplications([sampleApp]);
      await Storage.updateApplication('app-123', { status: 'interview', notes: 'Updated notes' });
      const apps = await Storage.getApplications();
      expect(apps[0].status).toBe('interview');
      expect(apps[0].notes).toBe('Updated notes');
    });

    test('deleteApplication should remove application from list', async () => {
      await Storage.setApplications([sampleApp]);
      await Storage.deleteApplication('app-123');
      const apps = await Storage.getApplications();
      expect(apps).toHaveLength(0);
    });
  });

  describe('Usage stats API', () => {
    test('getUsageStats should return initialized limit and count', async () => {
      const stats = await Storage.getUsageStats();
      expect(stats.dailyFillsUsed).toBe(0);
      expect(stats.dailyFillsLimit).toBe(999999);
    });

    test('incrementDailyUsage should increment counter', async () => {
      const stats = await Storage.incrementDailyUsage();
      expect(stats.dailyFillsUsed).toBe(1);
      expect(stats.totalFills).toBe(1);
    });
  });

  describe('Resume History API', () => {
    test('getResumeHistory should return empty array initially', async () => {
      const history = await Storage.getResumeHistory();
      expect(history).toEqual([]);
    });

    test('addResumeToHistory should save a resume to history', async () => {
      const dummyProfileData = { name: 'Parsed Jane', email: 'jane@parsed.com' };
      await Storage.addResumeToHistory('Jane_CV.pdf', dummyProfileData, 'CV plain text content');
      const history = await Storage.getResumeHistory();
      expect(history).toHaveLength(1);
      expect(history[0].filename).toBe('Jane_CV.pdf');
      expect(history[0].resumeText).toBe('CV plain text content');
      expect(history[0].profileData).toEqual(dummyProfileData);
      expect(history[0].id).toBeDefined();
      expect(history[0].parsedAt).toBeDefined();
    });

    test('addResumeToHistory should cap history size at 10 items', async () => {
      for (let i = 1; i <= 12; i++) {
        await Storage.addResumeToHistory(`Resume_${i}.pdf`, {}, `Text ${i}`);
      }
      const history = await Storage.getResumeHistory();
      expect(history).toHaveLength(10);
      expect(history[0].filename).toBe('Resume_12.pdf'); // Latest first
      expect(history[9].filename).toBe('Resume_3.pdf'); // Oldest retained
    });

    test('deleteResumeFromHistory should remove resume from list', async () => {
      await Storage.addResumeToHistory('DeleteMe.pdf', {}, 'text');
      let history = await Storage.getResumeHistory();
      const idToDelete = history[0].id;
      await Storage.deleteResumeFromHistory(idToDelete);
      history = await Storage.getResumeHistory();
      expect(history).toHaveLength(0);
    });
  });
});
