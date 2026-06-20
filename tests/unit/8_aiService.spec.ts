/**
 * 8_aiService.spec.ts — GroqAIService Unit Tests
 *
 * Covers all public methods of GroqAIService:
 *   • parseResume — demo mode, real Groq API call, JSON extraction from markdown,
 *     malformed JSON error, network error
 *   • analyzeJobDescription — demo mode, real Groq call
 *   • generateCoverLetter — demo mode (contains hiring manager / name / company),
 *     real Groq call
 *   • optimizeResume — demo mode score, real Groq call
 *   • generateInterviewPrep — demo mode questions array, real Groq call
 *   • smartMatchFields — demo mode (direct profile match + custom_answer),
 *     real Groq call response parsing
 *   • _callGroq — 400 HTTP error, AbortError timeout, network failure
 *   • JSON extraction from markdown code-fenced responses
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GroqAIService } from '../../src/shared/aiService';
import { UserProfile } from '../../src/shared/types';

// ── Fixture profile ───────────────────────────────────────────────────────────

const profile: UserProfile = {
  name: 'Arjun Nair',
  email: 'arjun.nair@gmail.com',
  phone: '9876501234',
  college: 'NIT Trichy',
  degree: 'B.Tech ECE',
  graduationYear: '2025',
  skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
  resumeLink: '',
  linkedinUrl: 'https://linkedin.com/in/arjun',
  portfolioUrl: 'https://arjun.dev',
  resumeText: 'Arjun Nair is a full stack developer specializing in React and Node.js.',
  customAnswers: [],
  projects: [],
  workExperience: [],
  createdAt: Date.now(),
  updatedAt: Date.now()
};

beforeEach(() => {
  global.fetch = vi.fn();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockGroqSuccess(content: string) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] })
  });
}

function mockGroqFailure(status: number, text: string) {
  (global.fetch as any).mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => text
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// parseResume
// ─────────────────────────────────────────────────────────────────────────────

describe('parseResume', () => {
  it('returns demo data in demo mode without calling fetch', async () => {
    const result = await GroqAIService.parseResume('any text', '', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.name).toBeTruthy();
    expect(result.skills).toBeDefined();
    expect(Array.isArray(result.skills)).toBe(true);
    expect(result.skills!.length).toBeGreaterThan(0);
  });

  it('calls Groq API in real mode and parses JSON response', async () => {
    mockGroqSuccess('{"name":"Real Name","email":"real@test.com","skills":["Python"]}');
    const result = await GroqAIService.parseResume('resume text here', 'api-key', false);
    expect(global.fetch).toHaveBeenCalled();
    expect(result.name).toBe('Real Name');
    expect(result.email).toBe('real@test.com');
    expect(result.skills).toBeDefined();
    expect(result.skills).toContain('Python');
  });

  it('extracts JSON from markdown code fence in response', async () => {
    mockGroqSuccess('```json\n{"name":"Fenced User","skills":["Go"]}\n```');
    const result = await GroqAIService.parseResume('text', 'key', false);
    expect(result.name).toBe('Fenced User');
  });

  it('extracts JSON from plain code fence (no language tag)', async () => {
    mockGroqSuccess('```\n{"name":"Plain Fence","skills":[]}\n```');
    const result = await GroqAIService.parseResume('text', 'key', false);
    expect(result.name).toBe('Plain Fence');
  });

  it('throws on malformed JSON from API', async () => {
    mockGroqSuccess('{bad json here}');
    await expect(GroqAIService.parseResume('text', 'key', false)).rejects.toThrow(/Failed to parse AI response/);
  });

  it('throws when API returns HTTP error', async () => {
    mockGroqFailure(400, 'Bad Request');
    await expect(GroqAIService.parseResume('text', 'key', false)).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// analyzeJobDescription
// ─────────────────────────────────────────────────────────────────────────────

describe('analyzeJobDescription', () => {
  it('returns mock analysis in demo mode', async () => {
    const result = await GroqAIService.analyzeJobDescription('resume text', 'job desc', '', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(typeof result.matchScore).toBe('number');
    expect(result.matchScore).toBeGreaterThan(0);
    expect(result.matchScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.strongSkills)).toBe(true);
    expect(Array.isArray(result.missingSkills)).toBe(true);
  });

  it('demo mode returns matchScore of 84', async () => {
    const result = await GroqAIService.analyzeJobDescription('resume', 'job', '', true);
    expect(result.matchScore).toBe(84);
  });

  it('calls Groq API in real mode and parses JSON', async () => {
    mockGroqSuccess('{"matchScore":92,"strongSkills":["React"],"missingSkills":["Docker"]}');
    const result = await GroqAIService.analyzeJobDescription('resume', 'job', 'key', false);
    expect(result.matchScore).toBe(92);
    expect(result.strongSkills).toContain('React');
    expect(result.missingSkills).toContain('Docker');
  });

  it('handles empty resume text gracefully in demo mode', async () => {
    const result = await GroqAIService.analyzeJobDescription('', 'job', '', true);
    expect(result).not.toBeNull();
    expect(result.matchScore).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateCoverLetter
// ─────────────────────────────────────────────────────────────────────────────

describe('generateCoverLetter', () => {
  it('generates demo cover letter with "Dear Hiring Manager", company name, and candidate name', async () => {
    const result = await GroqAIService.generateCoverLetter('Google', 'SWE', profile, 'Job description here', '', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result).toContain('Dear Hiring Manager');
    expect(result).toContain('Google');
    expect(result).toContain('Arjun Nair');
  });

  it('demo cover letter mentions the role', async () => {
    const result = await GroqAIService.generateCoverLetter('Stripe', 'Backend Engineer', profile, 'desc', '', true);
    expect(result.toLowerCase()).toContain('backend');
  });

  it('calls Groq API in real mode', async () => {
    const mockLetter = 'Dear Hiring Manager,\n\nI am writing to apply for the SWE role.\n\nSincerely,\nArjun';
    mockGroqSuccess(mockLetter);
    const result = await GroqAIService.generateCoverLetter('Amazon', 'SWE', profile, 'desc', 'key', false);
    expect(global.fetch).toHaveBeenCalled();
    expect(result).toContain('Dear Hiring Manager');
  });

  it('handles profile with empty resumeText in demo mode', async () => {
    const p = { ...profile, resumeText: '' };
    const result = await GroqAIService.generateCoverLetter('Co', 'Dev', p, 'desc', '', true);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// optimizeResume
// ─────────────────────────────────────────────────────────────────────────────

describe('optimizeResume', () => {
  it('returns demo optimization with score=72 and suggestions in demo mode', async () => {
    const result = await GroqAIService.optimizeResume(profile, 'job desc', '', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.score).toBe(72);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('calls Groq API in real mode and parses score + suggestions', async () => {
    mockGroqSuccess('{"score":88,"suggestions":["Add Docker","Quantify achievements"]}');
    const result = await GroqAIService.optimizeResume(profile, 'job', 'key', false);
    expect(result.score).toBe(88);
    expect(result.suggestions).toContain('Add Docker');
  });

  it('real mode result has score in 0-100 range', async () => {
    mockGroqSuccess('{"score":55,"suggestions":["Improve summary"]}');
    const result = await GroqAIService.optimizeResume(profile, 'job', 'key', false);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// generateInterviewPrep
// ─────────────────────────────────────────────────────────────────────────────

describe('generateInterviewPrep', () => {
  it('returns interview questions array in demo mode', async () => {
    const result = await GroqAIService.generateInterviewPrep(profile, 'React job', '', true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('each demo question has question and answer properties', async () => {
    const result = await GroqAIService.generateInterviewPrep(profile, 'job', '', true);
    expect(result.length).toBeGreaterThan(0);
    // All items must have question and answer as strings
    const allValid = result.every(q =>
      typeof q.question === 'string' &&
      q.question.length > 0 &&
      typeof q.answer === 'string' &&
      q.answer.length > 0
    );
    expect(allValid).toBe(true);
  });

  it('calls Groq API in real mode and parses question array', async () => {
    mockGroqSuccess('[{"question":"Tell me about yourself","answer":"I am a full stack developer..."}]');
    const result = await GroqAIService.generateInterviewPrep(profile, 'job', 'key', false);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('question');
    expect(result[0]).toHaveProperty('answer');
  });

  it('handles plain JSON array response in real mode', async () => {
    mockGroqSuccess('[{"question":"What is closure?","answer":"A function that retains scope."}]');
    const result = await GroqAIService.generateInterviewPrep(profile, 'job', 'key', false);
    expect(result[0].question).toBe('What is closure?');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// smartMatchFields
// ─────────────────────────────────────────────────────────────────────────────

describe('smartMatchFields', () => {
  const fields = [
    { elementId: 'name-field', label: 'Full Name', placeholder: '', inputType: 'text' },
    { elementId: 'email-field', label: 'Email Address', placeholder: '', inputType: 'email' },
    { elementId: 'why-field', label: 'Why do you want to join?', placeholder: '', inputType: 'textarea' }
  ];

  it('returns array of matched fields in demo mode', async () => {
    const result = await GroqAIService.smartMatchFields(fields, profile, '', true);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);
  });

  it('demo mode correctly maps name field', async () => {
    const result = await GroqAIService.smartMatchFields(fields, profile, '', true);
    const nameMatch = result.find(r => r.mappedTo === 'name');
    expect(nameMatch).toBeDefined();
    expect(nameMatch?.value).toBe('Arjun Nair');
  });

  it('demo mode correctly maps email field', async () => {
    const result = await GroqAIService.smartMatchFields(fields, profile, '', true);
    const emailMatch = result.find(r => r.mappedTo === 'email');
    expect(emailMatch?.value).toBe('arjun.nair@gmail.com');
  });

  it('demo mode maps custom essay field to custom_answer', async () => {
    const result = await GroqAIService.smartMatchFields(fields, profile, '', true);
    const whyMatch = result.find(r => r.elementId === 'why-field');
    expect(whyMatch?.mappedTo).toBe('custom_answer');
    expect(whyMatch?.value).toContain('motivated');
  });

  it('calls Groq API in real mode and maps result', async () => {
    mockGroqSuccess('[{"elementId":"name-field","value":"Arjun","mappedTo":"name"},{"elementId":"email-field","value":"arjun.nair@gmail.com","mappedTo":"email"}]');
    const result = await GroqAIService.smartMatchFields(fields, profile, 'key', false);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBe('Arjun');
  });

  it('handles empty fields array', async () => {
    const result = await GroqAIService.smartMatchFields([], profile, '', true);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _callGroq (internal API caller)
// ─────────────────────────────────────────────────────────────────────────────

describe('_callGroq', () => {
  it('throws "Groq API Error (400)" on 400 HTTP response', async () => {
    mockGroqFailure(400, 'Bad Request');
    await expect(GroqAIService._callGroq('test prompt', 'api-key')).rejects.toThrow('Groq API Error (400): Bad Request');
  });

  it('throws "Groq API Error (500)" on 500 HTTP response', async () => {
    mockGroqFailure(500, 'Internal Server Error');
    await expect(GroqAIService._callGroq('test prompt', 'api-key')).rejects.toThrow('Groq API Error (500)');
  });

  it('throws timeout error on AbortError', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    (global.fetch as any).mockRejectedValueOnce(abortError);
    await expect(GroqAIService._callGroq('test', 'key')).rejects.toThrow('Groq API Error: Request timed out');
  });

  it('propagates network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network down'));
    await expect(GroqAIService._callGroq('test', 'key')).rejects.toThrow();
  });

  it('returns response string on success', async () => {
    mockGroqSuccess('Test response from API');
    const result = await GroqAIService._callGroq('test prompt', 'valid-key');
    expect(result).toBe('Test response from API');
  });

  it('calls the Groq API directly', async () => {
    mockGroqSuccess('ok');
    await GroqAIService._callGroq('test', 'my-secret-key');
    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(callArgs[1].headers['Authorization']).toBe('Bearer my-secret-key');
    const body = JSON.parse(callArgs[1]?.body);
    expect(body.model).toBe('llama-3.3-70b-versatile');
  });
});
