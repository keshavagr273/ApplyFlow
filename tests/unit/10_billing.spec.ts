import { beforeEach, describe, expect, test, vi } from 'vitest';
import { SubscriptionPlan, UserBilling } from '../../src/shared/types';

// ── Chrome mock ──────────────────────────────────────────────────────────────
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

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Import Storage after defining mocks
import { Storage } from '../../src/shared/storage';

describe('Billing & Credit System Unit Tests', () => {
  beforeEach(() => {
    // Reset local mock store
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  describe('getUserBilling API', () => {
    test('should return Free plan with 10 trial credits initially for non-premium user', async () => {
      mockStorage['settings'] = {
        isPremium: false,
        userEmail: 'free@test.com'
      };

      const billing = await Storage.getUserBilling();
      expect(billing.plan).toBe('free');
      expect(billing.creditsAllocated).toBe(10);
      expect(billing.creditsUsed).toBe(0);
      expect(billing.premiumUntil).toBeNull();
    });

    test('should return Pro Monthly plan with 150 credits for standard premium user', async () => {
      mockStorage['settings'] = {
        isPremium: true,
        userEmail: 'pro@test.com',
        licenseKey: 'STANDARD-KEY'
      };

      const billing = await Storage.getUserBilling();
      expect(billing.plan).toBe('pro_monthly');
      expect(billing.creditsAllocated).toBe(150);
      expect(billing.creditsUsed).toBe(0);
      expect(billing.premiumUntil).toBeGreaterThan(Date.now());
    });

    test('should return Ultimate Yearly plan with 2500 credits for grandfathered license key', async () => {
      mockStorage['settings'] = {
        isPremium: true,
        userEmail: 'ultimate@test.com',
        licenseKey: 'APPLYFLOW-PRO-2026'
      };

      const billing = await Storage.getUserBilling();
      expect(billing.plan).toBe('ultimate_yearly');
      expect(billing.creditsAllocated).toBe(2500);
      expect(billing.creditsUsed).toBe(0);
    });

    test('should sync billing details from Supabase if sync is enabled', async () => {
      mockStorage['settings'] = {
        isPremium: true,
        supabaseSyncEnabled: true,
        userEmail: 'sync@test.com',
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'anon-key'
      };

      const supabaseMockData = [{
        user_email: 'sync@test.com',
        plan: 'pro_monthly',
        credits_allocated: 150,
        credits_used: 42,
        credits_purchased: 20,
        premium_until: 1800000000000,
        subscription_status: 'active'
      }];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => supabaseMockData
      });

      const billing = await Storage.getUserBilling();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/rest/v1/user_billing?user_email=eq.sync%40test.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            apikey: 'anon-key'
          })
        })
      );

      expect(billing.plan).toBe('pro_monthly');
      expect(billing.creditsAllocated).toBe(150);
      expect(billing.creditsUsed).toBe(42);
      expect(billing.creditsPurchased).toBe(20);
      expect(billing.premiumUntil).toBe(1800000000000);
      expect(billing.subscriptionStatus).toBe('active');

      // Local storage must be cached
      const cached = mockStorage['billing'] as UserBilling;
      expect(cached.creditsUsed).toBe(42);
    });
  });

  describe('deductCredits API', () => {
    test('should return true immediately and do nothing if cost <= 0', async () => {
      const result = await Storage.deductCredits(0, 'any_feature');
      expect(result).toBe(true);
      expect(mockStorage['billing']).toBeUndefined();
    });

    test('should succeed and deduct credits locally when user has sufficient balance', async () => {
      mockStorage['settings'] = {
        isPremium: false,
        userEmail: 'local@test.com'
      };

      // Set user billing to have 10 allocated credits, 2 used
      mockStorage['billing'] = {
        userEmail: 'local@test.com',
        plan: 'free',
        creditsAllocated: 10,
        creditsUsed: 2,
        creditsPurchased: 0,
        premiumUntil: null,
        subscriptionStatus: 'active'
      };

      const success = await Storage.deductCredits(3, 'cover_letter');
      expect(success).toBe(true);

      const updatedBilling = mockStorage['billing'] as UserBilling;
      expect(updatedBilling.creditsUsed).toBe(5); // 2 + 3

      // Transaction log verification
      const transactions = mockStorage['transactions'];
      expect(transactions).toBeDefined();
      expect(transactions).toHaveLength(1);
      expect(transactions[0].feature).toBe('cover_letter');
      expect(transactions[0].credits_deducted).toBe(3);
    });

    test('should fail and not deduct credits when user has insufficient balance', async () => {
      mockStorage['settings'] = {
        isPremium: false,
        userEmail: 'local@test.com'
      };

      mockStorage['billing'] = {
        userEmail: 'local@test.com',
        plan: 'free',
        creditsAllocated: 10,
        creditsUsed: 9,
        creditsPurchased: 0,
        premiumUntil: null,
        subscriptionStatus: 'active'
      };

      const success = await Storage.deductCredits(5, 'cover_letter');
      expect(success).toBe(false);

      const billing = mockStorage['billing'] as UserBilling;
      expect(billing.creditsUsed).toBe(9); // Unchanged
    });

    test('should invoke Supabase RPC and log transaction when sync is enabled', async () => {
      mockStorage['settings'] = {
        isPremium: true,
        supabaseSyncEnabled: true,
        userEmail: 'supabase@test.com',
        supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
        supabaseAnonKey: 'anon-key'
      };

      mockStorage['billing'] = {
        userEmail: 'supabase@test.com',
        plan: 'pro_monthly',
        creditsAllocated: 150,
        creditsUsed: 10,
        creditsPurchased: 0,
        premiumUntil: 1800000000000,
        subscriptionStatus: 'active'
      };

      // Mock 1st Fetch: getUserBilling calling user_billing table
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          user_email: 'supabase@test.com',
          plan: 'pro_monthly',
          credits_allocated: 150,
          credits_used: 10,
          credits_purchased: 0,
          premium_until: 1800000000000,
          subscription_status: 'active'
        }]
      });

      // Mock 2nd Fetch: deductCredits calling /rpc/atomic_deduct_credits endpoint
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => true
      });

      // Mock 3rd Fetch: deductCredits calling callSupabase on credit_transactions
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => 'true'
      });

      const success = await Storage.deductCredits(10, 'resume_optimization');
      expect(success).toBe(true);

      // Verify user_billing fetch call was first
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'https://lqddvilwmqthidjklghv.supabase.co/rest/v1/user_billing?user_email=eq.supabase%40test.com',
        expect.any(Object)
      );

      // Verify RPC call was second
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'https://lqddvilwmqthidjklghv.supabase.co/rpc/atomic_deduct_credits',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            p_email: 'supabase@test.com',
            p_cost: 10
          })
        })
      );

      // Verify Transaction sync call was third
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'https://lqddvilwmqthidjklghv.supabase.co/rest/v1/credit_transactions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"credits_deducted":10')
        })
      );

      // Verify local cache is also updated
      const billing = mockStorage['billing'] as UserBilling;
      expect(billing.creditsUsed).toBe(20); // 10 + 10
    });

    test('should fail if Supabase RPC returns false', async () => {
      mockStorage['settings'] = {
        isPremium: true,
        supabaseSyncEnabled: true,
        userEmail: 'supabase@test.com',
        supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
        supabaseAnonKey: 'anon-key'
      };

      mockStorage['billing'] = {
        userEmail: 'supabase@test.com',
        plan: 'pro_monthly',
        creditsAllocated: 150,
        creditsUsed: 145,
        creditsPurchased: 0,
        premiumUntil: 1800000000000,
        subscriptionStatus: 'active'
      };

      // Mock 1st Fetch: getUserBilling calling user_billing table
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          user_email: 'supabase@test.com',
          plan: 'pro_monthly',
          credits_allocated: 150,
          credits_used: 145,
          credits_purchased: 0,
          premium_until: 1800000000000,
          subscription_status: 'active'
        }]
      });

      // Mock 2nd Fetch: deductCredits calling /rpc/atomic_deduct_credits endpoint
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => false
      });

      const success = await Storage.deductCredits(10, 'resume_optimization');
      expect(success).toBe(false);

      // Verify local cache remained unchanged
      const billing = mockStorage['billing'] as UserBilling;
      expect(billing.creditsUsed).toBe(145);
    });
  });
});
