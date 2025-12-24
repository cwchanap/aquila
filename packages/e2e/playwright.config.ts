import { defineConfig, devices } from '@playwright/test';

const localAnonKey =
    process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!process.env.CI) {
    if (!localAnonKey) {
        throw new Error(
            'Local E2E requires PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY). Start local Supabase and export env (e.g. `supabase start` then `eval "$(supabase status -o env)"`).'
        );
    }

    if (localAnonKey.startsWith('sb_')) {
        throw new Error(
            'Refusing to run local E2E with a remote-style Supabase anon key (sb_*). Export your local Supabase env (e.g. from `supabase status -o env`) and retry.'
        );
    }
}

export default defineConfig({
    testDir: './tests',
    globalSetup: './tests/global-setup.ts',
    webServer: {
        command: 'cd ../../apps/web && bun run dev',
        url: 'http://localhost:5090',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
            // Force the web app to use local infrastructure during local E2E.
            // (CI already injects these via GitHub Actions.)
            PUBLIC_SUPABASE_URL: process.env.CI
                ? (process.env.PUBLIC_SUPABASE_URL ??
                  process.env.SUPABASE_URL ??
                  'http://127.0.0.1:54321')
                : 'http://127.0.0.1:54321',
            PUBLIC_SUPABASE_ANON_KEY: process.env.CI
                ? (process.env.PUBLIC_SUPABASE_ANON_KEY ??
                  process.env.SUPABASE_ANON_KEY ??
                  '')
                : (localAnonKey ?? ''),
            SUPABASE_URL: process.env.CI
                ? (process.env.SUPABASE_URL ??
                  process.env.PUBLIC_SUPABASE_URL ??
                  'http://127.0.0.1:54321')
                : 'http://127.0.0.1:54321',
            SUPABASE_ANON_KEY: process.env.CI
                ? (process.env.SUPABASE_ANON_KEY ??
                  process.env.PUBLIC_SUPABASE_ANON_KEY ??
                  '')
                : (localAnonKey ?? ''),
            DATABASE_URL: process.env.CI
                ? (process.env.DATABASE_URL ??
                  'postgresql://root@localhost:26257/defaultdb?sslmode=disable')
                : 'postgresql://root@localhost:26257/defaultdb?sslmode=disable',
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
