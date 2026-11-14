/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'dev';
  }
}

// BASE_PATH lets the app be hosted under a sub-path (e.g. GitHub Pages: /boxtrack/).
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
    __BUILD_ID__: JSON.stringify(buildId()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'BoxTrack – Moving Box Inventory',
        short_name: 'BoxTrack',
        description: 'Know what is in every moving box. Works offline.',
        theme_color: '#161618',
        background_color: '#161618',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,ico,webmanifest}', 'ocr/eng.traineddata'],
        // The non-SIMD OCR engine is only for old devices: cache it on first use instead of up front.
        globIgnores: ['ocr/tesseract-core-lstm.wasm.js'],
        // OCR engine (~4 MB) and English language data (~4 MB) are precached so OCR works offline.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/ocr/tesseract-core-lstm.wasm.js'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-fallback' },
          },
        ],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
