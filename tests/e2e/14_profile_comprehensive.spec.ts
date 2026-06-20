import { test, expect } from './fixtures';

async function seedLoggedInUser(page: any, isPremium = false) {
  await page.evaluate((premium: boolean) => {
    return new Promise<void>(resolve => {
      chrome.storage.local.set({
        settings: {
          userEmail: 'profile@gmail.com',
          userDisplayName: 'Profile User',
          userAvatar: '',
          isPremium: premium,
          enableOverlay: true,
          showClipButton: true,
          demoMode: false,
          theme: 'dark'
        },
        profile: {
          name: 'Profile User',
          email: 'profile@gmail.com',
          phone: '9876543210',
          college: 'IIT Delhi',
          degree: 'B.Tech',
          graduationYear: '2025',
          skills: ['React'],
          resumeLink: '',
          linkedinUrl: '',
          portfolioUrl: '',
          customAnswers: [],
          projects: [],
          workExperience: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }, resolve);
    });
  }, isPremium);
}

test.describe('Profile — Page & Form Sections', () => {
  test('displays correct heading and supports personal info, location & education form edits', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedLoggedInUser(page);
    await page.reload();

    // Navigate to Profile
    await page.locator('button[title="Profile"]').click();
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible();

    // 1. Personal Info Section
    await page.locator('button:has-text("Personal Info")').click();
    await page.locator('input[placeholder="Kesha Vagrawal"]').fill('Priya Sharma');
    await page.locator('input[placeholder="you@email.com"]').fill('priya.sharma@gmail.com');
    await page.locator('input[placeholder="+91 9876543210"]').fill('9988776655');

    // 2. Location Section
    await page.locator('button:has-text("Location")').click();
    await page.locator('input[placeholder="Mumbai"]').fill('Delhi');
    await page.locator('input[placeholder="India"]').fill('India');

    // 3. Education Section
    await page.locator('button:has-text("Education")').click();
    await page.locator('input[placeholder="IIT Bombay"]').fill('NIT Trichy');
    await page.locator('input[placeholder="B.Tech CS"]').fill('B.Tech CS');
    await page.locator('input[placeholder="2026"]').fill('2025');

    // Save All and verify
    await page.locator('button:has-text("Save All")').click();
    await expect(page.locator('text=Profile saved!')).toBeVisible();

    // Reload and check fields persisted
    await page.reload();
    await page.locator('button[title="Profile"]').click();

    await page.locator('button:has-text("Personal Info")').click();
    await expect(page.locator('input[placeholder="Kesha Vagrawal"]')).toHaveValue('Priya Sharma');
    await expect(page.locator('input[placeholder="you@email.com"]')).toHaveValue('priya.sharma@gmail.com');

    await page.locator('button:has-text("Location")').click();
    await expect(page.locator('input[placeholder="Mumbai"]')).toHaveValue('Delhi');

    await page.locator('button:has-text("Education")').click();
    await expect(page.locator('input[placeholder="IIT Bombay"]')).toHaveValue('NIT Trichy');
    await expect(page.locator('input[placeholder="2026"]')).toHaveValue('2025');
  });
});

test.describe('Profile — Skills & Custom Answers', () => {
  test('adds and removes skill tags & custom answers', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedLoggedInUser(page);
    await page.reload();

    await page.locator('button[title="Profile"]').click();

    // 1. Skill Tags
    await page.locator('button:has-text("Skills")').click();
    const skillInput = page.locator('input[placeholder="Add skill (Enter to add)"]');
    await skillInput.fill('TypeScript');
    await page.keyboard.press('Enter');

    const tsTag = page.locator('span:has-text("TypeScript")');
    await expect(tsTag).toBeVisible();

    // Add another skill using the '+' button
    await skillInput.fill('Docker');
    await page.locator('button:has-text("+")').click();
    const dockerTag = page.locator('span:has-text("Docker")');
    await expect(dockerTag).toBeVisible();

    // Remove the TypeScript skill tag
    await tsTag.locator('button:has-text("×")').click();
    await expect(tsTag).not.toBeVisible();

    // 2. Custom Answers
    await page.locator('button:has-text("Custom Answers")').click();
    await page.locator('button:has-text("+ Add Custom Answer")').click();

    const triggerInput = page.locator('input[placeholder*="Trigger phrase"]');
    const answerTextarea = page.locator('textarea[placeholder="Your answer..."]');

    await triggerInput.fill('Why should we hire you');
    await answerTextarea.fill('I am a proactive developer with strong engineering fundamentals.');

    // Save All
    await page.locator('button:has-text("Save All")').click();
    await expect(page.locator('text=Profile saved!')).toBeVisible();

    // Remove custom answer
    await page.locator('button:has-text("Remove")').click();
    await page.locator('button:has-text("Save All")').click();
    await expect(page.locator('text=Profile saved!')).toBeVisible();
  });
});

