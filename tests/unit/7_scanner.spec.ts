/**
 * 7_scanner.spec.ts — Page Scanner Content Script Unit Tests
 *
 * Covers:
 *   • detectCaptcha — all selectors (reCAPTCHA, hCaptcha, Cloudflare, data-sitekey)
 *   • extractJobDetails — LinkedIn, Internshala, Unstop platform-specific selectors,
 *     generic fallback paragraphs, role/company/description trimming
 *   • scanFields — maps inputs to profile keys via matchField, handles custom_answer
 *     for essay/textarea fields, assigns synthetic IDs, skips hidden/submit inputs
 *   • scanFields platform detection embedded in ScanResult
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectCaptcha, extractJobDetails, scanFields } from '../../src/content/scanner';

// ── Chrome mock ────────────────────────────────────────────────────────────────

beforeEach(() => {
  document.body.innerHTML = '';
  document.title = '';
  Object.defineProperty(window, 'location', {
    value: { href: 'https://example.com' },
    writable: true
  });
  global.chrome = {
    runtime: { sendMessage: vi.fn() }
  } as any;
});

// ─────────────────────────────────────────────────────────────────────────────
// CAPTCHA DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe('detectCaptcha', () => {
  it('detects Google reCAPTCHA via iframe src', () => {
    document.body.innerHTML = '<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects hCaptcha via iframe src', () => {
    document.body.innerHTML = '<iframe src="https://newassets.hcaptcha.com/captcha/v1/abc"></iframe>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects generic captcha via iframe src containing "captcha"', () => {
    document.body.innerHTML = '<iframe src="https://custom-captcha.example.com/verify"></iframe>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects Cloudflare challenge via iframe src', () => {
    document.body.innerHTML = '<iframe src="https://challenges.cloudflare.com/cdn-cgi/challenge-platform/h/b/jsd/r/abc"></iframe>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects reCAPTCHA via .g-recaptcha class', () => {
    document.body.innerHTML = '<div class="g-recaptcha" data-sitekey="xyz"></div>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects reCAPTCHA via #recaptcha id', () => {
    document.body.innerHTML = '<div id="recaptcha"></div>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('detects via [data-sitekey] attribute', () => {
    document.body.innerHTML = '<div data-sitekey="6Lc123456789abcdef"></div>';
    expect(detectCaptcha(document)).toBe(true);
  });

  it('returns false when no captcha present', () => {
    document.body.innerHTML = '<div>No captcha here. Just a normal form.</div>';
    expect(detectCaptcha(document)).toBe(false);
  });

  it('returns false for empty DOM', () => {
    document.body.innerHTML = '';
    expect(detectCaptcha(document)).toBe(false);
  });

  it('does not false-positive on unrelated iframes', () => {
    document.body.innerHTML = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    expect(detectCaptcha(document)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXTRACT JOB DETAILS
// ─────────────────────────────────────────────────────────────────────────────

describe('extractJobDetails', () => {
  it('extracts role and company from generic DOM (h1 + company class)', () => {
    window.location.href = 'https://company.com/job';
    document.title = 'Backend Engineer';
    document.body.innerHTML = `
      <h1 class="job-title">Backend Engineer</h1>
      <div class="company-name">TechCorp</div>
      <div class="description-box">
        We are looking for a Node.js developer. This description must be at least 60 characters long so the filter keeps it.
      </div>
      <p>Must have 3 years experience building high-throughput distributed systems with PostgreSQL and Kafka.</p>
    `;
    const d = extractJobDetails();
    expect(d.role).toBe('Backend Engineer');
    expect(d.company).toBe('TechCorp');
    expect(d.jobDescription).toContain('Node.js');
  });

  it('falls back to document.title for role when h1 is absent', () => {
    window.location.href = 'https://company.com/job';
    document.title = 'Full Stack Engineer';
    document.body.innerHTML = `
      <div class="company-name">FallbackCo</div>
      <p>Some description text about the role responsibilities at least sixty chars long ok great.</p>
    `;
    const d = extractJobDetails();
    expect(d.role.length).toBeGreaterThan(0);
  });

  it('truncates role and company to 100 characters', () => {
    window.location.href = 'https://company.com/job';
    document.title = 'Role';
    document.body.innerHTML = `
      <h1>${'A'.repeat(200)}</h1>
      <div class="company-name">${'B'.repeat(200)}</div>
    `;
    const d = extractJobDetails();
    expect(d.role.length).toBeLessThanOrEqual(100);
    expect(d.company.length).toBeLessThanOrEqual(100);
  });

  it('truncates jobDescription to 8000 characters', () => {
    window.location.href = 'https://company.com/job';
    document.title = 'Engineer';
    document.body.innerHTML = `
      <h1>Engineer</h1>
      ${'<p>' + 'X'.repeat(500) + '</p>'.repeat(20)}
    `;
    const d = extractJobDetails();
    expect(d.jobDescription.length).toBeLessThanOrEqual(8000);
  });

  it('extracts LinkedIn job details using LinkedIn-specific selectors', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    document.body.innerHTML = `
      <h1 class="job-details-jobs-unified-top-card__job-title">Staff Product Designer</h1>
      <span class="job-details-jobs-unified-top-card__company-name">Figma Inc</span>
      <div class="jobs-description__container">
        We're looking for a visionary product designer. This description is long enough to pass the 60 char filter and contains important details about the design position.
      </div>
    `;
    const d = extractJobDetails();
    expect(d.role).toBe('Staff Product Designer');
    expect(d.company).toBe('Figma Inc');
    expect(d.jobDescription).toContain('visionary product designer');
  });

  it('extracts Internshala details with modal form selectors', () => {
    window.location.href = 'https://internshala.com/internship/detail/123';
    document.body.innerHTML = `
      <h3 class="heading_3 profile">Application for Software Engineering Internship</h3>
      <span class="heading_6 company_name">StartupXYZ</span>
      <div class="internship-details-container">
        This is a detail description of the internship opportunity that is at least sixty characters long.
      </div>
    `;
    const d = extractJobDetails();
    expect(d.role).toContain('Software Engineering');
  });

  it('extracts Unstop job details', () => {
    window.location.href = 'https://unstop.com/jobs/frontend-dev-123';
    document.body.innerHTML = `
      <span class="company-name">Tech Org</span>
      <h1>Frontend Developer</h1>
      <div class="job-description">
        We are hiring a frontend developer. This description is long enough to pass the sixty character limit filter.
      </div>
    `;
    const d = extractJobDetails();
    expect(d.role).toBe('Frontend Developer');
  });

  it('strips multi-line noise from company field (takes first line only)', () => {
    window.location.href = 'https://company.com/job';
    document.title = 'Dev';
    document.body.innerHTML = `
      <h1>Dev</h1>
      <div class="company-name">Acme Corp\n• Full time\n📍 Remote</div>
    `;
    const d = extractJobDetails();
    expect(d.company).not.toContain('\n');
    expect(d.company).not.toContain('Full time');
  });

  it('returns empty strings when nothing found', () => {
    window.location.href = 'https://company.com/job';
    document.title = '';
    document.body.innerHTML = '';
    const d = extractJobDetails();
    expect(d.role).toBe('');
    expect(d.company).toBe('');
    expect(d.jobDescription).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SCAN FIELDS
// ─────────────────────────────────────────────────────────────────────────────

describe('scanFields', () => {
  it('maps labeled name, email, phone inputs to profile keys', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <label for="nameInput">Full Name</label>
      <input id="nameInput" name="fname" type="text" />

      <label for="emailInput">Email Address</label>
      <input id="emailInput" type="email" />

      <label for="phoneInput">Mobile Number</label>
      <input id="phoneInput" type="tel" />
    `;
    const r = scanFields();
    expect(r.fields).toHaveLength(3);

    const nameField = r.fields.find(f => f.elementId === 'nameInput');
    expect(nameField?.mappedTo).toBe('name');

    const emailField = r.fields.find(f => f.elementId === 'emailInput');
    expect(emailField?.mappedTo).toBe('email');

    const phoneField = r.fields.find(f => f.elementId === 'phoneInput');
    expect(phoneField?.mappedTo).toBe('phone');
  });

  it('maps textarea with essay-type label to custom_answer', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <label for="why">Why do you want to work here?</label>
      <textarea id="why"></textarea>
    `;
    const r = scanFields();
    const whyField = r.fields.find(f => f.elementId === 'why');
    expect(whyField?.mappedTo).toBe('custom_answer');
  });

  it('maps textarea to custom_answer even without a label (textarea is always essay)', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <textarea id="textarea1"></textarea>
    `;
    const r = scanFields();
    const taField = r.fields.find(f => f.elementId === 'textarea1');
    expect(taField?.mappedTo).toBe('custom_answer');
  });

  it('ignores hidden, submit, button, file, checkbox, radio inputs', () => {
    document.body.innerHTML = `
      <input type="hidden" id="h1" value="token" />
      <input type="submit" id="s1" value="Submit" />
      <input type="button" id="b1" value="Reset" />
      <input type="file" id="f1" />
      <input type="checkbox" id="c1" />
      <input type="radio" id="r1" />
    `;
    const r = scanFields();
    expect(r.fields).toHaveLength(0);
  });

  it('assigns synthetic id if element has no id', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <label>Email</label>
      <input type="email" name="emailAddr" />
    `;
    const r = scanFields();
    const emailField = r.fields.find(f => f.mappedTo === 'email');
    expect(emailField).toBeDefined();
    expect(emailField?.elementId).toBe('emailAddr'); // uses name as fallback
  });

  it('detects LinkedIn platform from URL in ScanResult', () => {
    window.location.href = 'https://www.linkedin.com/jobs/view/123';
    document.body.innerHTML = '<input type="text" id="n" />';
    const r = scanFields();
    expect(r.platform).toBe('linkedin');
  });

  it('detects Greenhouse platform from URL in ScanResult', () => {
    window.location.href = 'https://boards.greenhouse.io/company/jobs/123';
    document.body.innerHTML = '<input type="text" id="n" />';
    const r = scanFields();
    expect(r.platform).toBe('greenhouse');
  });

  it('detects Workday platform from URL in ScanResult', () => {
    window.location.href = 'https://company.myworkdayjobs.com/apply/job/123';
    document.body.innerHTML = '<input type="text" id="n" />';
    const r = scanFields();
    expect(r.platform).toBe('workday');
  });

  it('includes hasCaptcha=true when reCAPTCHA present', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <div class="g-recaptcha"></div>
      <input type="text" id="n" />
    `;
    const r = scanFields();
    expect(r.hasCaptcha).toBe(true);
  });

  it('includes hasCaptcha=false when no captcha present', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = '<input type="text" id="n" />';
    const r = scanFields();
    expect(r.hasCaptcha).toBe(false);
  });

  it('returns correct url and scannedAt in result', () => {
    window.location.href = 'https://test.jobs.com/apply';
    document.body.innerHTML = '';
    const before = Date.now();
    const r = scanFields();
    expect(r.url).toBe('https://test.jobs.com/apply');
    expect(r.scannedAt).toBeGreaterThanOrEqual(before);
  });

  it('detects confidence scores for each field', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <label for="em">Email Address</label>
      <input id="em" type="email" />
    `;
    const r = scanFields();
    const emailField = r.fields.find(f => f.elementId === 'em');
    expect(emailField?.confidence).toBeGreaterThan(50);
  });

  it('handles select elements and maps them correctly', () => {
    window.location.href = 'https://company.com/apply';
    document.body.innerHTML = `
      <label for="gradYr">Graduation Year</label>
      <select id="gradYr">
        <option value="">Select</option>
        <option value="2024">2024</option>
        <option value="2025">2025</option>
      </select>
    `;
    const r = scanFields();
    const yearField = r.fields.find(f => f.elementId === 'gradYr');
    expect(yearField?.mappedTo).toBe('graduationYear');
  });

  it('handles large forms with many fields without error', () => {
    window.location.href = 'https://company.com/apply';
    const inputs = Array.from({ length: 50 }, (_, i) =>
      `<input id="field-${i}" type="text" placeholder="Field ${i}" />`
    ).join('\n');
    document.body.innerHTML = `<form>${inputs}</form>`;
    expect(() => scanFields()).not.toThrow();
  });
});
