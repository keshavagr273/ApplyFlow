import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import manifest from './public/manifest.json';

// Custom plugin to remove 'platform' from input options to avoid Rolldown errors in dev mode
const removePlatformPlugin = {
  name: 'remove-platform-option',
  options(options: any) {
    if (options && 'platform' in options) {
      delete options.platform;
    }
    return options;
  }
};

export default defineConfig({
  plugins: [
    react(), 
    crx({ manifest: manifest as any }),
    removePlatformPlugin,
    visualizer({ open: false, filename: 'dist/stats.html', gzipSize: true })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'popup.html',
        'side-panel': 'side-panel.html',
        options: 'options.html',
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    hmr: {
      port: 5173,
    },
    cors: true,
    origin: 'http://127.0.0.1:5173'
  }
});
