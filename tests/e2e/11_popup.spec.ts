import { test, expect } from './fixtures';

async function seedProfile(page: any, email = 'testuser@gmail.com') {
  await page.evaluate((e: string) => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: e,
          userDisplayName: 'Test User',
          userAvatar: '',
          isPremium: false,
          enableOverlay: true,
          showClipButton: true,
          demoMode: false
        },
        profile: {
          name: 'Test User',
          email: e,
          phone: '9876543210',
          college: 'IIT Delhi',
          degree: 'B.Tech CS',
          graduationYear: '2025',
          skills: ['React', 'TypeScript'],
          resumeLink: 'https://drive.google.com/test',
          linkedinUrl: 'https://linkedin.com/in/test',
          portfolioUrl: 'https://test.dev',
          customAnswers: [],
          projects: [],
          workExperience: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        applications: [
          { id: 'a1', company: 'Google', role: 'SWE', status: 'applied', url: 'https://g.co', platform: 'company_site', appliedAt: Date.now(), notes: '' },
          { id: 'a2', company: 'Meta', role: 'Frontend', status: 'interview', url: 'https://m.co', platform: 'company_site', appliedAt: Date.now(), notes: '' },
          { id: 'a3', company: 'Stripe', role: 'Backend', status: 'offer', url: 'https://s.co', platform: 'company_site', appliedAt: Date.now(), notes: '' },
        ]
      }, resolve);
    });
  }, email);
}

test.describe('MiniPopup — Initial State', () => {
  test('renders popup with stats cards and Open Sidebar button', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await seedProfile(page);
    await page.reload();

    // Stats counters
    await expect(page.locator('text=Applied').first()).toBeVisible();
    await expect(page.locator('text=Interview').first()).toBeVisible();
    await expect(page.locator('text=Offer').first()).toBeVisible();

    // Open Sidebar button
    const openBtn = page.getByRole('button', { name: /Open Sidebar/i });
    await expect(openBtn).toBeVisible();
  });

  test('shows correct stats counts from applications', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await seedProfile(page);
    await page.reload();

    // 1 applied, 1 interview, 1 offer in our seed data
    await expect(page.locator('text=1').first()).toBeVisible();
  });
});

test.describe('MiniPopup — Auth Gate for Quick Autofill', () => {
  test('shows alert and blocks autofill when user not logged in', async ({ context, extensionId }) => {
    const page = await context.newPage();

    await page.addInitScript(() => {
      const mockQuery = (queryInfo: any, callback: any) => {
        callback([{
          id: 123,
          url: 'https://www.linkedin.com/jobs/view/123/',
          title: 'Software Engineer | LinkedIn'
        }]);
      };
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query = mockQuery as any;
      } else {
        (window as any).chrome = (window as any).chrome || {};
        (window as any).chrome.tabs = (window as any).chrome.tabs || {};
        (window as any).chrome.tabs.query = mockQuery;
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // No userEmail in settings = logged out
    await page.evaluate(() =>
      new Promise<void>(r => chrome.storage.local.set({ settings: { isPremium: false } }, r))
    );
    await page.reload();

    // Intercept alert
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.dismiss();
    });

    const autofillBtn = page.getByRole('button', { name: /Quick Autofill/i });
    await expect(autofillBtn).toBeVisible();
    await autofillBtn.click();
    expect(alertMessage).toContain('sign in');
  });
});

test.describe('MiniPopup — Platform Detection Display', () => {
  test('shows platform badge for LinkedIn URL', async ({ context, extensionId }) => {
    const page = await context.newPage();

    await page.addInitScript(() => {
      const mockQuery = (queryInfo: any, callback: any) => {
        callback([{
          id: 123,
          url: 'https://www.linkedin.com/jobs/view/123/',
          title: 'Software Engineer | LinkedIn'
        }]);
      };
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query = mockQuery as any;
      } else {
        (window as any).chrome = (window as any).chrome || {};
        (window as any).chrome.tabs = (window as any).chrome.tabs || {};
        (window as any).chrome.tabs.query = mockQuery;
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.reload();

    // LinkedIn Detected badge should be visible
    await expect(page.locator('text=LinkedIn Detected')).toBeVisible();
  });
});
