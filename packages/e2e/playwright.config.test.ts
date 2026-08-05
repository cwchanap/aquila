import { describe, expect, it } from 'bun:test';
import config from './playwright.config';

function isIgnored(path: string): boolean {
    const configured = config.testIgnore;
    const matchers = Array.isArray(configured) ? configured : [configured];

    return matchers.some(
        matcher => matcher instanceof RegExp && matcher.test(path)
    );
}

describe('default Playwright configuration', () => {
    it('keeps Bun support tests and remote release-gate specs out of the local suite', () => {
        expect(
            isIgnored(
                '/repo/packages/e2e/tests/support/release-gate-env.test.ts'
            )
        ).toBe(true);
        expect(
            isIgnored(
                '/repo/packages/e2e/tests/support/release-gate-evidence.test.ts'
            )
        ).toBe(true);
        expect(
            isIgnored(
                '/repo/packages/e2e/tests/visual-novel-release-gate.spec.ts'
            )
        ).toBe(true);
        expect(
            isIgnored(
                '/repo/packages/e2e/tests/visual-novel-production-smoke.spec.ts'
            )
        ).toBe(true);
        expect(
            isIgnored('/repo/packages/e2e/tests/reader-visual.spec.ts')
        ).toBe(false);
    });
});
