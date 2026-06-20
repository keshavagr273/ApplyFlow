import { test, expect } from './fixtures';

test.describe('ApplyFlow - Side Navigation E2E', () => {
  test('should navigate between screens correctly', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed logged-in user
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'jane.nav@gmail.com',
            userDisplayName: 'Jane Nav',
            isPremium: false,
            theme: 'dark'
          },
          profile: {
            name: 'Jane Nav',
            email: 'jane.nav@gmail.com',
            phone: '9876543210',
            college: 'IIT Delhi',
            degree: 'B.Tech',
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
          },
          applications: [
            {
              id: 'app-1',
              company: 'Google',
              role: 'Software Engineer',
              status: 'applied',
              appliedAt: Date.now(),
              url: 'https://careers.google.com'
            }
          ]
        }, resolve);
      });
    });

    await page.reload();

    // Initially Dashboard is active, greeting includes Jane
    await expect(page.locator('h1:has-text("Jane")')).toBeVisible();

    // Go to AI Copilot
    await page.locator('button[title="AI Copilot"]').click();
    await expect(page.locator('h1:has-text("AI Copilot")')).toBeVisible();

    // Go to Profile
    await page.locator('button[title="Profile"]').click();
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible();

    // Go to Tracker
    await page.locator('button[title="Tracker"]').click();
    await expect(page.locator('h1:has-text("Tracker")')).toBeVisible();

    // Go to Analytics
    await page.locator('button[title="Analytics"]').click();
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();

    // Go back to Dashboard
    await page.locator('button[title="Dashboard"]').click();
    await expect(page.locator('h1:has-text("Jane")')).toBeVisible();
  });
});
