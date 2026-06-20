import { test, expect } from './fixtures';

async function seedApplications(page: any) {
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: 'tracker@gmail.com',
          userDisplayName: 'Tracker User',
          isPremium: true,
          demoMode: false,
          enableOverlay: true,
          theme: 'dark'
        },
        profile: {
          name: 'Tracker User', email: 'tracker@gmail.com', phone: '9876543210',
          college: 'IIT Delhi', degree: 'B.Tech', graduationYear: '2025',
          skills: ['React'], resumeLink: '', linkedinUrl: '', portfolioUrl: '',
          customAnswers: [], projects: [], workExperience: [],
          createdAt: Date.now(), updatedAt: Date.now()
        },
        applications: [
          {
            id: 'tr-1', company: 'Google', role: 'Software Engineer', status: 'applied',
            url: 'https://careers.google.com/test', platform: 'company_site',
            appliedAt: Date.now() - 86400000, notes: 'Great opportunity.',
            location: 'Mountain View, CA', salary: '$180k', contactName: '', contactEmail: ''
          },
          {
            id: 'tr-2', company: 'Meta', role: 'Frontend Engineer', status: 'interview',
            url: 'https://meta.com/careers/test', platform: 'company_site',
            appliedAt: Date.now() - 3 * 86400000, notes: '',
            location: 'Menlo Park, CA', salary: '', contactName: 'Jane Doe', contactEmail: 'jane@meta.com'
          },
          {
            id: 'tr-3', company: 'Stripe', role: 'Backend Developer', status: 'assessment',
            url: 'https://stripe.com/jobs/test', platform: 'company_site',
            appliedAt: Date.now() - 5 * 86400000, notes: 'Had coding test.',
            location: 'San Francisco', salary: '$160k', contactName: '', contactEmail: ''
          },
          {
            id: 'tr-4', company: 'Figma', role: 'Product Designer', status: 'offer',
            url: 'https://figma.com/careers', platform: 'company_site',
            appliedAt: Date.now() - 10 * 86400000, notes: 'Offer received!',
            location: 'Remote', salary: '$150k', contactName: '', contactEmail: ''
          },
          {
            id: 'tr-5', company: 'Twitter', role: 'SRE', status: 'rejected',
            url: 'https://twitter.com/jobs', platform: 'company_site',
            appliedAt: Date.now() - 15 * 86400000, notes: 'Was not selected.',
            location: 'Remote', salary: '', contactName: '', contactEmail: ''
          }
        ]
      }, resolve);
    });
  });
}

test.describe('Tracker — List View & Filtering', () => {
  test('shows all seeded applications and respects filters & search', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedApplications(page);
    await page.reload();

    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();

    // 1. All 5 companies must appear
    const googleCard = page.locator('.bg-surface-dark100:has-text("Google")');
    const metaCard = page.locator('.bg-surface-dark100:has-text("Meta")');
    const stripeCard = page.locator('.bg-surface-dark100:has-text("Stripe")');
    const figmaCard = page.locator('.bg-surface-dark100:has-text("Figma")');
    const twitterCard = page.locator('.bg-surface-dark100:has-text("Twitter")');

    await expect(googleCard).toBeVisible();
    await expect(metaCard).toBeVisible();
    await expect(stripeCard).toBeVisible();
    await expect(figmaCard).toBeVisible();
    await expect(twitterCard).toBeVisible();

    // 2. Status chips display correct labels
    await expect(googleCard.locator('text=applied')).toBeVisible();
    await expect(metaCard.locator('text=interview')).toBeVisible();

    // 3. Filter using Status Chips (Interview)
    await page.locator('button:has-text("Interview")').first().click();
    await expect(metaCard).toBeVisible();
    await expect(googleCard).not.toBeVisible();
    await expect(stripeCard).not.toBeVisible();

    // 4. Reset to "All"
    await page.locator('button:has-text("All")').first().click();
    await expect(googleCard).toBeVisible();
    await expect(metaCard).toBeVisible();

    // 5. Search filters cards by company text
    await page.fill('input[placeholder="Filter by company..."]', 'Figma');
    await expect(figmaCard).toBeVisible();
    await expect(googleCard).not.toBeVisible();
    await expect(metaCard).not.toBeVisible();

    // Clear search
    await page.fill('input[placeholder="Filter by company..."]', '');
    await expect(googleCard).toBeVisible();
  });
});

test.describe('Tracker — Detail Sheet', () => {
  test('opens detail sheet on card click, supports edits and deletion', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedApplications(page);
    await page.reload();

    await page.locator('button[title="Tracker"]').click();
    
    const googleCard = page.locator('.bg-surface-dark100:has-text("Google")');
    await googleCard.click();

    // 1. Sheet shows company and role
    const sheet = page.locator('.fixed');
    await expect(sheet.getByText('Google').first()).toBeVisible();
    await expect(sheet.getByText('Software Engineer').first()).toBeVisible();
    await expect(sheet.locator('text=$180k')).toBeVisible();

    // 2. Edit notes, status, and reminder
    await page.locator('.fixed button:has-text("Assessment")').click();
    await page.fill('.fixed textarea[placeholder*="Add notes"]', 'Updated notes: Round 2 scheduled.');
    
    // Fill reminder date
    await page.fill('.fixed input[type="datetime-local"]', '2026-06-25T14:30');

    // Click Save
    await page.locator('.fixed').getByRole('button', { name: 'Save', exact: true }).click();

    // Check updated card status in list
    await expect(googleCard.locator('text=assessment')).toBeVisible();

    // 3. Delete application
    const twitterCard = page.locator('.bg-surface-dark100:has-text("Twitter")');
    await twitterCard.click();

    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Delete this application?');
      await dialog.accept();
    });

    await page.locator('.fixed button:has-text("Delete")').click();

    // Card should be gone
    await expect(twitterCard).not.toBeVisible();
  });
});

test.describe('Tracker — Empty State', () => {
  test('shows empty state message when no applications', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await page.evaluate(() =>
      new Promise<void>(r => chrome.storage.local.set({
        applications: [],
        settings: { userEmail: 'user@test.com', isPremium: false, demoMode: false }
      }, r))
    );
    await page.reload();

    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();

    // Empty state should show "No applications found"
    await expect(page.locator('text=No applications found')).toBeVisible();
  });
});
