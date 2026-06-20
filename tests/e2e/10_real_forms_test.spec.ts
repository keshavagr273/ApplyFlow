import { test, expect } from './fixtures';

test.describe('ApplyFlow - Real Forms E2E (Phase 4)', () => {
  test('should parse and fill Workday-style forms (ARIA, IDs)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed storage with Normal Profile
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          settings: { enableOverlay: true, demoMode: true, userEmail: 'jane.workday@test.com' },
          profile: {
            name: 'Jane Doe',
            email: 'jane.workday@test.com',
            phone: '5551234567',
            college: 'Stanford',
            degree: 'MS Computer Science',
            skills: ['Java', 'Spring', 'AWS'],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        }, resolve);
      });
    });

    // Mock Workday Job Page
    page.on('console', msg => console.log(`[BROWSER LOG] ${msg.text()}`));
    await page.route('https://www.myworkdayjobs.com/job/123', route => {
      route.fulfill({
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
            <head><title>Backend Engineer - Workday</title></head>
            <body>
              <p>We are looking for a highly motivated Backend Engineer to join our Workday team. You will be responsible for building scalable cloud services using Java, Spring Boot, and AWS. Minimum 3 years of experience required. Strong knowledge of object-oriented design and distributed systems.</p>
              <div id="shadow-host"></div>
              <script>
                // Workday often uses shadow DOMs and complex aria attributes
                const host = document.getElementById('shadow-host');
                const root = host.attachShadow({ mode: 'open' });
                root.innerHTML = \`
                  <form>
                    <!-- Workday style Email field -->
                    <div>
                      <label id="email-label">Email Address *</label>
                      <input aria-labelledby="email-label" data-automation-id="candidateEmail" type="text" id="wd-email" />
                    </div>
                    
                    <!-- Workday style Phone field -->
                    <div>
                      <label id="phone-label">Phone Device Type *</label>
                      <input aria-labelledby="phone-label" data-automation-id="phone" type="text" id="wd-phone" />
                    </div>

                    <!-- Workday style Combobox (Select) -->
                    <div role="combobox" aria-expanded="false" aria-haspopup="listbox" id="wd-degree-combo">
                      <select id="wd-degree" data-automation-id="degree">
                        <option value=""></option>
                        <option value="BS">BS Computer Science</option>
                        <option value="MS">MS Computer Science</option>
                      </select>
                    </div>
                  </form>
                \`;
              </script>
            </body>
          </html>
        `
      });
    });

    await page.goto('https://www.myworkdayjobs.com/job/123');

    // Wait for the overlay
    const overlayContainer = page.locator('#af-overlay-container');
    await expect(overlayContainer).toBeAttached({ timeout: 10000 });
    
    // Expand the widget and click autofill
    await page.evaluate(() => {
      const container = document.getElementById('af-overlay-container');
      const collapsed = container?.shadowRoot?.querySelector('.af-collapsed-trigger') as HTMLElement;
      collapsed?.click();
    });
    const autofillBtn = page.locator('#af-autofill-action');
    await expect(autofillBtn).toBeVisible();
    await autofillBtn.click();
    
    // Wait for autofill to complete
    await expect(autofillBtn).toContainText('Successfully Filled', { timeout: 10000 });

    // Verify fields inside the mock shadow DOM
    // Playwright automatically pierces open shadow DOMs for locators
    await expect(page.locator('#wd-email')).toHaveValue('jane.workday@test.com');
    await expect(page.locator('#wd-phone')).toHaveValue('5551234567');
    await expect(page.locator('#wd-degree')).toHaveValue('MS');
  });

  test('should persist data after extension reload (Resilience)', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Seed storage with minimal profile
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          profile: { name: 'Persistence Test', email: 'test@persist.com' }
        }, resolve);
      });
    });

    // Simulate extension reload by reloading the background context or just navigating to the extension page
    await page.reload();

    // Verify data is still there
    const name = await page.evaluate(() => {
      return new Promise((resolve) => {
        chrome.storage.local.get('profile', (data) => resolve((data as any).profile.name));
      });
    });

    expect(name).toBe('Persistence Test');
  });
});
