import type { FullConfig } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
    console.log('🚀 Starting global setup for Playwright tests...');

    if (!process.env.CI) {
        const localSupabaseUrl = 'http://127.0.0.1:54321';
        const localDatabaseUrl =
            'postgresql://root@localhost:26257/defaultdb?sslmode=disable';

        // Hardcode local infra for local E2E runs.
        process.env.PUBLIC_SUPABASE_URL = localSupabaseUrl;
        process.env.SUPABASE_URL = localSupabaseUrl;
        process.env.DATABASE_URL = localDatabaseUrl;

        const anonKey =
            process.env.PUBLIC_SUPABASE_ANON_KEY ??
            process.env.SUPABASE_ANON_KEY;

        if (!anonKey) {
            throw new Error(
                'Missing PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY). Local E2E requires a local Supabase anon key.'
            );
        }

        if (anonKey.startsWith('sb_')) {
            throw new Error(
                'Refusing to run local E2E with a remote-style Supabase anon key. Export your local Supabase env (e.g. from `supabase status -o env`) and retry.'
            );
        }
    }

    // You can add global setup logic here, such as:
    // - Database setup/cleanup
    // - Authentication setup
    // - Environment variable validation
    // - Test data preparation

    console.log('✅ Global setup completed');
}

export default globalSetup;
