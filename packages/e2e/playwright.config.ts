import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    globalSetup: './tests/global-setup.ts',
    webServer: {
        command: 'cd ../../apps/web && bun run dev',
        url: 'http://localhost:5090',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: process.env.BASE_URL ?? 'http://localhost:5090',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
