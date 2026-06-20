import { test, expect } from './fixtures';

test.describe('ApplyFlow - Job Tracker E2E', () => {
  test('should support viewing, updating, and deleting tracked applications', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Add console logging listeners for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);

    // Seed initial applications and logged-in user in local storage
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'trackeruser@gmail.com',
            userDisplayName: 'Tracker User',
            isPremium: true,
            theme: 'dark'
          },
          applications: [
            {
              id: 'app-1',
              company: 'Google',
              role: 'Software Engineer',
              status: 'applied',
              url: 'https://careers.google.com/test',
              location: 'Mountain View, CA',
              salary: '$150k - $200k',
              appliedAt: Date.now() - 86400000, // 1 day ago
              notes: 'Referral from John.',
              jobDescription: 'Software engineer role'
            },
            {
              id: 'app-2',
              company: 'Meta',
              role: 'Frontend Engineer',
              status: 'interview',
              url: 'https://meta.com/careers/test',
              location: 'Menlo Park, CA',
              salary: '',
              appliedAt: Date.now() - 5 * 86400000, // 5 days ago
              notes: '',
              jobDescription: 'Frontend developer role'
            }
          ]
        }, resolve);
      });
    });

    // Reload page to populate store with the seeded applications
    await page.reload();

    // Navigate to Tracker Screen
    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();

    // 1. Verify list shows seeded data
    const googleCard = page.locator('.bg-surface-dark100:has-text("Google")');
    await expect(googleCard).toBeVisible();
    await expect(googleCard.locator('text=Software Engineer')).toBeVisible();
    await expect(googleCard.locator('text=applied')).toBeVisible();

    const metaCard = page.locator('.bg-surface-dark100:has-text("Meta")');
    await expect(metaCard).toBeVisible();
    await expect(metaCard.locator('text=Frontend Engineer')).toBeVisible();
    await expect(metaCard.locator('text=interview')).toBeVisible();

    // 2. Test Filtering using Status Chips
    await page.locator('button:has-text("Interview")').click();
    await expect(googleCard).not.toBeVisible();
    await expect(metaCard).toBeVisible();

    // Reset filter
    await page.locator('button:has-text("All")').first().click();
    await expect(googleCard).toBeVisible();
    await expect(metaCard).toBeVisible();

    // 3. Open Detail Sheet and Update Information
    await googleCard.click();
    
    // Check Sheet contents
    await expect(page.locator('.fixed').getByText('Google').first()).toBeVisible();
    await expect(page.locator('.fixed').getByText('Software Engineer').first()).toBeVisible();

    // Change status to 'Assessment'
    await page.locator('.fixed button:has-text("Assessment")').click();

    // Update notes
    await page.fill('.fixed textarea[placeholder*="Add notes"]', 'Referral from John. Completed assessment.');

    // Save the changes
    await page.locator('.fixed').getByRole('button', { name: 'Save', exact: true }).click();
    
    // Verify sheet is closed
    await expect(page.locator('.fixed').getByText('Google')).not.toBeVisible();

    // Check updated card status in list
    await expect(googleCard.locator('text=assessment')).toBeVisible();

    // 4. Delete Application Log
    await metaCard.click();
    
    // Override dialog to accept deletion
    page.on('dialog', async dialog => {
      expect(dialog.message()).toBe('Delete this application?');
      await dialog.accept();
    });
    
    await page.locator('.fixed button:has-text("Delete")').click();
    
    // Modal should close and card should disappear
    await expect(page.locator('.fixed div.text-base:has-text("Meta")')).not.toBeVisible();
    await expect(metaCard).not.toBeVisible();
  });
});