test.describe('Profile — Work Experience & Projects', () => {
  test('adds, displays and removes work experience and project entries', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedLoggedInUser(page);
    await page.reload();

    await page.locator('button[title="Profile"]').click();

    // 1. Work Experience
    await page.locator('button:has-text("Work Experience")').click();
    await page.locator('button:has-text("+ Add Work Experience")').click();

    await page.locator('input[placeholder="e.g. Google"]').fill('Razorpay');
    await page.locator('input[placeholder="e.g. Software Engineer"]').fill('Backend Intern');
    await page.locator('input[placeholder="e.g. Jan 2024"]').fill('May 2024');
    await page.locator('input[placeholder="e.g. Dec 2024"]').fill('Aug 2024');
    await page.locator('textarea[placeholder*="Describe your responsibilities"]').fill('Built payment gateway integrations.');

    const expCard = page.locator('div.bg-white\\/5:has(input[placeholder="e.g. Software Engineer"])').last();
    await expect(expCard).toBeVisible();
    await expect(expCard.locator('input[placeholder="e.g. Google"]')).toHaveValue('Razorpay');

    // Remove work experience card
    await expCard.locator('button:has-text("Remove")').click();
    await expect(page.locator('input[placeholder="e.g. Software Engineer"]')).not.toBeVisible();

    // 2. Projects
    await page.locator('button:has-text("Projects")').click();
    await page.locator('button:has-text("+ Add Project")').click();

    await page.locator('input[placeholder="e.g. E-Commerce Platform"]').fill('AI Resume Parser');
    await page.locator('input[placeholder="github.com/..."]').fill('https://github.com/user/resume-parser');
    await page.locator('input[placeholder="e.g. myproject.vercel.app"]').fill('https://resume-parser.vercel.app');
    await page.locator('textarea[placeholder*="Describe what you built"]').fill('A tool that parses resumes.');

    const projCard = page.locator('div.bg-white\\/5:has(input[placeholder="e.g. E-Commerce Platform"])').last();
    await expect(projCard).toBeVisible();
    await expect(projCard.locator('input[placeholder="e.g. E-Commerce Platform"]')).toHaveValue('AI Resume Parser');

    // Remove project card
    await projCard.locator('button:has-text("Remove")').click();
    await expect(page.locator('input[placeholder="e.g. E-Commerce Platform"]')).not.toBeVisible();

    // Save All
    await page.locator('button:has-text("Save All")').click();
    await expect(page.locator('text=Profile saved!')).toBeVisible();
  });
});

test.describe('Profile — Work Preferences & Authorization (EEO)', () => {
  test('fills notice period, expected salary, gender & disability dropdowns', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await seedLoggedInUser(page);
    await page.reload();

    await page.locator('button[title="Profile"]').click();

    // 1. Work Preferences
    await page.locator('button:has-text("Work Preferences")').click();
    await page.locator('input[placeholder="Immediate / 1 month"]').fill('1 month');
    await page.locator('input[placeholder="5-8 LPA"]').fill('12 LPA');
    await page.locator('input[placeholder="SWE / PM"]').fill('SWE');

    // 2. Work Authorization / EEO
    await page.locator('button:has-text("Work Authorization")').click();
    
    // Toggle authorized checkbox (represented by switch div)
    const switchDiv = page.locator('div.relative.w-9.h-5').first();
    await switchDiv.click();

    // Select Gender and Disability
    const genderSelect = page.locator('select').first();
    const disabilitySelect = page.locator('select').last();
    
    await genderSelect.selectOption('male');
    await disabilitySelect.selectOption('no');

    // Save All
    await page.locator('button:has-text("Save All")').click();
    await expect(page.locator('text=Profile saved!')).toBeVisible();
  });
});
