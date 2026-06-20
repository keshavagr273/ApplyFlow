import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Tracker from '../../../src/side-panel/screens/Tracker';
import { useStore } from '../../../src/shared/store';
import { Application } from '../../../src/shared/types';

// Mock zustand store
vi.mock('../../../src/shared/store', () => ({
  useStore: vi.fn(),
}));

// Mock lucide-react icons used in Tracker.tsx
vi.mock('lucide-react', () => ({
  Pin: () => <div>Pin</div>,
  Mail: () => <div>Mail</div>,
  ClipboardList: () => <div>ClipboardList</div>,
  Calendar: () => <div>Calendar</div>,
  Award: () => <div>Award</div>,
  XCircle: () => <div>XCircle</div>,
  ArrowLeft: () => <div>ArrowLeft</div>,
  Search: () => <div>Search</div>,
}));

describe('Tracker Screen', () => {
  const mockApp: Application = {
    id: '123',
    company: 'Tech Corp',
    role: 'Frontend Engineer',
    url: 'https://techcorp.com/jobs/1',
    platform: 'company_site',
    status: 'applied',
    appliedAt: Date.now(),
    notes: 'A note',
  };

  beforeEach(() => {
    (useStore as any).mockReturnValue({
      applications: [mockApp],
      updateApplication: vi.fn(),
      deleteApplication: vi.fn(),
      showToast: vi.fn(),
    });
  });

  it('renders application correctly', () => {
    render(<Tracker />);
    
    expect(screen.getByText('Tech Corp')).toBeDefined();
    expect(screen.getByText('Frontend Engineer')).toBeDefined();
  });

  it('filters applications by status', () => {
    render(<Tracker />);
    
    // Check if the application is displayed initially
    expect(screen.getByText('Tech Corp')).toBeDefined();

    // Click 'Saved' filter chip (which should have count 0 because mockApp is 'applied')
    const savedChip = screen.getByText('Saved');
    fireEvent.click(savedChip);

    // It should now show "No applications found"
    expect(screen.getByText('No applications found')).toBeDefined();
  });
});
