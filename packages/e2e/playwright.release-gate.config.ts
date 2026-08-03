import { defineConfig, devices } from '@playwright/test';

export type ReleaseGateEnvironment = Record<string, string | undefined>;

const REMOTE_TEST_MATCH = [
    /visual-novel-release-gate\.spec\.ts$/,
    /visual-novel-production-smoke\.spec\.ts$/,
];
const RELEASE_GATE_REPORTER = './reporters/release-gate-reporter.ts';

function requiredEnvironmentValue(
    env: ReleaseGateEnvironment,
    name: string
): string {
    const value = env[name]?.trim();
    if (value === undefined || value === '') {
        throw new Error(`${name} must be set for remote release-gate tests`);
    }
    return value;
}

function parseRemoteUrl(value: string, name: string): URL {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be an absolute HTTPS URL`);
    }
    if (url.protocol !== 'https:') {
        throw new Error(`${name} must be an absolute HTTPS URL`);
    }
    if (url.username !== '' || url.password !== '') {
        throw new Error(`${name} must not include URL credentials`);
    }
    if (url.search !== '' || url.hash !== '') {
        throw new Error(`${name} must not include query or fragment data`);
    }
    if (isLocalHostname(url.hostname)) {
        throw new Error(`${name} must not use localhost or a loopback address`);
    }
    return url;
}

function parseProductionOrigin(value: string): URL {
    const url = parseRemoteUrl(value, 'AQUILA_PRODUCTION_WEB_ORIGIN');
    if (url.pathname !== '/') {
        throw new Error('AQUILA_PRODUCTION_WEB_ORIGIN must be an origin');
    }
    return url;
}

function isLocalHostname(hostname: string): boolean {
    const value = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return (
        value === 'localhost' ||
        value.endsWith('.localhost') ||
        value === '0.0.0.0' ||
        value === '::1' ||
        /^127(?:\.\d{1,3}){3}$/.test(value)
    );
}

export function createReleaseGatePlaywrightConfig(env: ReleaseGateEnvironment) {
    const baseUrl = parseRemoteUrl(
        requiredEnvironmentValue(env, 'BASE_URL'),
        'BASE_URL'
    );
    const target = requiredEnvironmentValue(env, 'RELEASE_GATE_TARGET');
    if (target !== 'preview' && target !== 'production') {
        throw new Error('RELEASE_GATE_TARGET must be preview or production');
    }

    const productionOrigin = parseProductionOrigin(
        requiredEnvironmentValue(env, 'AQUILA_PRODUCTION_WEB_ORIGIN')
    );
    if (target === 'preview' && baseUrl.origin === productionOrigin.origin) {
        throw new Error(
            'Preview release-gate tests must not use the configured production origin'
        );
    }
    if (target === 'production' && baseUrl.origin !== productionOrigin.origin) {
        throw new Error(
            'Production release-gate tests must equal the configured production origin'
        );
    }

    return defineConfig({
        testDir: './tests',
        testMatch: REMOTE_TEST_MATCH,
        fullyParallel: true,
        forbidOnly: !!env.CI,
        retries: env.CI ? 2 : 0,
        workers: env.CI ? 1 : undefined,
        reporter: [
            ['html', { open: 'never' }],
            ['list'],
            [RELEASE_GATE_REPORTER],
        ],
        use: {
            baseURL: baseUrl.toString(),
            trace: 'on-first-retry',
            screenshot: 'only-on-failure',
        },
        projects: [
            {
                name: 'release-gate-chromium',
                use: { ...devices['Desktop Chrome'] },
            },
            {
                name: 'release-gate-mobile-chrome',
                use: { ...devices['Pixel 5'] },
            },
        ],
    });
}

export default createReleaseGatePlaywrightConfig(process.env);
