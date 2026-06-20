import React from 'react';
import { createRoot } from 'react-dom/client';
import SidePanelApp from './SidePanelApp.tsx';
import { ErrorBoundary } from '../popup/components/ErrorBoundary';
import '../globals.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <SidePanelApp />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
