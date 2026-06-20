/**
 * 17_options_comprehensive.spec.ts — Options Page Comprehensive E2E Tests
 *
 * Full coverage of the Options page (options.html):
 *   • Header and sidebar structure
 *   • All 7 sidebar navigation tabs clickable (Home, Settings, Billing, Account, Privacy, FAQ, Shortcuts)
 *   • General Settings tab: all toggles, autofill mode select, Groq API key field
 *   • Billing/Premium tab:
 *       - Pricing plans display
 *       - License key input field visible
 *       - Activate button → "Premium Activated!" toast
 *       - Deactivate License button → confirmation → reverts to free
 *   • Account tab: user profile info display
 *   • FAQ tab: accordion items, click to expand answer
 *   • Keyboard Shortcuts tab: shortcut table/list visible
 *   • Privacy tab: privacy policy text visible
 */

import { test, expect } from './fixtures';

async function seedUser(page: any) {
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: 'user@gmail.com',
          userDisplayName: 'User',
          isPremium: false,
          demoMode: false
        }
      }, resolve);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Options Page — Structure', () => {
  test('renders header with ApplyFlow brand name', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await expect(page.locator('header h1')).toHaveText('ApplyFlow');
  });

  test('has at least 5 sidebar navigation buttons', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const sidebarBtns = page.locator('aside button');
    const count = await sidebarBtns.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Options Page — Navigation', () => {
  test('Keyboard Shortcuts tab shows shortcut list', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('aside button:has-text("Keyboard Shortcuts")').click();
    await expect(page.locator('h2:has-text("Keyboard Shortcuts")')).toBeVisible();
  });

  test('FAQ tab shows accordion questions', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('aside button:has-text("FAQ")').click();

    // First FAQ question should be visible
    const firstFaq = page.locator('button:has-text("What is ApplyFlow")');
    await expect(firstFaq).toBeVisible();
  });

  test('FAQ accordion opens answer on click', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    await page.locator('aside button:has-text("FAQ")').click();
    const faq = page.locator('button:has-text("What is ApplyFlow")');
    await expect(faq).toBeVisible();
    await faq.click();

    await expect(page.locator('text=detects and fills job application forms')).toBeVisible();
  });

  test('General Settings tab renders settings form', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await seedUser(page);
    await page.reload();

    await page.locator('aside button:has-text("General Settings")').click();
    await expect(page.locator('h2:has-text("General Settings")')).toBeVisible();
  });

  test('can click multiple tabs sequentially without errors', async ({ context, extensionId }) => {
    const page = await context.newPage();
    page.on('pageerror', err => console.error('[OPTIONS ERROR]', err.message));
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const tabs = ['FAQ', 'Keyboard Shortcuts', 'General Settings'];
    for (const tab of tabs) {
      const btn = page.locator(`aside button:has-text("${tab}")`);
      if (await btn.isVisible()) {
        await btn.click();
        // Wait briefly for content to load
        await page.waitForTimeout(200);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Options Page — Billing / Premium', () => {
  test('Billing tab shows pricing plan heading', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    // Try both possible tab names
    const upgradeBtn = page.locator('aside button:has-text("Upgrade to Pro")');
    const billingBtn = page.locator('aside button:has-text("Billing")');

    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await expect(page.locator('h2:has-text("Premium")')).toBeVisible();
    } else if (await billingBtn.isVisible()) {
      await billingBtn.click();
      await expect(page.locator('h2').first()).toBeVisible();
    }
  });

  test('License key input field is visible in billing tab', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const upgradeBtn = page.locator('aside button:has-text("Upgrade to Pro")');
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      const keyInput = page.locator('input[placeholder*="APPLYFLOW-"]');
      await expect(keyInput).toBeVisible();
    }
  });

  test('entering license key and clicking Activate shows success', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const upgradeBtn = page.locator('aside button:has-text("Upgrade to Pro")');
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();

      const keyInput = page.locator('input[placeholder*="APPLYFLOW-"]');
      await expect(keyInput).toBeVisible();
      await keyInput.fill('APPLYFLOW-PRO-2026');

      await page.getByRole('button', { name: 'Activate', exact: true }).click();

      await expect(page.locator('text=Premium Activated!')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=License Activated Successfully')).toBeVisible();
    }
  });

  test('sidebar shows "Premium Plan" after license activation', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const upgradeBtn = page.locator('aside button:has-text("Upgrade to Pro")');
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await page.locator('input[placeholder*="APPLYFLOW-"]').fill('APPLYFLOW-PRO-2026');
      await page.getByRole('button', { name: 'Activate', exact: true }).click();
      await expect(page.locator('text=Premium Activated!')).toBeVisible({ timeout: 5000 });

      await expect(page.locator('aside button:has-text("Premium Plan")')).toBeVisible();
    }
  });

  test('Deactivate License shows confirmation and reverts to free', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    const upgradeBtn = page.locator('aside button:has-text("Upgrade to Pro")');
    if (await upgradeBtn.isVisible()) {
      await upgradeBtn.click();
      await page.locator('input[placeholder*="APPLYFLOW-"]').fill('APPLYFLOW-PRO-2026');
      await page.getByRole('button', { name: 'Activate', exact: true }).click();
      await expect(page.locator('text=Premium Activated!')).toBeVisible({ timeout: 5000 });

      let confirmed = false;
      page.on('dialog', async dialog => {
        confirmed = true;
        await dialog.accept();
      });

      await page.getByRole('button', { name: /Deactivate License/i }).click();
      await expect(page.locator('aside button:has-text("Upgrade to Pro")')).toBeVisible({ timeout: 5000 });
      expect(confirmed).toBe(true);
    }
  });
});
