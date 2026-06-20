import { test, expect } from './fixtures';

async function seedFullProfile(page: any) {
  await page.evaluate(() => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: 'ai@gmail.com',
          userDisplayName: 'AI User',
          isPremium: true,
          demoMode: true,
          enableOverlay: true,
          theme: 'dark'
        },
        profile: {
          name: 'Jane Copilot',
          email: 'jane.copilot@gmail.com',
          phone: '9876543210',
          college: 'Stanford University',
          degree: 'M.S. in CS',
          graduationYear: '2025',
          skills: ['React', 'TypeScript', 'Node.js'],
          resumeLink: '',
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
}

test.describe('AI Copilot — Chat Platform', () => {
  test('handles suggestion chips and displays AI assistant responses', async ({ context, extensionId }) => {
    const page = await context.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedFullProfile(page);
    await page.reload();

    // Navigate to Assistant
    await page.locator('button[title="AI Copilot"]').click();
    await expect(page.locator('h1:has-text("AI Copilot")')).toBeVisible();

    // Set job context via background message helper
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }

    const sendJobContext = async () => {
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
      await page.waitForTimeout(500);
    };

    await sendJobContext();

    // Verify context header updates
    await expect(page.locator('text=Context: Netflix')).toBeVisible({ timeout: 10000 });

    // 1. Cover Letter Suggestion Chip
    const coverLetterChip = page.locator('button.suggestion-chip:has-text("Cover Letter")');
    await expect(coverLetterChip).toBeVisible();
    await coverLetterChip.click();

    // Verify Cover Letter Response
    const clPre = page.locator('pre');
    await expect(clPre).toBeVisible({ timeout: 10000 });
    await expect(clPre).toContainText('Dear Hiring Manager');
    await expect(clPre).toContainText('Netflix');
    await expect(clPre).toContainText('Jane Copilot');

    // Test Copy
    const copyBtn = page.locator('button:has-text("Copy")');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(page.locator('text=Copied!')).toBeVisible();

    // Test Download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Download")').click()
    ]);
    expect(download.suggestedFilename()).toBe('Cover_Letter.txt');

    // 2. Clear Session / New Chat
    await page.locator('button:has-text("New Chat ↺")').click();
    await expect(clPre).not.toBeVisible();

    // Verify greeting resets
    await expect(page.locator('text=Chat cleared!')).toBeVisible();

    // 3. Analyze Job
    await sendJobContext();
    const analyzeChip = page.locator('button.suggestion-chip:has-text("Analyze Job")');
    await expect(analyzeChip).toBeVisible();
    await analyzeChip.click();

    // Verify match score rendering
    await expect(page.locator('text=Match Score').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=84%').first()).toBeVisible();

    // Verify strong & missing skills chips
    await expect(page.locator('.chip-success:has-text("React")').first()).toBeVisible();
    await expect(page.locator('.chip-warning:has-text("Docker")').first()).toBeVisible();

    // 4. Interview Prep
    await page.locator('button:has-text("New Chat ↺")').click();
    await sendJobContext();
    const prepChip = page.locator('button.suggestion-chip:has-text("Interview Prep")');
    await expect(prepChip).toBeVisible();
    await prepChip.click();

    // Verify questions appear
    const questionBtn = page.locator('button:has-text("virtual DOM")');
    await expect(questionBtn).toBeVisible({ timeout: 10000 });

    // Accordion toggle
    await expect(page.locator('text=keeps a lightweight virtual representation')).not.toBeVisible();
    await questionBtn.click();
    await expect(page.locator('text=keeps a lightweight virtual representation')).toBeVisible();

    // 5. Tailor Resume
    await page.locator('button:has-text("New Chat ↺")').click();
    await sendJobContext();
    const tailorChip = page.locator('button.suggestion-chip:has-text("Tailor Resume")');
    await expect(tailorChip).toBeVisible();
    await tailorChip.click();

    // Verify resume score rendering
    await expect(page.locator('text=Resume Match Score').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=72%').first()).toBeVisible();
    await expect(page.locator('text=Add Docker experience').first()).toBeVisible();

    // 6. Custom Prompt Input
    await page.fill('textarea[placeholder*="Ask anything"]', 'Explain closure in JS.');
    await page.locator('button:has-text("↑")').click();

    // Verify answer appears
    await expect(page.locator('text=I recommend highlighting').first()).toBeVisible({ timeout: 10000 });
  });
});
