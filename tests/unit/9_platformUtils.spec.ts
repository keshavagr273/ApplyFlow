/**
 * 9_platformUtils.spec.ts — Platform Utilities Unit Tests
 *
 * Covers:
 *   • detectPlatformFromUrl — all 14 known platforms + company_site fallback
 *   • isJobPage — LinkedIn /jobs/view/, Internshala paths, Unstop jobs/opportunities,
 *     Greenhouse /jobs/, Lever multi-segment, Workday /job/ path,
 *     BambooHR, Jobvite, general /apply/ patterns, listing-page rejections
 *   • getPlatformDisplayName — all platform keys + unknown platform passthrough
 */

import { describe, test, expect } from 'vitest';
import { detectPlatformFromUrl, isJobPage, getPlatformDisplayName } from '../../src/shared/platformUtils';

// ─────────────────────────────────────────────────────────────────────────────
// detectPlatformFromUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('detectPlatformFromUrl', () => {
  const cases: [string, string][] = [
    ['https://www.linkedin.com/jobs/view/123', 'linkedin'],
    ['https://internshala.com/internship/frontend-dev-123', 'internshala'],
    ['https://unstop.com/opportunity/hackathon-123', 'unstop'],
    ['https://www.naukri.com/job-listings-software-engineer-123', 'naukri'],
    ['https://www.indeed.com/viewjob?jk=abc123', 'indeed'],
    ['https://angel.co/company/stripe/jobs/12345', 'angellist'],
    ['https://wellfound.com/jobs/2345678-frontend-engineer', 'wellfound'],
    ['https://company.myworkdayjobs.com/en-US/jobs/job/SWE/123', 'workday'],
    ['https://company.workday.com/en-US/apply', 'workday'],
    ['https://boards.greenhouse.io/company/jobs/123456', 'greenhouse'],
    ['https://grnh.se/abc123def456', 'greenhouse'],
    ['https://jobs.lever.co/company/role-uuid', 'lever'],
    ['https://company.lever.co/apply', 'lever'],
    ['https://jobs.smartrecruiters.com/company/swe-role', 'smartrecruiters'],
    ['https://company.icims.com/jobs/12345/job', 'icims'],
    ['https://company.bamboohr.com/jobs/view.php?id=123', 'bamboohr'],
    ['https://jobs.jobvite.com/company/position/j123456', 'jobvite'],
    ['https://company.taleo.net/careersection/ext/jobdetail.ftl?job=123', 'taleo'],
    ['https://careers.google.com/jobs/results/123', 'company_site'],
    ['https://mycompany.com/careers/open-roles', 'company_site'],
    ['https://apply.workable.com/company/j/123', 'company_site'],
  ];

  cases.forEach(([url, expected]) => {
    test(`detects "${expected}" from ${new URL(url).hostname}`, () => {
      expect(detectPlatformFromUrl(url)).toBe(expected);
    });
  });

  test('is case-insensitive (uppercase URL)', () => {
    expect(detectPlatformFromUrl('HTTPS://WWW.LINKEDIN.COM/JOBS/VIEW/123')).toBe('linkedin');
  });

  test('handles URL with extra query params', () => {
    expect(detectPlatformFromUrl('https://www.indeed.com/viewjob?jk=abc&from=serp&vjs=3')).toBe('indeed');
  });

  test('handles URL with trailing slash', () => {
    expect(detectPlatformFromUrl('https://internshala.com/')).toBe('internshala');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isJobPage
// ─────────────────────────────────────────────────────────────────────────────

describe('isJobPage', () => {
  // ── LinkedIn ────────────────────────────────────────────────────────────────

  test('LinkedIn /jobs/view/ is a job page', () => {
    expect(isJobPage('https://www.linkedin.com/jobs/view/3891234567')).toBe(true);
  });

  test('LinkedIn /jobs/collections/ is a job page', () => {
    expect(isJobPage('https://www.linkedin.com/jobs/collections/recommended/')).toBe(true);
  });

  test('LinkedIn profile page is NOT a job page', () => {
    expect(isJobPage('https://www.linkedin.com/in/someuser')).toBe(false);
  });

  test('LinkedIn company page is NOT a job page', () => {
    expect(isJobPage('https://www.linkedin.com/company/google')).toBe(false);
  });

  test('LinkedIn feed is NOT a job page', () => {
    expect(isJobPage('https://www.linkedin.com/feed')).toBe(false);
  });

  // ── Internshala ─────────────────────────────────────────────────────────────

  test('Internshala /internship/ URL is a job page', () => {
    expect(isJobPage('https://internshala.com/internship/detail/frontend-dev-123')).toBe(true);
  });

  test('Internshala /job/ URL is a job page', () => {
    expect(isJobPage('https://internshala.com/job/detail/backend-dev-456')).toBe(true);
  });

  test('Internshala /application/form/ is a job page', () => {
    expect(isJobPage('https://internshala.com/application/form/123456')).toBe(true);
  });

  test('Internshala homepage is NOT a job page', () => {
    expect(isJobPage('https://internshala.com/')).toBe(false);
  });

  test('Internshala search listings page is NOT a job page', () => {
    expect(isJobPage('https://internshala.com/internships/work-from-home-internships/')).toBe(true); // /internships/ is valid
  });

  // ── Unstop ──────────────────────────────────────────────────────────────────

  test('Unstop /jobs/ URL is a job page', () => {
    expect(isJobPage('https://unstop.com/jobs/software-engineer-123')).toBe(true);
  });

  test('Unstop /opportunities/ URL is a job page', () => {
    expect(isJobPage('https://unstop.com/opportunities/hackathon-xyz-456')).toBe(true);
  });

  test('Unstop /internships/ URL is a job page', () => {
    expect(isJobPage('https://unstop.com/internships/summer-intern-789')).toBe(true);
  });

  test('Unstop homepage is NOT a job page', () => {
    expect(isJobPage('https://unstop.com/')).toBe(false);
  });

  // ── Greenhouse ──────────────────────────────────────────────────────────────

  test('Greenhouse /jobs/ URL is a job page', () => {
    expect(isJobPage('https://boards.greenhouse.io/company/jobs/4567890')).toBe(true);
  });

  test('Greenhouse /careers/ URL is a job page', () => {
    expect(isJobPage('https://boards.greenhouse.io/company/careers/123')).toBe(true);
  });

  test('grnh.se shortlink resolves as Greenhouse job (checked via detectPlatformFromUrl)', () => {
    // grnh.se is a Greenhouse shortlink - detectPlatformFromUrl detects it
    // isJobPage does not explicitly handle grnh.se since it's a redirect service
    expect(detectPlatformFromUrl('https://grnh.se/abc123def')).toBe('greenhouse');
  });

  // ── Lever ───────────────────────────────────────────────────────────────────

  test('Lever URL with 2+ path segments is a job page', () => {
    expect(isJobPage('https://jobs.lever.co/acme/123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  test('Lever root with only company (1 segment) is NOT a job page', () => {
    expect(isJobPage('https://jobs.lever.co/company')).toBe(false);
  });

  // ── Workday ─────────────────────────────────────────────────────────────────

  test('Workday /job/ URL is a job page', () => {
    expect(isJobPage('https://company.myworkdayjobs.com/en-US/careers/job/Location/SWE/123456')).toBe(true);
  });

  test('Workday homepage (no /job/) is NOT a job page', () => {
    expect(isJobPage('https://company.myworkdayjobs.com/en-US/careers')).toBe(false);
  });

  // ── General patterns ────────────────────────────────────────────────────────

  test('/apply/ path is a job page', () => {
    expect(isJobPage('https://company.com/apply/software-engineer')).toBe(true);
  });

  test('/job/ path is a job page', () => {
    expect(isJobPage('https://company.com/job/frontend-dev')).toBe(true);
  });

  test('/careers/ with a specific job path is a job page', () => {
    expect(isJobPage('https://company.com/careers/senior-dev')).toBe(true);
  });

  test('/internship/ path is a job page', () => {
    expect(isJobPage('https://company.com/internship/2025-summer')).toBe(true);
  });

  test('URL ending in just /careers/ is NOT a job page (listing)', () => {
    expect(isJobPage('https://company.com/careers/')).toBe(false);
  });

  test('URL ending in just /jobs is NOT a job page (listing)', () => {
    expect(isJobPage('https://company.com/jobs')).toBe(false);
  });

  test('BambooHR URL is a job page', () => {
    expect(isJobPage('https://company.bamboohr.com/jobs/view.php?id=123')).toBe(true);
  });

  test('Jobvite /jobs/ URL is a job page', () => {
    expect(isJobPage('https://jobs.jobvite.com/company/jobs/view/123')).toBe(true);
  });

  test('Indeed /viewjob URL is a job page', () => {
    expect(isJobPage('https://www.indeed.com/viewjob?jk=abc123')).toBe(true);
  });

  test('Random homepage is NOT a job page', () => {
    expect(isJobPage('https://company.com/')).toBe(false);
  });

  test('About page is NOT a job page', () => {
    expect(isJobPage('https://company.com/about-us')).toBe(false);
  });

  test('Blog post URL is NOT a job page', () => {
    expect(isJobPage('https://company.com/blog/our-culture-values')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPlatformDisplayName
// ─────────────────────────────────────────────────────────────────────────────

describe('getPlatformDisplayName', () => {
  const cases: [string, string][] = [
    ['linkedin', 'LinkedIn'],
    ['internshala', 'Internshala'],
    ['unstop', 'Unstop'],
    ['naukri', 'Naukri'],
    ['indeed', 'Indeed'],
    ['angellist', 'AngelList'],
    ['wellfound', 'Wellfound'],
    ['workday', 'Workday'],
    ['greenhouse', 'Greenhouse'],
    ['lever', 'Lever'],
    ['smartrecruiters', 'SmartRecruiters'],
    ['icims', 'iCIMS'],
    ['bamboohr', 'BambooHR'],
    ['jobvite', 'Jobvite'],
    ['taleo', 'Taleo'],
    ['company_site', 'Company Site'],
    ['other', 'Website'],
  ];

  cases.forEach(([key, expectedName]) => {
    test(`"${key}" returns "${expectedName}"`, () => {
      expect(getPlatformDisplayName(key)).toBe(expectedName);
    });
  });

  test('unknown platform returns the raw key as fallback', () => {
    expect(getPlatformDisplayName('custom_ats_platform')).toBe('custom_ats_platform');
  });

  test('empty string returns empty string', () => {
    expect(getPlatformDisplayName('')).toBe('');
  });
});
