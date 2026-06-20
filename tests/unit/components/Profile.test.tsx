import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Profile from '../../../src/side-panel/screens/Profile';
import { useStore } from '../../../src/shared/store';
import { UserProfile } from '../../../src/shared/types';

// Mock zustand store
vi.mock('../../../src/shared/store', () => ({
  useStore: vi.fn(),
}));

// Mock ResumeUploader since it contains file inputs/chrome extensions triggers
vi.mock('../../../src/popup/components/profile/ResumeUploader', () => ({
  ResumeUploader: () => <div>ResumeUploader Mock</div>,
}));

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    }
  }
} as any;

describe('Profile Screen', () => {
  const mockProfile: UserProfile = {
    name: 'Keshav Agrawal',
    email: 'keshav@gmail.com',
    phone: '9876543210',
    college: 'IIT Bombay',
    degree: 'B.Tech',
    graduationYear: '2026',
    skills: ['React', 'TypeScript'],
    resumeLink: '',
    linkedinUrl: '',
    portfolioUrl: '',
    resumeText: 'Sample resume text',
    customAnswers: [],
    projects: [],
    workExperience: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  beforeEach(() => {
    (useStore as any).mockReturnValue({
      profile: mockProfile,
      updateProfile: vi.fn(),
      showToast: vi.fn(),
      settings: {},
      resumeHistory: [],
      deleteResumeFromHistory: vi.fn(),
    });
  });

  it('renders accordion sections correctly', () => {
    render(<Profile />);
    
    expect(screen.getByText('Resume')).toBeDefined();
    expect(screen.getByText('Personal Info')).toBeDefined();
    expect(screen.getByText('Location')).toBeDefined();
  });

  it('allows expanding Personal Info and editing inputs', () => {
    render(<Profile />);
    
    // Expand Personal Info section
    const personalHeader = screen.getByText('Personal Info');
    fireEvent.click(personalHeader);

    // Full Name input should be visible with current value
    const nameInput = screen.getByPlaceholderText('Kesha Vagrawal') as HTMLInputElement;
    expect(nameInput.value).toBe('Keshav Agrawal');

    // Change full name value
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    expect(nameInput.value).toBe('New Name');
  });
});
