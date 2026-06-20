/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.resolve(process.cwd(), './dist');
    
    // Ensure the build directory exists
    if (!fs.existsSync(pathToExtension)) {
      throw new Error(`Extension build path not found at ${pathToExtension}. Please run 'npm run build' first.`);
    }

    const tmpUserData = path.resolve(process.cwd(), './scratch/tmp-user-data-' + Math.random().toString(36).substring(2, 9));
    fs.mkdirSync(tmpUserData, { recursive: true });

    const context = await chromium.launchPersistentContext(tmpUserData, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    // Globally route and mock Gemini & Groq API calls to prevent real network fetches
    context.on('page', page => {
      // Mock LinkedIn Job Views globally
      page.route('**/linkedin.com/jobs/view/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <!DOCTYPE html>
            <html>
              <head><title>LinkedIn Job View Mock</title></head>
              <body>
                <div class="jobs-unified-top-card__company-name">LinkedIn Company</div>
                <h1 class="jobs-unified-top-card__job-title">Software Engineer</h1>
                <div class="jobs-description__container">
                  React, TypeScript, Node.js developer role.
                </div>
              </body>
            </html>
          `
        });
      });

      page.route('**/api.groq.com/openai/v1/chat/completions', async route => {
        const postData = route.request().postData() || '';
        let bodyObj: any = {};
        try {
          bodyObj = JSON.parse(postData);
        } catch {}
        const userMessage = bodyObj.messages?.find((m: any) => m.role === 'user')?.content || '';
        
        let responseText = '';
        if (userMessage.includes("Compare the applicant's resume") || userMessage.includes("matchScore")) {
          responseText = JSON.stringify({
            matchScore: 84,
            strongSkills: ['React', 'TypeScript', 'Node.js', 'Next.js', 'Python'],
            missingSkills: ['Docker', 'AWS (S3/EC2)', 'CI/CD Pipelines (GitHub Actions)']
          });
        } else if (userMessage.includes("cover letter") || userMessage.includes("Cover Letter")) {
          let company = 'the company';
          let role = 'Software Engineer';
          let name = 'Applicant';
          
          const companyMatch = userMessage.match(/Company:\s*(.*)/i);
          if (companyMatch) company = companyMatch[1].trim();
          
          const roleMatch = userMessage.match(/Role:\s*(.*)/i);
          if (roleMatch) role = roleMatch[1].trim();
          
          const nameMatch = userMessage.match(/"name":\s*"([^"]+)"/);
          if (nameMatch) name = nameMatch[1].trim();

          responseText = `Dear Hiring Manager,

I am writing to express my enthusiastic interest in the ${role} position at ${company}. As a developer with experience in React and TypeScript, I am excited to contribute.

Sincerely,
${name}`;
        } else if (userMessage.includes("interview questions") || userMessage.includes("Interview Prep")) {
          responseText = JSON.stringify([
            {
              question: 'Explain the React virtual DOM and how rendering reconciliation works.',
              answer: 'React keeps a lightweight virtual representation of the UI in memory (Virtual DOM). When state changes, it generates a new Virtual DOM tree and compares it.'
            }
          ]);
        } else if (userMessage.includes("Evaluate the applicant's profile") || userMessage.includes("optimizeResume")) {
          responseText = JSON.stringify({
            score: 72,
            suggestions: [
              'Add Docker experience',
              'Quantify achievements'
            ]
          });
        } else if (userMessage.includes("Fill out form fields") || userMessage.includes("elementId")) {
          responseText = JSON.stringify([]);
        } else if (userMessage.includes("closure") || userMessage.includes("Closure")) {
          responseText = "I recommend highlighting specific, quantified achievements in your projects and work experience.";
        } else {
          responseText = "Default Groq mock response";
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [
              {
                message: {
                  content: responseText
                }
              }
            ]
          })
        });
      });

      page.route('**/generativelanguage.googleapis.com/**', async route => {
        const url = route.request().url();
        const postData = route.request().postData() || '';
        
        let responseText = '';

        if (url.includes('generateContent')) {
          if (postData.includes('parseResume') || postData.includes('expert ATS and resume parsing')) {
            responseText = JSON.stringify({
              name: 'Alex Mercer',
              email: 'alex.mercer@gmail.com',
              phone: '9876543211',
              college: 'IIT Kanpur',
              degree: 'B.Tech Mechanical',
              graduationYear: '2025',
              skills: ['Docker'],
              projects: [],
              workExperience: []
            });
          } else if (postData.includes('analyzeJobDescription') || postData.includes('Compare the applicant')) {
            responseText = JSON.stringify({
              matchScore: 84,
              strongSkills: ['React', 'TypeScript'],
              missingSkills: ['Docker']
            });
          } else if (postData.includes('generateCoverLetter') || postData.includes('cover letter')) {
            responseText = `Dear Hiring Manager,

I am writing to express my enthusiastic interest in the Frontend Intern position at Meta. As a dedicated developer with extensive experience in React, TypeScript, Node.js, I am excited about the opportunity to contribute to your engineering team.

Sincerely,
Jane Copilot`;
          } else if (postData.includes('optimizeResume') || postData.includes('Evaluate the applicant')) {
            responseText = JSON.stringify({
              score: 72,
              suggestions: ['Add Docker experience']
            });
          } else if (postData.includes('generateInterviewPrep') || postData.includes('interview questions')) {
            responseText = JSON.stringify([
              {
                question: 'Explain the React virtual DOM and how rendering reconciliation works.',
                answer: 'React keeps a lightweight virtual representation of the UI in memory (Virtual DOM). When state changes, it generates a new Virtual DOM tree and compares it.'
              }
            ]);
          } else {
            responseText = 'Default mock response';
          }
        }

        const mockResponse = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: responseText
                  }
                ]
              }
            }
          ]
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockResponse)
        });
      });
    });

    await use(context);
    await context.close();

    // Clean up temporary user data directory
    try {
      fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors due to locked files
    }
  },

  extensionId: async ({ context }, use) => {
    // Standard way to obtain the extension ID in Playwright
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null) as any;
    }

    let extensionId = '';
    if (background) {
      extensionId = background.url().split('/')[2];
    } else {
      // Fallback: search page targets
      const pages = context.pages();
      for (const p of pages) {
        if (p.url().startsWith('chrome-extension://')) {
          extensionId = p.url().split('/')[2];
          break;
        }
      }
    }

    if (!extensionId) {
      // Final fallback: use a placeholder or read manifest
      extensionId = 'applyflow_dev_id';
    }

    await use(extensionId);
  }
});

export const expect = test.expect;
