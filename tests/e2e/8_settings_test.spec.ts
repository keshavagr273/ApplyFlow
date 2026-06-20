import { test, expect } from './fixtures';

test.describe('ApplyFlow - Settings E2E', () => {
  test('should support toggling settings, syncing, exporting, and clearing data', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed initial settings in local storage
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            enableOverlay: true,
            isPremium: true,
            userEmail: 'testuser@gmail.com',
            userDisplayName: 'Test User',
            userAvatar: ''
          }
        }, resolve);
      });
    });

    // Reload page to populate store with the seeded settings
    await page.reload();

    // 1. Check Logged In Status on Options Header/Sync page
    await expect(page.locator('text=Test User')).toBeVisible();

    // Click General Settings tab
    await page.locator('aside button:has-text("General Settings")').click();
    await expect(page.locator('h2:has-text("General Settings")')).toBeVisible();

    // 2. Test Toggling Overlay Setting (it is a button with role="switch")
    const overlayToggle = page.getByRole('switch').first();
    await expect(overlayToggle).toHaveAttribute('aria-checked', 'true');
    await overlayToggle.click();
    await expect(overlayToggle).toHaveAttribute('aria-checked', 'false');

    // Click Account & Sync tab
    await page.locator('aside button:has-text("Account & Sync")').click();
    await expect(page.locator('h2:has-text("Google Account & Cloud Sync")')).toBeVisible();

    // 3. Test Sync Buttons
    // Push Sync
    await page.locator('button:has-text("Push to Cloud")').click();
    await expect(page.locator('text=Sync failed')).toBeVisible();
    
    // Pull Sync
    await page.locator('button:has-text("Pull from Cloud")').click();
    await expect(page.locator('text=Sync failed')).toBeVisible();

    // 4. Export JSON
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export Backup (JSON)")').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('ApplyFlow_Backup_');
    await download.cancel();

    // 5. Test Clear All Data
    const dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });
    await page.locator('button:has-text("Clear All Local Data")').click();
    expect(dialogMessages[0]).toContain('permanently delete ALL local profile');
  });
});
