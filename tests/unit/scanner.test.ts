import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectCaptcha, extractJobDetails, scanFields } from '../../src/content/scanner';

describe('scanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = '';
    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com' },
      writable: true
    });
    global.chrome = {
      runtime: {
        sendMessage: vi.fn()
      }
    } as any;
  });

  describe('detectCaptcha', () => {
    it('should detect recaptcha iframe', () => {
      document.body.innerHTML = '<iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe>';
      expect(detectCaptcha(document)).toBe(true);
    });

    it('should return false if no captcha', () => {
      document.body.innerHTML = '<div>No captcha here</div>';
      expect(detectCaptcha(document)).toBe(false);
    });
  });

  describe('extractJobDetails', () => {
    it('should extract fallback job details from DOM', () => {
      window.location.href = 'https://company.com/job';
      document.title = 'Backend Engineer';
      document.body.innerHTML = `
        <h1 class="job-title">Backend Engineer</h1>
        <div class="company-name">Tech Corp</div>
        <div class="description-box">We are looking for a Node.js dev. This description must be at least 60 characters long so that the filter doesn't remove it during parsing.</div>
        <p>Must have 3 years experience building cool things.</p>
      `;

      const details = extractJobDetails();
      expect(details.role).toBe('Backend Engineer');
      expect(details.company).toBe('Tech Corp');
      expect(details.jobDescription).toContain('Node.js');
    });
  });

  describe('scanFields', () => {
    it('should identify fields and map them to profile keys', () => {
      window.location.href = 'https://company.com/apply';
      document.title = 'Apply';
      document.body.innerHTML = `
        <label for="firstName">First Name</label>
        <input id="firstName" name="fname" type="text" />

        <input id="emailField" placeholder="Email Address" type="email" />

        <label for="why">Why do you want to work here?</label>
        <textarea id="why"></textarea>
      `;

      const result = scanFields();
      
      expect(result.fields).toHaveLength(3);
      
      const fNameField = result.fields.find(f => f.elementId === 'firstName');
      expect(fNameField?.mappedTo).toBe('name');

      const emailField = result.fields.find(f => f.elementId === 'emailField');
      expect(emailField?.mappedTo).toBe('email');

      const customField = result.fields.find(f => f.elementId === 'why');
      expect(customField?.mappedTo).toBe('custom_answer');
    });

    it('should ignore hidden inputs and buttons', () => {
      document.body.innerHTML = `
        <input type="hidden" id="token" value="abc" />
        <input type="submit" id="submitBtn" value="Submit" />
      `;

      const result = scanFields();
      expect(result.fields).toHaveLength(0);
    });
  });
});
