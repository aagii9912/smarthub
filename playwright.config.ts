import { defineConfig, devices } from '@playwright/test';

const STORAGE = 'playwright/.auth/user.json';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    // Localhost dev shares one rate-limit bucket per IP (::1). Cap workers at 2
    // so the standard 60 req/min limit is not blown by parallel browser sessions.
    workers: process.env.CI ? 1 : 2,
    reporter: 'html',
    webServer: {
        command: 'npm run dev',
        port: 4001,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
    use: {
        baseURL: 'http://localhost:4001',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts$/,
        },
        {
            name: 'chromium-public',
            // Tests that don't require auth (landing, public pages, API)
            testMatch: /(smoke|landing|auth|cron-auth|webhook-router)\.spec\.ts$/,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'chromium',
            // Authenticated tests: dashboard, admin, etc.
            testIgnore: /(smoke|landing|auth|cron-auth|webhook-router)\.spec\.ts$/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: STORAGE,
            },
            dependencies: ['setup'],
        },
    ],
});
