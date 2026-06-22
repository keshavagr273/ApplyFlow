import { test, expect } from './fixtures';

async function setLoggedIn(page: any, email = 'user@gmail.com', name = 'Test User') {
  await page.evaluate(({ e, n }: { e: string; n: string }) => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: e,
          userDisplayName: n,
          userAvatar: '',
          isPremium: e === 'keshavagrawal273@gmail.com',
          enableOverlay: true,
          showClipButton: true,
          demoMode: false,
          supabaseUrl: 'https://lqddvilwmqthidjklghv.supabase.co',
          supabaseAnonKey: ''
        },
        profile: {
          name: n,
          email: e,
          phone: '9876543210',
          college: 'IIT Delhi',
          degree: 'B.Tech CS',
          graduationYear: '2025',
          skills: [],
          resumeLink: '',
          linkedinUrl: '',
          portfolioUrl: '',
          customAnswers: [],
          projects: [],
          workExperience: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }, resolve);
    });
  }, { e: email, n: name });
}

async function setLoggedOut(page: any) {
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          isPremium: false,
          enableOverlay: true,
          showClipButton: true,
          demoMode: false,
          supabaseUrl: '',
          supabaseAnonKey: ''
        }
      }, resolve);
    });
  });
}

test.describe('Auth Gate — Side Panel', () => {
  test('shows Sign In with Google button when logged out', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await setLoggedOut(page);
    await page.reload();

    // Sign In button should be visible directly in AuthGate
    const signInBtn = page.getByRole('button', { name: /Sign in with Google/i });
    await expect(signInBtn).toBeVisible();
  });

  test('shows user name and email when logged in', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await setLoggedIn(page, 'alice@gmail.com', 'Alice Smith');
    await page.reload();

    // Footer shows user name
    await expect(page.locator('text=Alice Smith')).toBeVisible();

    // Navigate to Profile tab to verify email
    await page.locator('button[title="Profile"]').click();
    await page.locator('button:has-text("Personal Info")').click();
    await expect(page.locator('input[type="email"]')).toHaveValue('alice@gmail.com');
  });

  test('logged in user sees main navigation tabs (Dashboard, Tracker, etc.)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await setLoggedIn(page, 'user@gmail.com', 'User');
    await page.reload();

    // Main nav should be visible when logged in
    await expect(page.locator('button[title="Dashboard"]')).toBeVisible();
    await expect(page.locator('button[title="Tracker"]')).toBeVisible();
    await expect(page.locator('button[title="AI Copilot"]')).toBeVisible();
    await expect(page.locator('button[title="Profile"]')).toBeVisible();
  });
});

test.describe('Auth Gate — Premium User Override', () => {
  test('keshavagrawal273@gmail.com is automatically premium', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await setLoggedIn(page, 'keshavagrawal273@gmail.com', 'Keshav Agrawal');
    await page.reload();

    // Click Account & Sync tab to check Premium status
    await page.locator('aside button:has-text("Account & Sync")').click();

    // Premium sync label should be visible
    await expect(page.locator('text=Google Cloud Sync Active')).toBeVisible();
  });
});

test.describe('Auth Gate — Options Page', () => {
  test('options page loads and shows navigation tabs', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('aside')).toBeVisible();
  });

  test('General Settings tab requires login - shows lock when logged out', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await setLoggedOut(page);
    await page.reload();

    // Click General Settings
    const generalTab = page.locator('aside button:has-text("General Settings")');
    if (await generalTab.isVisible()) {
      await generalTab.click();
      // Lock message should be visible (using first() to handle multiple text hits)
      const lockText = page.locator('text=Sign In Required').first();
      await expect(lockText).toBeVisible();
    }
  });
});

test.describe('Auth Gate — Settings Screen Sign Out', () => {
  test('logout button triggers confirmation and clears user session', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    await setLoggedIn(page, 'user@gmail.com', 'Regular User');
    await page.reload();

    // Setup dialog handler for sign out
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('sign out');
      await dialog.accept();
    });

    // Click Sign Out in the side panel footer
    const signOutBtn = page.getByRole('button', { name: /Sign Out/i });
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // After sign out, AuthGate should be visible
    await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible({ timeout: 5000 });
  });
});
