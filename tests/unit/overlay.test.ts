import { describe, it, expect, beforeEach, vi } from 'vitest';
import { extractJobInfo, analyzeJob, injectOverlay } from '../../src/content/overlay';
import { UserProfile } from '../../src/shared/types';

describe('overlay', () => {
  const mockProfile: UserProfile = {
    name: 'Alex Mercer',
    email: 'alex.mercer@gmail.com',
    phone: '9876543211',
    college: 'IIT Kanpur',
    degree: 'B.Tech Mechanical',
    graduationYear: '2025',
    skills: ['React', 'Node.js'],
    resumeLink: '',
    linkedinUrl: '',
    portfolioUrl: '',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    global.chrome = {
      runtime: {
        getURL: vi.fn().mockReturnValue('mock-url'),
      }
    } as any;
  });

  describe('extractJobInfo', () => {
    it('should extract info from linkedin', () => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.linkedin.com/jobs/view/123' },
        writable: true
      });

      document.body.innerHTML = `
        <div class="job-details-jobs-unified-top-card__company-name">Google</div>
        <div class="job-details-jobs-unified-top-card__job-title">Software Engineer</div>
        <div class="jobs-description__container">We need React and Node.js.</div>
      `;

      const info = extractJobInfo();
      expect(info.company).toBe('Google');
      expect(info.role).toBe('Software Engineer');
      expect(info.jobDescription).toContain('React');
    });
  });

  describe('analyzeJob', () => {
    it('should calculate match score in demo mode', async () => {
      const info = await analyzeJob(mockProfile, 'We need React and Node.js', '', true);
      expect(info.matchScore).toBeGreaterThan(70);
      expect(info.strongSkills).toContain('React');
      expect(info.strongSkills).toContain('Node.js');
    });

    it('should handle API calls in real mode', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"matchScore": 90, "strongSkills": ["React"], "missingSkills": []}' }] } }]
        })
      });

      const info = await analyzeJob(mockProfile, 'Job desc', 'api-key', false);
      expect(info.matchScore).toBe(90);
    });
  });

  describe('injectOverlay', () => {
    it('should inject shadow DOM overlay widget into the page', () => {
      const analysis = { matchScore: 85, strongSkills: ['React'], missingSkills: ['Docker'] };
      const jobInfo = { company: 'Google', role: 'SWE', jobDescription: '' };

      injectOverlay(analysis, jobInfo, mockProfile);

      const container = document.getElementById('af-overlay-container');
      expect(container).not.toBeNull();
      
      const shadow = container?.shadowRoot;
      expect(shadow).toBeDefined();

      const widget = shadow?.querySelector('.af-widget');
      expect(widget).not.toBeNull();
      
      // Check score
      expect(widget?.textContent).toContain('85%');
    });
  });
});
