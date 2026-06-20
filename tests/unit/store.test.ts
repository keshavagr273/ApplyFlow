import { beforeEach, describe, expect, test, vi } from 'vitest';

// Define chrome mock globally before importing the store
global.chrome = {
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(true)
  }
} as any;

// Mock Storage module
vi.mock('../../src/shared/storage', () => {
  const dummyProfile = { name: 'John Zustand', email: 'john@zustand.com' };
  const dummyApps = [{ id: 'app-1', company: 'Zustand Inc', status: 'saved', appliedAt: 1000 }];
  const dummySettings = { isPremium: true, enableOverlay: true };
  const dummyBilling = {
    userEmail: 'john@zustand.com',
    plan: 'free',
    creditsAllocated: 10,
    creditsUsed: 0,
    creditsPurchased: 0,
    premiumUntil: null,
    subscriptionStatus: 'active'
  };

  return {
    Storage: {
      getProfile: vi.fn().mockResolvedValue(dummyProfile),
      getApplications: vi.fn().mockResolvedValue(dummyApps),
      getSettings: vi.fn().mockResolvedValue(dummySettings),
      getUserBilling: vi.fn().mockResolvedValue(dummyBilling),
      deductCredits: vi.fn().mockResolvedValue(true),
      setProfile: vi.fn().mockResolvedValue(undefined),
      setSettings: vi.fn().mockResolvedValue(undefined),
      setApplications: vi.fn().mockResolvedValue(undefined),
      addApplication: vi.fn().mockResolvedValue(undefined),
      updateApplication: vi.fn().mockResolvedValue(undefined),
      deleteApplication: vi.fn().mockResolvedValue(undefined),
      syncAllToCloud: vi.fn().mockResolvedValue(true),
      syncAllFromCloud: vi.fn().mockResolvedValue({ profile: dummyProfile, applications: dummyApps }),
      getResumeHistory: vi.fn().mockResolvedValue([]),
      addResumeToHistory: vi.fn().mockResolvedValue(undefined),
      deleteResumeFromHistory: vi.fn().mockResolvedValue(undefined),
    }
  };
});

import { useStore } from '../../src/shared/store';
import { Storage } from '../../src/shared/storage';

describe('Zustand AppState Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand store state before each test
    useStore.setState({
      profile: null,
      applications: [],
      settings: null
    });
  });

  test('loadData should fetch profile, applications, and settings from Storage', async () => {
    await useStore.getState().loadData();
    const state = useStore.getState();

    expect(Storage.getProfile).toHaveBeenCalled();
    expect(Storage.getApplications).toHaveBeenCalled();
    expect(Storage.getSettings).toHaveBeenCalled();

    expect(state.profile?.name).toBe('John Zustand');
    expect(state.applications).toHaveLength(1);
    expect(state.applications[0].company).toBe('Zustand Inc');
    expect(state.settings?.isPremium).toBe(true);
  });

  test('updateProfile should save profile updates to Storage and state', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateProfile({ name: 'New Name', phone: '9999999999' });

    const state = useStore.getState();
    expect(state.profile?.name).toBe('New Name');
    expect(state.profile?.phone).toBe('9999999999');
    expect(Storage.setProfile).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New Name',
      phone: '9999999999'
    }));
  });

  describe('Profile Variations (Minimal, Normal, Large)', () => {
    test('should handle Minimal Profile safely', async () => {
      const minimal = { name: 'Min', email: 'min@min.com', phone: '123' };
      await useStore.getState().updateProfile(minimal);
      expect(useStore.getState().profile?.email).toBe('min@min.com');
      expect(useStore.getState().profile?.skills).toEqual([]); // Initialized to empty array
    });

    test('should handle Large Profile safely', async () => {
      const large = {
        name: 'Max',
        email: 'max@max.com',
        phone: '999',
        skills: Array.from({ length: 50 }, (_, i) => `Skill ${i}`),
        projects: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, title: `P${i}`, description: '', githubUrl: '', deploymentUrl: '' })),
        workExperience: Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, company: `C${i}`, role: '', startDate: '', endDate: '', description: '' }))
      };
      await useStore.getState().updateProfile(large);
      const profile = useStore.getState().profile;
      expect(profile?.skills?.length).toBe(50);
      expect(profile?.projects?.length).toBe(10);
      expect(profile?.workExperience?.length).toBe(10);
      expect(Storage.setProfile).toHaveBeenCalledWith(expect.objectContaining({ name: 'Max' }));
    });
  });

  test('addApplication should prepend application to state and call Storage', async () => {
    await useStore.getState().loadData();
    const newApp = {
      id: 'app-2',
      company: 'Future Co',
      role: 'Intern',
      url: 'http://future.co',
      platform: 'company_site' as const,
      status: 'applied' as const,
      appliedAt: Date.now(),
      notes: ''
    };

    await useStore.getState().addApplication(newApp);
    const state = useStore.getState();

    expect(state.applications).toHaveLength(2);
    expect(state.applications[0]).toEqual(newApp);
    expect(Storage.addApplication).toHaveBeenCalledWith(newApp);
  });

  test('updateApplication should update store, Storage, and schedule reminder if remindAt set', async () => {
    await useStore.getState().loadData();
    const futureTime = Date.now() + 1000000;

    await useStore.getState().updateApplication('app-1', { status: 'interview', remindAt: futureTime });
    const state = useStore.getState();

    expect(state.applications[0].status).toBe('interview');
    expect(Storage.updateApplication).toHaveBeenCalledWith('app-1', expect.objectContaining({
      status: 'interview',
      remindAt: futureTime
    }));
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SET_REMINDER',
      payload: { appId: 'app-1', remindAt: futureTime }
    });
  });

  test('deleteApplication should delete in state and Storage', async () => {
    await useStore.getState().loadData();
    await useStore.getState().deleteApplication('app-1');

    const state = useStore.getState();
    expect(state.applications).toHaveLength(0);
    expect(Storage.deleteApplication).toHaveBeenCalledWith('app-1');
  });

  test('updateSettings should update settings in state and Storage', async () => {
    await useStore.getState().loadData();
    await useStore.getState().updateSettings({ enableOverlay: false });

    const state = useStore.getState();
    expect(state.settings?.enableOverlay).toBe(false);
    expect(Storage.setSettings).toHaveBeenCalledWith(expect.objectContaining({
      enableOverlay: false
    }));
  });

});
