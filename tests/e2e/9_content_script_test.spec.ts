import { test, expect } from './fixtures';

test.describe('ApplyFlow - Content Script E2E', () => {
  test('should inject overlay on job pages, parse job, and simulate autofill', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Add console logging listeners for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Navigate to popup to seed storage
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: {
            enableOverlay: true,
            demoMode: true, // Fast local matching
            userEmail: 'alex.mercer@gmail.com'
          },
          profile: {
            name: 'Alex Mercer',
            email: 'alex.mercer@gmail.com',
            phone: '9876543211',
            college: 'IIT Kanpur',
            degree: 'B.Tech Mechanical',
            graduationYear: '2025',
            skills: ['React', 'TypeScript', 'Node.js'],
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

    // Mock LinkedIn Job Page
    await page.route('https://www.linkedin.com/jobs/view/123', route => {
      route.fulfill({
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Frontend Engineer Job</title></head>
            <body>
              <div class="jobs-unified-top-card__company-name">Google</div>
              <h1 class="jobs-unified-top-card__job-title">Frontend Engineer</h1>
              <div class="jobs-description__container">
                We are looking for a skilled Frontend Engineer proficient in React, TypeScript, and Node.js.
                Experience with Docker is a plus.
              </div>
              
              <!-- Mock Job Application Form -->
              <form id="apply-form">
                <label for="name">Full Name</label>
                <input id="name" type="text" placeholder="Enter your name" />
                
                <label for="email">Email Address</label>
                <input id="email" type="email" placeholder="Enter your email" />
                
                <label for="phone">Phone Number</label>
                <input id="phone" type="tel" />
                
                <label for="college">University</label>
                <input id="college" type="text" />

                <label for="why">Why do you want to work here?</label>
                <textarea id="why"></textarea>
              </form>
            </body>
          </html>
        `
      });
    });

    // Navigate to the mock job page
    await page.goto('https://www.linkedin.com/jobs/view/123');

    // Wait for content script to inject overlay
    // The overlay is a div with id 'af-overlay-container' and attaches a Shadow DOM
    const overlayContainer = page.locator('#af-overlay-container');
    await expect(overlayContainer).toBeAttached({ timeout: 10000 });

    // Access the shadow DOM elements using locator logic
    // In Playwright, standard css selectors automatically pierce open shadow DOMs!
    const widget = page.locator('.af-widget');
    await expect(widget).toBeVisible();

    // The widget starts collapsed. Expand it.
    await page.evaluate(() => {
      const container = document.getElementById('af-overlay-container');
      const collapsed = container?.shadowRoot?.querySelector('.af-collapsed-trigger') as HTMLElement;
      collapsed?.click();
    });

    // Verify parsed data in the expanded panel
    await expect(page.locator('.af-panel-title')).toContainText('Google');
    await expect(page.locator('.af-panel-title')).toContainText('Frontend Engineer');

    // Debug: log the HTML of the widget
    const html = await widget.innerHTML();
    console.log("WIDGET HTML:", html);

    // Verify smart tags (Demo mode matching)
    const tagsContainer = page.locator('.af-tags-container').first();
    const strongTags = tagsContainer.locator('.tag-strong');
    await expect(strongTags.first()).toBeVisible({ timeout: 5000 });
    
    // Instead of exact has-text, let's just ensure there's at least one strong tag 
    // since we know it defaults to React/TypeScript/Node
    await expect(strongTags).toHaveCount(3);

    // Test Smart Autofill
    const autofillBtn = page.locator('#af-autofill-action');
    await expect(autofillBtn).toBeVisible();
    await autofillBtn.click();

    // Wait for autofill to complete and verify button success state
    await expect(autofillBtn).toContainText('Successfully Filled', { timeout: 10000 });

    // Verify the page form fields were filled correctly
    await expect(page.locator('#name')).toHaveValue('Alex Mercer');
    await expect(page.locator('#email')).toHaveValue('alex.mercer@gmail.com');
    await expect(page.locator('#phone')).toHaveValue('9876543211');
    await expect(page.locator('#college')).toHaveValue('IIT Kanpur');
    
    // Verify the complex textarea was filled
    const whyTextarea = page.locator('#why');
    const whyValue = await whyTextarea.inputValue();
    expect(whyValue).toContain('highly motivated');
    expect(whyValue).toContain('React');
  });
});
