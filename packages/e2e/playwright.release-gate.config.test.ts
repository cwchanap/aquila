import { describe, expect, it } from 'bun:test';

const DEFAULT_CONFIG_ENV = {
    BASE_URL: 'https://preview.example.com',
    RELEASE_GATE_TARGET: 'preview',
    AQUILA_PRODUCTION_WEB_ORIGIN: 'https://aquila.example.com',
};

const defaultEnvKeys = Object.keys(DEFAULT_CONFIG_ENV);
const previousDefaultEnv = new Map(
    defaultEnvKeys.map(key => [key, process.env[key]])
);
Object.assign(process.env, DEFAULT_CONFIG_ENV);

const configModule = await import('./playwright.release-gate.config');

for (const key of defaultEnvKeys) {
    const previous = previousDefaultEnv.get(key);
    if (previous === undefined) {
        delete process.env[key];
    } else {
        process.env[key] = previous;
    }
}

const { createReleaseGatePlaywrightConfig } = configModule;

describe('release-gate Playwright configuration', () => {
    it('rejects localhost and omits webServer', () => {
        expect(() =>
            createReleaseGatePlaywrightConfig({
                ...DEFAULT_CONFIG_ENV,
                BASE_URL: 'http://localhost:5090',
            })
        ).toThrow();

        const config = createReleaseGatePlaywrightConfig(DEFAULT_CONFIG_ENV);

        expect(config.webServer).toBeUndefined();
        expect(config.projects?.map(project => project.name)).toEqual([
            'release-gate-chromium',
            'release-gate-mobile-chrome',
        ]);
    });

    it('requires a remote HTTPS URL and enforces the production-origin guard', () => {
        expect(() =>
            createReleaseGatePlaywrightConfig({
                ...DEFAULT_CONFIG_ENV,
                BASE_URL: 'http://preview.example.com',
            })
        ).toThrow(/HTTPS/);

        expect(() =>
            createReleaseGatePlaywrightConfig({
                ...DEFAULT_CONFIG_ENV,
                BASE_URL: 'https://aquila.example.com',
            })
        ).toThrow(/production origin/i);

        expect(() =>
            createReleaseGatePlaywrightConfig({
                ...DEFAULT_CONFIG_ENV,
                RELEASE_GATE_TARGET: 'production',
            })
        ).toThrow(/must equal the configured production origin/i);
    });

    it('limits collection to remote gate specs and wires the future structured reporter', () => {
        const config = createReleaseGatePlaywrightConfig(DEFAULT_CONFIG_ENV);

        expect(config.testMatch).toEqual([
            /visual-novel-release-gate\.spec\.ts$/,
            /visual-novel-production-smoke\.spec\.ts$/,
        ]);
        expect(config.reporter).toContainEqual([
            './reporters/release-gate-reporter.ts',
        ]);
    });
});
