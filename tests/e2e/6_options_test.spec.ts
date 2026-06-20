import { test, expect } from './fixtures';
import { Dialog } from '@playwright/test';

test.describe('ApplyFlow - Options Page E2E', () => {
  test('should verify options panel layout, navigation, settings, and license activation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    // Seed logged-in user in storage
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'testuser@gmail.com',
            userDisplayName: 'Test User',
            userAvatar: '',
            isPremium: false,
            theme: 'dark'
          }
        }, resolve);
      });
    });

    await page.reload();

    // Verify header and sidebar are visible
    await expect(page.locator('header h1')).toHaveText('ApplyFlow');
    await expect(page.locator('aside button')).toHaveCount(7); // Home, Settings, Billing, Account, Privacy, FAQ, Shortcuts

    // 1. Navigation Check
    // Click keyboard shortcuts tab
    await page.locator('aside button:has-text("Keyboard Shortcuts")').click();
    await expect(page.locator('h2:has-text("Keyboard Shortcuts")')).toBeVisible();

    // Click FAQ tab
    await page.locator('aside button:has-text("FAQ")').click();
    const firstFaq = page.locator('button:has-text("What is ApplyFlow")');
    await expect(firstFaq).toBeVisible();
    await firstFaq.click();
    await expect(page.locator('text=detects and fills job application forms')).toBeVisible();

    // Click General Settings tab
    await page.locator('aside button:has-text("General Settings")').click();
    await expect(page.locator('h2:has-text("General Settings")')).toBeVisible();

    // 2. Billing / Premium License Activation Flow
    await page.locator('aside button:has-text("Upgrade to Pro")').click();
    await expect(page.locator('h2:has-text("Premium Upgrade Plan")')).toBeVisible();

    // Input demo license key and click Activate
    const keyInput = page.locator('input[placeholder*="APPLYFLOW-"]');
    await expect(keyInput).toBeVisible();
    await keyInput.fill('APPLYFLOW-PRO-2026');

    await page.getByRole('button', { name: 'Activate', exact: true }).click();

    // Verify loading and success triggers
    await expect(page.locator('text=Premium Activated!')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=License Activated Successfully')).toBeVisible();

    // Sidebar tab should now read "Premium Plan" instead of "Upgrade to Pro"
    await expect(page.locator('aside button:has-text("Premium Plan")')).toBeVisible();

    // 3. License Deactivation Flow
    let confirmDeactivate = false;
    const deactivationDialogHandler = async (dialog: Dialog) => {
      confirmDeactivate = true;
      await dialog.accept(); // Confirms deactivation
    };
    page.on('dialog', deactivationDialogHandler);

    await page.getByRole('button', { name: /Deactivate License/i }).click();
    await expect(page.locator('aside button:has-text("Upgrade to Pro")')).toBeVisible({ timeout: 5000 });
    expect(confirmDeactivate).toBe(true);

    page.off('dialog', deactivationDialogHandler);
  });
});
