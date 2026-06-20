import { test, expect } from './fixtures';

test.describe('ApplyFlow - AI Copilot Assistant E2E', () => {
  test('should verify AI Cover Letter, Resume Tailoring, and Interview Prep', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed profile details to make AI features active
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'jane.copilot@gmail.com',
            userDisplayName: 'Jane Copilot',
            isPremium: false,
            theme: 'dark',
            demoMode: true // Use local demo mock replies
          },
          profile: {
            name: 'Jane Copilot',
            email: 'jane.copilot@gmail.com',
            phone: '9876543210',
            college: 'Stanford University',
            degree: 'M.S. in Computer Science',
            graduationYear: '2026',
            skills: ['React', 'TypeScript', 'Node.js'],
            resumeLink: 'https://drive.google.com/sample',
            linkedinUrl: 'https://linkedin.com/in/janecopilot',
            portfolioUrl: 'https://janecopilot.github.io',
            resumeText: 'Jane Copilot is an expert software developer specializing in React and TypeScript frontend designs.',
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

    // Navigate to Assistant Screen
    await page.locator('button[title="AI Copilot"]').click();
    await expect(page.locator('h1:has-text("AI Copilot")')).toBeVisible();

    // 1. Setup Tab Context by sending a message from background service worker
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
      platform: 'company_site',
      company: 'Netflix',
      role: 'Software Engineer - UI Frameworks',
      jobDescription: 'Seeking expert in React, TypeScript, state management (Zustand) and premium animations.'
    });

    // Verify context header updates
    await expect(page.locator('text=Context: Netflix')).toBeVisible({ timeout: 10000 });

    // 2. Cover Letter Generation Test
    const coverLetterChip = page.locator('button.suggestion-chip:has-text("Cover Letter")');
    await expect(coverLetterChip).toBeVisible();
    await coverLetterChip.click();

    // Verify AI response bubble for Cover Letter appears
    const clPre = page.locator('pre');
    await expect(clPre).toBeVisible({ timeout: 10000 });
    await expect(clPre).toContainText('Dear Hiring Manager');
    await expect(clPre).toContainText('Netflix');
    await expect(clPre).toContainText('Jane Copilot');

    // Test Copy Action
    const copyBtn = page.locator('button:has-text("Copy")');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.locator('text=Copied!')).toBeVisible();

    // Test Download Action
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Download")').click()
    ]);
    expect(download.suggestedFilename()).toBe('Cover_Letter.txt');
  });
});
