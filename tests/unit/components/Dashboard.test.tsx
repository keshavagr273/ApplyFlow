import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from '../../../src/side-panel/screens/Dashboard';
import { useStore } from '../../../src/shared/store';

// Mock zustand store
vi.mock('../../../src/shared/store', () => ({
  useStore: vi.fn(),
}));

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    }
  }
} as any;

describe('Dashboard Component', () => {
  beforeEach(() => {
    (useStore as any).mockReturnValue({
      profile: { name: 'Keshav Agrawal' },
      applications: [],
      settings: {},
      tabContext: null,
      addApplication: vi.fn(),
      showToast: vi.fn(),
    });
  });

  it('renders greeting and user name', () => {
    render(<Dashboard onNavigate={vi.fn()} />);
    
    expect(screen.getByText(/Keshav/)).toBeDefined();
    expect(screen.getByText('Start applying to track your progress')).toBeDefined();
  });

  it('renders job page context when on a job page', () => {
    (useStore as any).mockReturnValue({
      profile: { name: 'Keshav Agrawal', resumeText: 'My Resume' },
      applications: [],
      settings: {},
      tabContext: {
        isJobPage: true,
        url: 'https://linkedin.com/jobs/view/123',
        platform: 'linkedin',
        company: 'Google',
        role: 'Software Engineer',
        jobDescription: 'Job description text'
      },
      addApplication: vi.fn(),
      showToast: vi.fn(),
    });

    render(<Dashboard onNavigate={vi.fn()} />);
    
    expect(screen.getByText('LinkedIn')).toBeDefined();
    expect(screen.getByText(/Software Engineer/)).toBeDefined();
  });
});
