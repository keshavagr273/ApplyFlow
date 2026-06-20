import React from 'react';
import { createRoot } from 'react-dom/client';
import MiniPopup from './MiniPopup';
import '../globals.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <MiniPopup />
    </React.StrictMode>
  );
}
