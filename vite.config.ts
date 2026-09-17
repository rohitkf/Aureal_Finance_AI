import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': the app must not swap itself out from
      // under someone mid-entry. The new worker waits, UpdateGate blocks the
      // screen, and the reload happens when the person says so.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/icon.svg', 'icons/maskable.svg'],
      manifest: {
        name: 'Aureal Finance AI',
        short_name: 'Aureal',
        description:
          'A premium personal financial operating system — balances, budgets, forecasts and safe-to-spend in one place.',
        theme_color: '#051424',
        background_color: '#051424',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'productivity'],
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Add expense', url: '/transactions?new=expense' },
          { name: 'Forecast', url: '/forecast' },
          { name: 'Budget', url: '/budget' },
        ],
      },
      workbox: {
        // Fonts are self-hosted from public/fonts, so they are picked up by
        // globPatterns above and need no runtime caching rule. There were
        // rules here for fonts.googleapis.com and fonts.gstatic.com, kept
        // after the app stopped loading anything from either.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
