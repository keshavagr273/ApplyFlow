import { test, expect } from './fixtures';

test.describe('ApplyFlow - Database, Sync & Settings E2E', () => {
  test('should display secure cloud sync triggers and support backup actions', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed logged-in premium user in storage
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'testuser@gmail.com',
            userDisplayName: 'Test User',
            userAvatar: '',
            isPremium: true,
            theme: 'dark'
          }
        }, resolve);
      });
    });

    await page.reload();

    // Navigate to Account & Sync Screen
    await page.locator('aside button:has-text("Account & Sync")').click();
    await expect(page.locator('h2:has-text("Google Account & Cloud Sync")')).toBeVisible();

    // 1. Google OAuth Authentication check
    // Verified via seed, user should be shown as logged in
    await expect(page.locator('text=Test User').first()).toBeVisible();
    await expect(page.locator('text=testuser@gmail.com').first()).toBeVisible();

    // 2. Export JSON Backup trigger check
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export Backup \(JSON\)/i }).click()
    ]);
    expect(download.suggestedFilename()).toContain('ApplyFlow_Backup_');

    // 3. Clear Local Data operation
    const dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept(); // Confirms data clear
    });

    await page.getByRole('button', { name: /Clear All Local Data/i }).click();
    
    // Expect the first dialog to be the warning confirmation
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    expect(dialogMessages[0]).toContain('delete ALL local profile');
  });
});
