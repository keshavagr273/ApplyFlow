import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqAIService } from '../../src/shared/aiService';
import { UserProfile } from '../../src/shared/types';

describe('GroqAIService', () => {
  const mockProfile: UserProfile = {
    name: 'Alex Mercer',
    email: 'alex.mercer@gmail.com',
    phone: '9876543211',
    college: 'IIT Kanpur',
    degree: 'B.Tech Mechanical',
    graduationYear: '2025',
    skills: ['React', 'TypeScript', 'Docker'],
    resumeLink: '',
    linkedinUrl: '',
    portfolioUrl: '',
    resumeText: 'Alex Mercer, Full Stack Developer with React and TypeScript.',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  describe('parseResume', () => {
    it('should return mock data in demo mode', async () => {
      const result = await GroqAIService.parseResume('some resume text', '', true);
      expect(result.name).toBe('Kushal Sen'); // Demo default
      expect(result.skills).toContain('React');
    });

    it('should call groq API in real mode and parse JSON', async () => {
      const mockApiResponse = {
        choices: [{ message: { content: '{"name": "Real Name"}' } }]
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await GroqAIService.parseResume('test', 'test-api-key', false);
      expect(global.fetch).toHaveBeenCalled();
      expect(result.name).toBe('Real Name');
    });
    it('should handle malformed JSON from groq API gracefully', async () => {
      const mockApiResponse = {
        choices: [{ message: { content: '{"name": "Real Name", }' } }] // invalid JSON
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      await expect(GroqAIService.parseResume('test', 'test-api-key', false)).rejects.toThrow(/Failed to parse AI response/);
    });
  });

  describe('smartMatchFields', () => {
    const fields = [
      { elementId: 'name-field', label: 'Full Name', placeholder: '', inputType: 'text' },
      { elementId: 'why-field', label: 'Why do you want to work here?', placeholder: '', inputType: 'textarea' }
    ];

    it('should match exact fields and generate custom answers in demo mode', async () => {
      const result = await GroqAIService.smartMatchFields(fields, mockProfile, '', true);
      
      expect(result.length).toBe(2);
      expect(result[0].value).toBe('Alex Mercer');
      expect(result[0].mappedTo).toBe('name');
      
      expect(result[1].mappedTo).toBe('custom_answer');
      expect(result[1].value).toContain('highly motivated');
    });

    it('should call groq API in real mode', async () => {
      const mockApiResponse = {
        choices: [{ message: { content: '[{"elementId": "name-field", "value": "Alex", "mappedTo": "name"}]' } }]
      };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      });

      const result = await GroqAIService.smartMatchFields(fields, mockProfile, 'test-key', false);
      expect(result[0].value).toBe('Alex');
    });
  });

  describe('analyzeJobDescription', () => {
    it('should return mock analysis in demo mode', async () => {
      const result = await GroqAIService.analyzeJobDescription('resume', 'job', '', true);
      expect(result.matchScore).toBe(84);
      expect(result.strongSkills).toContain('React');
    });
  });

  describe('generateCoverLetter', () => {
    it('should generate a cover letter in demo mode', async () => {
      const result = await GroqAIService.generateCoverLetter('Google', 'SWE', mockProfile, 'Job desc', '', true);
      expect(result).toContain('Dear Hiring Manager');
      expect(result).toContain('Google');
      expect(result).toContain('Alex Mercer');
    });
  });

  describe('_callGroq', () => {
    it('should throw error on failed request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });

      await expect(GroqAIService._callGroq('test', 'test-key')).rejects.toThrow('Groq API Error (400): Bad Request');
    });

    it('should throw timeout error on AbortError', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      (global.fetch as any).mockRejectedValueOnce(abortError);

      await expect(GroqAIService._callGroq('test', 'test-key')).rejects.toThrow('Groq API Error: Request timed out');
    });
  });
});
