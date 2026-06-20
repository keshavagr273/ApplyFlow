import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectPlatform, isJobPage, extractJobInfo, injectClipper, extractJsonLdJobInfo, extractCleanGenericDescription } from '../../src/content/clipper';

describe('clipper', () => {
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
          get: vi.fn().mockResolvedValue({ settings: { showClipButton: true } })
        }
      }
    } as any;
  });

  describe('detectPlatform', () => {
    it('should detect linkedin', () => {
      expect(detectPlatform('https://www.linkedin.com/jobs/view/123')).toBe('linkedin');
    });

    it('should fallback to company_site', () => {
      expect(detectPlatform('https://careers.google.com')).toBe('company_site');
    });
  });

  describe('isJobPage', () => {
    it('should return true for known job urls', () => {
      window.location.href = 'https://www.linkedin.com/jobs/view/123';
      expect(isJobPage()).toBe(true);
    });

    it('should return true if body has job keywords', () => {
      window.location.href = 'https://company.com/job/page';
      document.body.innerHTML = '<p>Apply for this job</p><p>Job Description and requirements</p>';
      expect(isJobPage()).toBe(true);
    });

    it('should return false for regular pages', () => {
      window.location.href = 'https://company.com/about';
      document.body.innerHTML = '<p>About us</p>';
      expect(isJobPage()).toBe(false);
    });
  });

  describe('extractJobInfo', () => {
    it('should extract generic job info from DOM', () => {
      window.location.href = 'https://careers.company.com/job/123';
      document.title = 'Software Engineer - Company';
      document.body.innerHTML = `
        <h1 class="job-title">Software Engineer</h1>
        <div class="company">Tech Corp</div>
        <p class="description">We are looking for a dev with React experience. This needs to be over 60 characters long to pass the filter.</p>
        <p class="description">Must have 3+ years experience building scalable web applications.</p>
        <span class="location">Remote</span>
        <span class="salary">$100k</span>
      `;

      const info = extractJobInfo();
      expect(info.role).toBe('Software Engineer');
      expect(info.company).toBe('Tech Corp');
      expect(info.location).toBe('Remote');
      expect(info.salary).toBe('$100k');
      expect(info.description).toContain('React experience');
      expect(info.platform).toBe('company_site');
    });
  });

  describe('extractJsonLdJobInfo', () => {
    it('should extract job details from JSON-LD schema', () => {
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
            "description": "<div>We are seeking a staff frontend engineer.</div>",
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
      expect(info?.description).toBe('We are seeking a staff frontend engineer.');
      expect(info?.location).toBe('Malibu, US');
      expect(info?.salary).toBe('180000 YEAR');
    });

    it('should return null if no JobPosting schema exists', () => {
      document.body.innerHTML = `
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Iron Man Armor Mk 85"
          }
        </script>
      `;
      const info = extractJsonLdJobInfo();
      expect(info).toBeNull();
    });
  });

  describe('extractCleanGenericDescription', () => {
    it('should identify the densest text container and clean up markup', () => {
      document.body.innerHTML = `
        <header>
          <nav><a href="/">Home</a><a href="/jobs">Jobs</a></nav>
        </header>
        <main>
          <div class="sidebar">
            <a href="/link1">Sidebar Link 1</a>
            <a href="/link2">Sidebar Link 2</a>
          </div>
          <article class="job-description-body">
            <h2>Job Description</h2>
            <p>Stark Industries is seeking a highly skilled Software Engineer to design, develop, and deploy clean codebase interfaces. This position requires deep expertise in React, TypeScript, and state management libraries.</p>
            <p>You will work on advanced web portals, ensuring top-tier performance, visual excellence, and responsive user experiences. Minimum requirements include a Bachelor's degree and 3+ years of experience.</p>
            <p>Apply today to join our elite engineering division!</p>
          </article>
        </main>
        <footer>
          <p>&copy; 2026 Stark Industries</p>
        </footer>
      `;

      const desc = extractCleanGenericDescription();
      expect(desc).toContain('Stark Industries is seeking');
      expect(desc).toContain('React, TypeScript');
      expect(desc).not.toContain('Home');
      expect(desc).not.toContain('Sidebar Link 1');
    });
  });

  describe('injectClipper', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should inject clipper button if it is a job page', () => {
      window.location.href = 'https://www.linkedin.com/jobs/view/123';
      const titleEl = document.createElement('h1');
      titleEl.className = 'jobs-unified-top-card__job-title';
      document.body.appendChild(titleEl);

      injectClipper();
      
      vi.advanceTimersByTime(500);
      
      const btn = document.querySelector('.af-inline-save-btn');
      expect(btn).not.toBeNull();
      expect(btn?.textContent).toContain('Save Job');
    });

    it('should not inject if not a job page', () => {
      window.location.href = 'https://example.com/about';
      injectClipper();
      
      vi.advanceTimersByTime(500);
      
      const btn = document.querySelector('.af-inline-save-btn');
      expect(btn).toBeNull();
    });
  });
});
