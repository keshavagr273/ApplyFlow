import { test, expect } from './fixtures';

test.describe('ApplyFlow - Dashboard & Form Scanning E2E', () => {
  test('should scan page and trigger smart autofill with reactive data box', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Add console logging listeners for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    
    // Seed settings and profile to bypass auth gate and load dashboard
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'jane.scan@gmail.com',
            userDisplayName: 'Jane Scan',
            isPremium: false,
            theme: 'dark',
            demoMode: true // Fast local matching
          },
          profile: {
            name: 'Jane Scan',
            email: 'jane.scan@gmail.com',
            phone: '9876543210',
            college: 'IIT Madras',
            degree: 'B.Tech CSE',
            graduationYear: '2026',
            skills: ['React', 'TypeScript', 'Zustand'],
            resumeLink: 'https://drive.google.com/sample',
            linkedinUrl: 'https://linkedin.com/in/janescan',
            portfolioUrl: 'https://janescan.dev',
            customAnswers: [],
            projects: [],
            workExperience: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }, resolve);
      });
    });

    await page.reload();

    // 1. Initially should show "Ready to help" in idle state
    await expect(page.locator('text=Ready to help')).toBeVisible();

    // 2. Obtain background service worker and post scanning message from there
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }

    await background.evaluate((payload) => {
      chrome.runtime.sendMessage({
        type: 'JOB_CONTEXT_UPDATED',
        payload
      });
    }, {
      url: 'https://jobs.netflix.com/jobs/999',
      platform: 'workday',
      company: 'Netflix',
      role: 'Software Engineer - UI Frameworks',
      jobDescription: 'Seeking expert in React, TypeScript, state management (Zustand) and premium animations.'
    });

    // 3. Verify reactive scan box is displayed with parsed metadata
    await expect(page.locator('text=Netflix')).toBeVisible({ timeout: 10000 });
    
    // In demo mode, it automatically triggers job analysis with 84% score
    // Let's verify that the 84% fit text is visible
    await expect(page.locator('text=84% Fit')).toBeVisible();

    // 4. Click "Autofill" and verify filling state and log activity
    const autofillBtn = page.locator('button:has-text("Autofill")');
    await expect(autofillBtn).toBeEnabled();
    
    await autofillBtn.click();
    
    // Autofill should trigger "Filling..." state
    await expect(page.locator('text=Filling...')).toBeVisible();
    
    // Wait for the simulated delay to finish
    await expect(page.locator('text=Filling...')).not.toBeVisible({ timeout: 5000 });

    // Recent activity list should now show "Netflix" application
    const recentActivity = page.locator('text=Netflix').last();
    await expect(recentActivity).toBeVisible();
  });
});
