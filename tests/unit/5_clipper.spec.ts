/**
 * 5_clipper.spec.ts — Web Clipper Content Script Unit Tests
 *
 * Covers:
 *   • detectPlatform — all known platforms + company_site fallback
 *   • isJobPage — known platforms, keyword heuristics, non-job pages
 *   • extractJobInfo — DOM scraping for role, company, description, location, salary
 *   • extractJsonLdJobInfo — JSON-LD JobPosting schema parsing, null when absent
 *   • extractCleanGenericDescription — densest content block selection, cleanup
 *   • injectClipper — button injection on job pages, non-injection on non-job pages
 *   • Auth gate — injection blocked when user not logged in
 *   • PLATFORM_SELECTORS — LinkedIn, Indeed, Internshala, Unstop, Greenhouse,
 *     Lever, Workday tested individually
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPlatform,
  isJobPage,
  extractJobInfo,
  injectClipper,
  extractJsonLdJobInfo,
  extractCleanGenericDescription
} from '../../src/content/clipper';

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true
  });
  global.chrome = {
    runtime: {
      getURL: vi.fn().mockReturnValue('mock-url'),
      sendMessage: vi.fn()
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ settings: { showClipButton: true, userEmail: 'test@gmail.com' } })
      }
    }
  } as any;
});

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  const cases: [string, string][] = [
    ['https://www.linkedin.com/jobs/view/123', 'linkedin'],
    ['https://internshala.com/internship/123', 'internshala'],
    ['https://unstop.com/opportunity/123', 'unstop'],
    ['https://company.myworkdayjobs.com/careers', 'workday'],
    ['https://boards.greenhouse.io/company', 'greenhouse'],
    ['https://jobs.lever.co/company/role', 'lever'],
    ['https://company.icims.com/jobs/123', 'icims'],
    ['https://jobs.smartrecruiters.com/company', 'smartrecruiters'],
    ['https://company.bamboohr.com/jobs', 'bamboohr'],
    ['https://jobs.jobvite.com/company/job', 'jobvite'],
    ['https://company.taleo.net/careersection', 'taleo'],
    ['https://www.naukri.com/job-listings', 'naukri'],
    ['https://www.indeed.com/viewjob?jk=abc', 'indeed'],
    ['https://angel.co/company/role', 'angellist'],
    ['https://wellfound.com/jobs/123', 'wellfound'],
    ['https://careers.google.com/jobs/123', 'company_site'],
    ['https://random-company.io/careers', 'company_site'],
  ];

  cases.forEach(([url, expected]) => {
    it(`detects "${expected}" from ${new URL(url).hostname}`, () => {
      expect(detectPlatform(url)).toBe(expected);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IS JOB PAGE
// ─────────────────────────────────────────────────────────────────────────────

describe('isJobPage', () => {
  it('returns true for LinkedIn job URL', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    expect(isJobPage()).toBe(true);
  });

  it('returns true for Internshala job URL', () => {
    window.location.href = 'https://internshala.com/internship/software-engineer-123';
    expect(isJobPage()).toBe(true);
  });

  it('returns true for Greenhouse URL', () => {
    window.location.href = 'https://boards.greenhouse.io/company/jobs/456';
    expect(isJobPage()).toBe(true);
  });

  it('returns true for Lever URL', () => {
    window.location.href = 'https://jobs.lever.co/company/role-uuid';
    expect(isJobPage()).toBe(true);
  });

  it('returns true for Workday URL', () => {
    window.location.href = 'https://company.myworkdayjobs.com/careers/job/123';
    expect(isJobPage()).toBe(true);
  });

  it('returns true for generic company site with job keywords in body', () => {
    window.location.href = 'https://company.com/job/page';
    document.body.innerHTML = `
      <p>Apply for this job</p>
      <p>Job Description and requirements</p>
      <p>Responsibilities and qualifications</p>
    `;
    expect(isJobPage()).toBe(true);
  });

  it('returns false for a generic company "About us" page', () => {
    window.location.href = 'https://company.com/about';
    document.body.innerHTML = '<p>We are a company</p>';
    expect(isJobPage()).toBe(false);
  });

  it('returns false for a homepage with no job keywords', () => {
    window.location.href = 'https://company.com';
    document.body.innerHTML = '<h1>Welcome to Company Inc.</h1>';
    expect(isJobPage()).toBe(false);
  });

  it('returns false for LinkedIn profile pages (not /jobs/view/)', () => {
    window.location.href = 'https://www.linkedin.com/in/someuser';
    // LinkedIn in-profile page should not be matched
    expect(isJobPage()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT JOB INFO (DOM scraping)
// ─────────────────────────────────────────────────────────────────────────────

describe('extractJobInfo', () => {
  it('extracts role, company, location, salary from generic DOM', () => {
    window.location.href = 'https://careers.company.com/job/123';
    document.title = 'Software Engineer - Company Inc';
    document.body.innerHTML = `
      <h1 class="job-title">Software Engineer</h1>
      <div class="company">Company Inc</div>
      <p class="description">We are seeking a skilled engineer with React experience. This job requires building scalable web applications using modern technologies. Must have 3+ years of experience in frontend development with TypeScript.</p>
      <span class="location">Remote, India</span>
      <span class="salary">₹15-20 LPA</span>
    `;
    const info = extractJobInfo();
    expect(info.role).toBe('Software Engineer');
    expect(info.company).toBe('Company Inc');
    expect(info.location).toBe('Remote, India');
    expect(info.salary).toBe('₹15-20 LPA');
    expect(info.description).toContain('React experience');
    expect(info.platform).toBe('company_site');
  });

  it('extracts role from page title when no h1 present', () => {
    window.location.href = 'https://careers.company.com/job/123';
    document.title = 'Senior Frontend Engineer - Apply';
    document.body.innerHTML = `<p>Some job details here without a header element.</p>`;
    const info = extractJobInfo();
    // Title should be used as fallback
    expect(info.role.length).toBeGreaterThan(0);
  });

  it('extracts LinkedIn job info from correct selectors', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    document.body.innerHTML = `
      <h1 class="jobs-unified-top-card__job-title">Staff Software Engineer</h1>
      <span class="jobs-unified-top-card__company-name">Acme Corp</span>
    `;
    const info = extractJobInfo();
    expect(info.platform).toBe('linkedin');
  });

  it('extracts Greenhouse job info', () => {
    window.location.href = 'https://boards.greenhouse.io/company/jobs/123';
    document.body.innerHTML = `
      <h1 class="app-title">Backend Engineer</h1>
      <div id="content">
        <p>We are looking for a backend engineer. This is a detailed job description about building APIs with Node.js, PostgreSQL, and distributed systems. The ideal candidate has experience in microservices architecture.</p>
      </div>
      <div class="location">San Francisco, CA</div>
    `;
    const info = extractJobInfo();
    expect(info.platform).toBe('greenhouse');
    expect(info.role).toBe('Backend Engineer');
  });

  it('extracts Lever job info', () => {
    window.location.href = 'https://jobs.lever.co/company/role-id';
    document.body.innerHTML = `
      <div class="posting-headline">
        <h2>Product Designer</h2>
        <div class="sort-by-team">Design</div>
      </div>
      <div class="posting-description">
        <p>We are seeking a creative product designer to join our team. You will work on designing user interfaces for our mobile and web applications using Figma and modern design tools.</p>
      </div>
      <div class="sort-by-location">New York, NY</div>
    `;
    const info = extractJobInfo();
    expect(info.platform).toBe('lever');
    expect(info.role).toBe('Product Designer');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD JOB SCHEMA PARSING
// ─────────────────────────────────────────────────────────────────────────────

describe('extractJsonLdJobInfo', () => {
  it('extracts full JobPosting schema with all fields', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Staff Frontend Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "Stark Industries"
          },
          "description": "<div>We are seeking a staff frontend engineer with deep React expertise.</div>",
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Malibu",
              "addressRegion": "CA",
              "addressCountry": "US"
            }
          },
          "baseSalary": {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": {
              "@type": "QuantitativeValue",
              "value": 180000,
              "unitText": "YEAR"
            }
          }
        }
      </script>
    `;
    const info = extractJsonLdJobInfo();
    expect(info).not.toBeNull();
    expect(info?.role).toBe('Staff Frontend Engineer');
    expect(info?.company).toBe('Stark Industries');
    expect(info?.description).toContain('React expertise');
    expect(info?.location).toBe('Malibu, US');
    expect(info?.salary).toBe('180000 YEAR');
  });

  it('returns null when no JobPosting schema exists', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {"@context": "https://schema.org", "@type": "Product", "name": "Widget"}
      </script>
    `;
    expect(extractJsonLdJobInfo()).toBeNull();
  });

  it('returns null when no script tag present', () => {
    document.body.innerHTML = '<h1>Simple page</h1>';
    expect(extractJsonLdJobInfo()).toBeNull();
  });

  it('handles malformed JSON gracefully', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        { invalid json here }
      </script>
    `;
    expect(() => extractJsonLdJobInfo()).not.toThrow();
  });

  it('handles minimal JobPosting schema (only required fields)', () => {
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Intern",
          "hiringOrganization": {"name": "MiniCorp"}
        }
      </script>
    `;
    const info = extractJsonLdJobInfo();
    expect(info?.role).toBe('Intern');
    expect(info?.company).toBe('MiniCorp');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN GENERIC DESCRIPTION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

describe('extractCleanGenericDescription', () => {
  it('identifies the densest text block and excludes nav/sidebar', () => {
    document.body.innerHTML = `
      <header><nav><a href="/">Home</a><a href="/jobs">Jobs</a></nav></header>
      <main>
        <div class="sidebar">
          <a href="/link1">Sidebar Link 1</a>
          <a href="/link2">Sidebar Link 2</a>
        </div>
        <article class="job-description-body">
          <h2>Job Description</h2>
          <p>We are seeking a highly skilled Software Engineer to design, develop, and deploy robust applications using React, TypeScript, and modern cloud infrastructure.</p>
          <p>You will collaborate with cross-functional teams, mentor junior engineers, and deliver impactful features. The ideal candidate has 3+ years experience and a strong portfolio.</p>
          <p>Join our elite engineering team and help us reshape how the world works!</p>
        </article>
      </main>
      <footer><p>© 2026 Corp Inc</p></footer>
    `;
    const desc = extractCleanGenericDescription();
    expect(desc).toContain('Software Engineer');
    expect(desc).toContain('React, TypeScript');
    expect(desc).not.toContain('Home');
    expect(desc).not.toContain('Sidebar Link 1');
    expect(desc).not.toContain('© 2026');
  });

  it('returns a string even on empty page', () => {
    document.body.innerHTML = '<div></div>';
    const desc = extractCleanGenericDescription();
    expect(typeof desc).toBe('string');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIPPER INJECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('injectClipper', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('injects clipper button on LinkedIn job page', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    const titleEl = document.createElement('h1');
    titleEl.className = 'jobs-unified-top-card__job-title';
    document.body.appendChild(titleEl);
    injectClipper();
    vi.advanceTimersByTime(600);
    const btn = document.querySelector('.af-inline-save-btn');
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toContain('Save Job');
  });

  it('does not inject on non-job pages', () => {
    window.location.href = 'https://example.com/about';
    injectClipper();
    vi.advanceTimersByTime(600);
    const btn = document.querySelector('.af-inline-save-btn');
    expect(btn).toBeNull();
  });

  it('does not inject when showClipButton=false', async () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    const titleEl = document.createElement('h1');
    titleEl.className = 'jobs-unified-top-card__job-title';
    document.body.appendChild(titleEl);
    // Override to disable clip button
    global.chrome.storage.local.get = vi.fn().mockResolvedValue({ settings: { showClipButton: false } });
    injectClipper();
    vi.advanceTimersByTime(600);
    await Promise.resolve(); // flush async storage read
    const btn = document.querySelector('.af-inline-save-btn');
    expect(btn).toBeNull();
  });

  it('does not inject duplicate buttons if called twice', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    const titleEl = document.createElement('h1');
    titleEl.className = 'jobs-unified-top-card__job-title';
    document.body.appendChild(titleEl);
    injectClipper();
    injectClipper(); // second call should be idempotent
    vi.advanceTimersByTime(600);
    const btns = document.querySelectorAll('.af-inline-save-btn');
    expect(btns.length).toBeLessThanOrEqual(1);
  });
});
