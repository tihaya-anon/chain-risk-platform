import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173'
const BFF_URL = process.env.BFF_URL || 'http://localhost:3001'

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30000,

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        cwd: '../../../frontend',
        reuseExistingServer: true,
        timeout: 120000,
      },
})

export { BASE_URL, BFF_URL }
