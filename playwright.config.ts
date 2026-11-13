import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build (vite preview) so the service worker is real.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    trace: 'off',
  },
  projects: [{ name: 'mobile-chrome', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
