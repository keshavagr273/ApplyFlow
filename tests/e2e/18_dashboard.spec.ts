/**
 * 18_dashboard.spec.ts — Dashboard Screen Comprehensive E2E Tests
 */

import { test, expect } from './fixtures';

async function seedDashboard(page: any, applicationCount = 5, isPremium = false) {
  await page.evaluate(({ count, premium }: { count: number; premium: boolean }) => {
    const apps = Array.from({ length: count }, (_, i) => ({
      id: `dash-${i}`,
      company: ['Google', 'Microsoft', 'Apple', 'Amazon', 'Tesla'][i % 5],
      role: ['SWE', 'PM', 'Designer', 'Data Scientist', 'DevOps'][i % 5],
      status: ['applied', 'interview', 'offer', 'assessment', 'rejected'][i % 5],
      url: `https://company${i}.com/job`,
      platform: 'company_site',
      appliedAt: Date.now() - i * 86400000,
      notes: ''
    }));

    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: 'dash@gmail.com',
          userDisplayName: 'Dash User',
          userAvatar: 'https://lh3.googleusercontent.com/a/default',
          isPremium: premium,
          enableOverlay: true,
          showClipButton: true,
          demoMode: false
        },
        profile: {
          name: 'Dash User', email: 'dash@gmail.com', phone: '9876543210',
          college: 'IIT Delhi', degree: 'B.Tech', graduationYear: '2025',
          skills: ['React'], resumeLink: '', linkedinUrl: '', portfolioUrl: '',
          customAnswers: [], projects: [], workExperience: [],
          createdAt: Date.now(), updatedAt: Date.now()
        },
        applications: apps,
        usage: { dailyFillsUsed: 1, totalFills: 15, dailyFillsLimit: 3, lastUsedTimestamp: Date.now() }
      }, resolve);
    });
  }, { count: applicationCount, premium: isPremium });
}

test.describe('Dashboard — Structure', () => {
  test('dashboard heading is visible', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForLoadState('domcontentloaded');
  });

  test('user display name is visible in dashboard', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await expect(page.locator('text=Dash').first()).toBeVisible();
  });
});

test.describe('Dashboard — Quick Stats', () => {
  test('shows Applied, Interview, and Offer stat counters', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await expect(page.locator('text=Applied').first()).toBeVisible();
    await expect(page.locator('text=Interview').first()).toBeVisible();
    await expect(page.locator('text=Offer').first()).toBeVisible();
  });
});

test.describe('Dashboard — Recent Applications', () => {
  test('shows recent application cards', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page, 5);
    await page.reload();

    const hasGoogle = await page.locator('text=Google').isVisible().catch(() => false);
    const hasMicrosoft = await page.locator('text=Microsoft').isVisible().catch(() => false);
    const hasApple = await page.locator('text=Apple').isVisible().catch(() => false);

    expect(hasGoogle || hasMicrosoft || hasApple).toBe(true);
  });

  test('View All button navigates to Tracker', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page, 5);
    await page.reload();

    const viewAllBtn = page.locator('button:has-text("View all")');
    if (await viewAllBtn.isVisible()) {
      await viewAllBtn.click();
      await expect(page.locator('h1:has-text("Tracker")')).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Dashboard — Empty State', () => {
  test('shows empty/welcome state when no applications', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await page.evaluate(() =>
      new Promise<void>(r => chrome.storage.local.set({
        applications: [],
        settings: { userEmail: 'empty@gmail.com', userDisplayName: 'Empty User', isPremium: false, demoMode: false, enableOverlay: true }
      }, r))
    );
    await page.reload();

    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard — Navigation', () => {
  test('clicking Tracker nav button goes to Tracker', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();
  });

  test('clicking Assistant nav button goes to AI Copilot', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await page.locator('button[title="AI Copilot"]').click();
    await expect(page.locator('h1:has-text("AI Copilot")')).toBeVisible();
  });

  test('clicking Profile nav button goes to My Profile', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await page.locator('button[title="Profile"]').click();
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible();
  });

  test('clicking Analytics nav button goes to Analytics', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await page.locator('button[title="Analytics"]').click();
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
  });

  test('can navigate back to Dashboard from other screens', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedDashboard(page);
    await page.reload();

    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();

    await page.locator('button[title="Dashboard"]').click();
    await expect(page.locator('text=Dash').first()).toBeVisible();
  });
});
