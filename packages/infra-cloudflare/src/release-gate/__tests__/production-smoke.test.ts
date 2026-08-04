import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    runProductionSmoke,
    type ProductionSmokeInputV1,
} from '../production-smoke';

const STORY_ID = 'the_seventh_mirror';
const RELEASE_ID = `sha256-${'a'.repeat(64)}`;
const MANIFEST_SHA256 = 'b'.repeat(64);

function browserEvidence() {
    const project = (
        name: 'release-gate-chromium' | 'release-gate-mobile-chrome'
    ) => ({
        schemaVersion: 1 as const,
        flow: 'production-smoke' as const,
        project: name,
        status: 'passed' as const,
        storyId: STORY_ID,
        target: { kind: 'production' as const },
        assetEnvironment: 'production' as const,
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        scenarioSha256: 'c'.repeat(64),
        requestPaths: {
            pointerRequestUrl:
                'https://assets.aquila.example/vn/stories/the_seventh_mirror/current.json',
            manifestRequestUrl: `https://assets.aquila.example/vn/stories/the_seventh_mirror/releases/${RELEASE_ID}/runtime-manifest.json`,
        },
        scenarioCases: [
            { id: 'direct-open', status: 'passed' as const },
            { id: 'identity-and-decode', status: 'passed' as const },
            { id: 'progression', status: 'passed' as const },
            { id: 'read-only', status: 'passed' as const },
        ],
        screenshots: [],
    });
    return {
        schemaVersion: 1,
        flow: 'production-smoke' as const,
        status: 'passed' as const,
        storyId: STORY_ID,
        target: { kind: 'production' as const },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        scenarioSha256: 'c'.repeat(64),
        projects: [
            project('release-gate-chromium'),
            project('release-gate-mobile-chrome'),
        ],
    };
}

function fixtureInput(
    overrides: Partial<ProductionSmokeInputV1> = {}
): ProductionSmokeInputV1 {
    return {
        storyId: STORY_ID,
        releaseId: RELEASE_ID,
        expectedManifestSha256: MANIFEST_SHA256,
        assetBaseUrl: 'https://assets.aquila.example',
        webBaseUrl: 'https://aquila.example',
        productionWebOrigin: 'https://aquila.example',
        browserEvidence: browserEvidence(),
        ...overrides,
    };
}

function activeResult(overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1 as const,
        status: 'passed' as const,
        mode: 'active' as const,
        storyId: STORY_ID,
        target: { kind: 'production' as const },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        checks: [{ id: 'pointer.cache', status: 'passed' as const }],
        diagnostics: [],
        ...overrides,
    };
}

describe('production smoke', () => {
    it('accepts an exact active production release and complete production browser evidence', async () => {
        const report = await runProductionSmoke(fixtureInput(), {
            verifyPublicRelease: async () => activeResult(),
        });

        expect(report.status).toBe('passed');
        expect(report.diagnostics).toEqual([]);
        expect(report.checks).toEqual([
            { id: 'public-active-release', status: 'passed' },
            { id: 'browser-production-flow', status: 'passed' },
            { id: 'pointer-revalidation', status: 'passed' },
        ]);
    });

    it('fails a different active release at post-activation-smoke', async () => {
        const report = await runProductionSmoke(fixtureInput(), {
            verifyPublicRelease: async () =>
                activeResult({ releaseId: `sha256-${'d'.repeat(64)}` }),
        });

        expect(report.status).toBe('failed');
        expect(report.diagnostics).toContainEqual(
            expect.objectContaining({
                stage: 'post-activation-smoke',
                code: 'post-activation-smoke/release-mismatch',
            })
        );
    });

    it('rejects preview and local identities before public verification', async () => {
        await expect(
            runProductionSmoke(
                fixtureInput({ webBaseUrl: 'https://preview.aquila.example' }),
                { verifyPublicRelease: async () => activeResult() }
            )
        ).rejects.toThrow(/production origin/i);

        await expect(
            runProductionSmoke(
                fixtureInput({
                    assetBaseUrl: 'https://localhost/assets',
                }),
                { verifyPublicRelease: async () => activeResult() }
            )
        ).rejects.toThrow(/local/i);
    });

    it('has no publisher activation, R2 store, or mutation dependency', () => {
        const source = readFileSync(
            new URL('../production-smoke.ts', import.meta.url),
            'utf8'
        );

        expect(source).not.toMatch(/from ['"][^'"]*publisher\/activation['"]/);
        expect(source).not.toMatch(/from ['"][^'"]*r2-delivery-store['"]/);
        expect(source).not.toMatch(/compareAndSwapPointer|createImmutable/);
    });
});
