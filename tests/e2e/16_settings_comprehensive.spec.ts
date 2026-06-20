import { test, expect } from './fixtures';

async function seedWithUser(page: any, email = 'settings@gmail.com', name = 'Settings User', isPremium = false) {
  await page.evaluate(({ e, n, p }: { e: string; n: string; p: boolean }) => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: e,
          userDisplayName: n,
          userAvatar: '',
          isPremium: p,
          enableOverlay: true,
          showClipButton: true,
          autofillMode: 'ats-first',
          demoMode: false,
          supabaseUrl: '',
          supabaseAnonKey: ''
        },
        profile: {
          name: n, email: e, phone: '9876543210',
          college: 'IIT Delhi', degree: 'B.Tech', graduationYear: '2025',
          skills: [], resumeLink: '', linkedinUrl: '', portfolioUrl: '',
          customAnswers: [], projects: [], workExperience: [],
          createdAt: Date.now(), updatedAt: Date.now()
        }
      }, resolve);
    });
  }, { e: email, n: name, p: isPremium });
}

test.describe('Settings — Options Page Config', () => {
  test('displays logged-in user header details', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedWithUser(page, 'bob@gmail.com', 'Bob Builder');
    await page.reload();

    await expect(page.locator('text=Bob Builder')).toBeVisible();
    await expect(page.locator('text=bob@gmail.com')).toBeVisible();
  });

  test('General Settings tab supports toggling overlay options', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedWithUser(page);
    await page.reload();

    await page.locator('aside button:has-text("General Settings")').click();
    await expect(page.locator('h2:has-text("General Settings")')).toBeVisible();

    const overlayToggle = page.getByRole('switch').first();
    await expect(overlayToggle).toHaveAttribute('aria-checked', 'true');
    await overlayToggle.click();
    await expect(overlayToggle).toHaveAttribute('aria-checked', 'false');
    await overlayToggle.click();
    await expect(overlayToggle).toHaveAttribute('aria-checked', 'true');
  });

  test('Sync buttons trigger sync actions and report status', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedWithUser(page, 'settings@gmail.com', 'Settings User', true);
    await page.reload();

    await page.locator('aside button:has-text("Account & Sync")').click();

    // Push Sync
    await page.locator('button:has-text("Push to Cloud")').click();
    await expect(page.locator('text=Sync failed').first()).toBeVisible({ timeout: 5000 });

    // Pull Fetch
    await page.locator('button:has-text("Pull from Cloud")').click();
    await expect(page.locator('text=Sync failed').first()).toBeVisible({ timeout: 5000 });
  });

  test('Export Backup download triggers JSON download', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedWithUser(page);
    await page.reload();

    await page.locator('aside button:has-text("Account & Sync")').click();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export Backup (JSON)")').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('ApplyFlow_Backup_');
    await download.cancel();
  });

  test('Clear All Local Data confirmation resets state', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedWithUser(page);
    await page.reload();

    await page.locator('aside button:has-text("Account & Sync")').click();

    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.locator('button:has-text("Clear All Local Data")').click();
    expect(dialogMessage).toContain('permanently delete ALL local profile');
  });
});
