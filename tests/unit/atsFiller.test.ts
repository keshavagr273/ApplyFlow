import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectATSPlatform, runATSFill, detectSubmissionSuccess } from '../../src/content/atsFiller';
import { UserProfile } from '../../src/shared/types';

describe('atsFiller', () => {
  const mockProfile: UserProfile = {
    name: 'Alex Mercer',
    email: 'alex.mercer@gmail.com',
    phone: '9876543211',
    college: 'IIT Kanpur',
    degree: 'B.Tech Mechanical',
    graduationYear: '2025',
    skills: ['React', 'TypeScript', 'Docker'],
    resumeLink: '',
    linkedinUrl: 'https://linkedin.com/in/alex',
    portfolioUrl: '',
    resumeText: '',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    gender: 'male',
    veteran: 'no',
    workAuthorized: true
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    // Mock chrome storage
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ settings: { isPremium: true } })
        }
      }
    } as any;
  });

  describe('detectATSPlatform', () => {
    it('should detect linkedin', () => {
      expect(detectATSPlatform('https://www.linkedin.com/jobs')).toBe('linkedin');
    });

    it('should detect workday', () => {
      expect(detectATSPlatform('https://company.myworkdayjobs.com/en-US/careers')).toBe('workday');
    });

    it('should fallback to generic', () => {
      expect(detectATSPlatform('https://random.company.com/apply')).toBe('generic');
    });
  });

  describe('detectSubmissionSuccess', () => {
    it('should detect success from url', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://company.com/applied/success' },
        writable: true
      });
      expect(detectSubmissionSuccess()).toBe(true);
    });

    it('should detect success from body text', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://company.com/apply' },
        writable: true
      });
      document.body.innerHTML = '<h1>Thank you for applying</h1>';
      expect(detectSubmissionSuccess()).toBe(true);
    });

    it('should return false if no match', () => {
      document.body.innerHTML = '<h1>Apply Now</h1>';
      expect(detectSubmissionSuccess()).toBe(false);
    });
  });

  describe('runATSFill', () => {
    it('should fill linkedin form inputs', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.linkedin.com/jobs/view/123' },
        writable: true
      });

      document.body.innerHTML = `
        <form>
          <input id="firstName" type="text" />
          <input id="lastName" type="text" />
          <input id="email-address" aria-label="Email" type="text" />
          <input id="phone-number" aria-label="Phone" type="text" />
        </form>
      `;

      const result = await runATSFill(mockProfile);
      
      expect(result.platform).toBe('linkedin');
      expect((document.getElementById('firstName') as HTMLInputElement).value).toBe('Alex');
      expect((document.getElementById('lastName') as HTMLInputElement).value).toBe('Mercer');
    });

    it('should fill generic inputs based on labels', async () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://random.com/apply' },
        writable: true
      });

      document.body.innerHTML = `
        <form>
          <label for="college">University Attended</label>
          <input id="college" type="text" />
          
          <input id="passingYear" name="grad" type="text" placeholder="Passout year" />
        </form>
      `;

      const result = await runATSFill(mockProfile);
      
      expect(result.platform).toBe('generic');
      expect((document.getElementById('college') as HTMLInputElement).value).toBe('IIT Kanpur');
      expect((document.getElementById('passingYear') as HTMLInputElement).value).toBe('2025');
    });

    it('should block non-premium users on non-free platforms', async () => {
      global.chrome.storage.local.get = vi.fn().mockResolvedValue({ settings: { isPremium: false } });
      
      Object.defineProperty(window, 'location', {
        value: { href: 'https://company.myworkdayjobs.com/apply' },
        writable: true
      });

      document.body.innerHTML = '<input id="firstName" type="text" />';

      const result = await runATSFill(mockProfile);
      
      // Should not fill because Workday is premium
      expect(result.platform).toBe('workday');
      expect(result.filled).toBe(0);
      expect((document.getElementById('firstName') as HTMLInputElement).value).toBe('');
      
      // Upgrade modal should be added
      expect(document.getElementById('af-premium-blocker-modal')).not.toBeNull();
    });
  });
});
