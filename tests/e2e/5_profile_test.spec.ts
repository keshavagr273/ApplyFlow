import { test, expect } from './fixtures';

test.describe('ApplyFlow - User Profile Manager E2E', () => {
  test('should support full profile forms, skill tags, experience, and projects', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed initial settings to bypass auth gate and load profile screen
    await page.goto(`chrome-extension://${extensionId}/side-panel.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            userEmail: 'alex.mercer@gmail.com',
            userDisplayName: 'Alex Mercer',
            isPremium: false,
            theme: 'dark'
          },
          profile: {
            name: 'Alex Mercer',
            email: 'alex.mercer@gmail.com',
            phone: '9876543211',
            college: 'IIT Kanpur',
            degree: 'B.Tech Mechanical',
            graduationYear: '2025',
            skills: ['Docker'],
            resumeLink: 'https://drive.google.com/sample',
            linkedinUrl: 'https://linkedin.com/in/alex',
            portfolioUrl: 'https://alex.dev',
            customAnswers: [],
            projects: [],
            workExperience: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }, resolve);
      });
    });

    // Reload page to populate store
    await page.reload();

    // Navigate to Profile Screen
    await page.locator('button[title="Profile"]').click();
    await expect(page.locator('h1:has-text("My Profile")')).toBeVisible();

    // 1. Expand Personal Info Accordion and edit details
    await page.locator('button:has-text("Personal Info")').click();
    await page.locator('input[placeholder="Kesha Vagrawal"]').fill('Alex Mercer');
    await page.locator('input[placeholder="you@email.com"]').fill('alex.mercer@gmail.com');
    await page.locator('input[placeholder="+91 9876543210"]').fill('9876543211');

    // 2. Expand Education Accordion and edit details
    await page.locator('button:has-text("Education")').click();
    await page.locator('input[placeholder="IIT Bombay"]').fill('IIT Kanpur');
    await page.locator('input[placeholder="B.Tech CS"]').fill('B.Tech Mechanical');
    await page.locator('input[placeholder="2026"]').fill('2025');

    // 3. Expand Skills Accordion and verify tag interaction
    await page.locator('button:has-text("Skills")').click();
    await page.locator('input[placeholder="Add skill (Enter to add)"]').fill('Docker');
    await page.keyboard.press('Enter');
    
    // Skill tag should be visible
    const dockerTag = page.locator('span:has-text("Docker")');
    await expect(dockerTag).toBeVisible();

    // Remove the skill tag
    await dockerTag.locator('button:has-text("×")').click();
    await expect(dockerTag).not.toBeVisible();

    // 4. Expand Work Experience Accordion, add and remove experience
    await page.locator('button:has-text("Work Experience")').click();
    await page.locator('button:has-text("+ Add Work Experience")').click();
    
    await page.locator('input[placeholder="e.g. Google"]').fill('Startup Labs');
    await page.locator('input[placeholder="e.g. Software Engineer"]').fill('Backend Intern');
    await page.locator('input[placeholder="e.g. Jan 2024"]').fill('May 2025');
    await page.locator('input[placeholder="e.g. Dec 2024"]').fill('July 2025');
    await page.locator('textarea[placeholder*="Describe your responsibilities"]').fill('Built Node.js microservices.');

    // Experience card should be visible
    const expCard = page.locator('div.bg-white\\/5:has(input[placeholder="e.g. Software Engineer"])').last();
    await expect(expCard).toBeVisible();
    await expect(expCard.locator('input[placeholder="e.g. Google"]')).toHaveValue('Startup Labs');

    // Remove experience card
    await expCard.locator('button:has-text("Remove")').click();
    await expect(page.locator('input[placeholder="e.g. Software Engineer"]')).not.toBeVisible();

    // 5. Expand Projects Accordion, add and remove projects
    await page.locator('button:has-text("Projects")').click();
    await page.locator('button:has-text("+ Add Project")').click();
    
    await page.locator('input[placeholder="e.g. E-Commerce Platform"]').fill('Cryptocurrency Dashboard');
    await page.locator('textarea[placeholder*="Describe what you built"]').fill('React & WebSockets API.');
    await page.locator('input[placeholder="github.com/..."]').fill('https://github.com/alex/crypto');
    await page.locator('input[placeholder="e.g. myproject.vercel.app"]').fill('https://crypto.alex.dev');

    // Project card should be visible
    const projCard = page.locator('div.bg-white\\/5:has(input[placeholder="e.g. E-Commerce Platform"])').last();
    await expect(projCard).toBeVisible();
    await expect(projCard.locator('input[placeholder="e.g. E-Commerce Platform"]')).toHaveValue('Cryptocurrency Dashboard');

    // Remove project card
    await projCard.locator('button:has-text("Remove")').click();
    await expect(page.locator('input[placeholder="e.g. E-Commerce Platform"]')).not.toBeVisible();

    // 6. Save Profile Details
    const saveBtn = page.locator('button:has-text("Save All")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    
    await expect(page.locator('text=Profile saved!')).toBeVisible();
  });
});
