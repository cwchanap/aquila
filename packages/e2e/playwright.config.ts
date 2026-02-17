import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    globalSetup: './tests/global-setup.ts',
    webServer: {
        command: 'cd ../../apps/web && bun run dev',
        url: 'http://localhost:5090',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            DATABASE_URL:
                process.env.DATABASE_URL ??
                'postgresql://postgres:postgres@localhost:5432/aquila_e2e',
            NODE_ENV: process.env.NODE_ENV ?? 'test',
            CI: process.env.CI ?? 'false',
        },
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
