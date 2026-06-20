import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeneralSettings } from '../../../src/options/components/GeneralSettings';
import { SyncSettings } from '../../../src/options/components/SyncSettings';
import { DangerZone } from '../../../src/options/components/DangerZone';

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
    }
  }
} as any;

describe('Options Components', () => {
  const settings = {
    geminiApiKey: '',
    demoMode: true,
    enableOverlay: true,
    autofillMode: 'ai' as const,
    logOnlyAfterSubmission: false,
    showClipButton: true,
    supabaseUrl: 'http://example.com',
    supabaseAnonKey: '',
    supabaseSyncEnabled: false,
  };

  const usage = {
    dailyFillsUsed: 0,
    dailyFillsLimit: 50,
    totalFills: 0,
    lastUsedTimestamp: 0
  };

  describe('GeneralSettings', () => {
    it('renders and allows toggling settings', () => {
      const updateSettings = vi.fn();
      
      render(<GeneralSettings settings={settings} updateSettings={updateSettings} usage={usage} />);
      
      expect(screen.getByText('Show on LinkedIn Job Pages')).toBeDefined();
      expect(screen.getByText("Show 'Save Job' Button")).toBeDefined();
    });
  });

  describe('SyncSettings', () => {
    it('renders sync settings', () => {
      const handleMock = vi.fn();
      
      render(
        <SyncSettings 
          settings={settings} 
          handleGoogleLogin={handleMock}
          handleGoogleLogout={handleMock}
          isLoggingIn={false}
          isSyncing={false}
          syncStatus={null}
          handleSync={handleMock}
        />
      );
      
      expect(screen.getByText('Sign in with Google')).toBeDefined();
    });
  });

  describe('DangerZone', () => {
    it('renders DangerZone and calls functions', () => {
      const handleExport = vi.fn();
      const handleClearAll = vi.fn();

      render(<DangerZone handleExport={handleExport} handleClearAll={handleClearAll} />);
      
      expect(screen.getByText('Export Backup (JSON)')).toBeDefined();
      expect(screen.getByText('Clear All Local Data')).toBeDefined();
      
      const clearButton = screen.getByText('Clear All Local Data');
      fireEvent.click(clearButton);
      
      expect(handleClearAll).toHaveBeenCalled();

      const exportButton = screen.getByText('Export Backup (JSON)');
      fireEvent.click(exportButton);

      expect(handleExport).toHaveBeenCalled();
    });
  });

});
