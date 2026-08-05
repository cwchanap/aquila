import { describe, expect, it } from 'bun:test';
import config from './playwright.config';

type ProjectConfig = NonNullable<typeof config.projects>[number];

function isIgnored(project: ProjectConfig, path: string): boolean {
    const configured = project.testIgnore ?? config.testIgnore;
    const matchers = Array.isArray(configured) ? configured : [configured];

    return matchers.some(
        matcher => matcher instanceof RegExp && matcher.test(path)
    );
}

describe('default Playwright configuration', () => {
    it('keeps Bun support tests and remote release-gate specs out of every project', () => {
        const projects = config.projects ?? [];
        const isolatedPaths = [
            '/repo/packages/e2e/tests/support/release-gate-env.test.ts',
            '/repo/packages/e2e/tests/support/release-gate-evidence.test.ts',
            '/repo/packages/e2e/tests/visual-novel-release-gate.spec.ts',
            '/repo/packages/e2e/tests/visual-novel-production-smoke.spec.ts',
        ];

        expect(projects.length).toBeGreaterThan(0);
        for (const project of projects) {
            for (const path of isolatedPaths) {
                expect(isIgnored(project, path)).toBe(true);
            }
            expect(
                isIgnored(
                    project,
                    '/repo/packages/e2e/tests/reader-visual.spec.ts'
                )
            ).toBe(false);
        }
    });
});
