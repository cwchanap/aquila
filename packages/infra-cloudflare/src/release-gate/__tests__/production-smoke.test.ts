import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
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
        webBaseUrl: 'https://aquila.example',
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
        webBaseUrl: 'https://aquila.example',
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

    it.each([
        [
            'a different story',
            { storyId: 'another_story' },
            'post-activation-smoke/story-mismatch',
        ],
        [
            'a different active release',
            { releaseId: `sha256-${'d'.repeat(64)}` },
            'post-activation-smoke/release-mismatch',
        ],
        [
            'a different manifest checksum',
            { manifestSha256: 'e'.repeat(64) },
            'post-activation-smoke/manifest-mismatch',
        ],
    ])(
        'fails %s before passing the public active-release check',
        async (_label, resultPatch, code) => {
            const report = await runProductionSmoke(fixtureInput(), {
                verifyPublicRelease: async () => activeResult(resultPatch),
            });

            expect(report.status).toBe('failed');
            expect(report.checks).toEqual([
                { id: 'public-active-release', status: 'failed' },
                { id: 'browser-production-flow', status: 'failed' },
                { id: 'pointer-revalidation', status: 'failed' },
            ]);
            expect(report.diagnostics).toContainEqual(
                expect.objectContaining({
                    stage: 'post-activation-smoke',
                    code,
                })
            );
        }
    );

    it.each([
        [
            'a percent-encoded preview segment',
            'https://assets.aquila.example/vn/%70reviews/hpa-233',
        ],
        [
            'a percent-encoded path separator before previews',
            'https://assets.aquila.example/vn%2Fpreviews/hpa-233',
        ],
        [
            'a nested percent-encoded preview segment',
            'https://assets.aquila.example/vn/%2570reviews/hpa-233',
        ],
    ])(
        'rejects %s before public verification',
        async (_label, assetBaseUrl) => {
            const verifyPublicRelease = vi.fn(async () => activeResult());

            await expect(
                runProductionSmoke(fixtureInput({ assetBaseUrl }), {
                    verifyPublicRelease,
                })
            ).rejects.toMatchObject({
                code: 'activation-target/preview-assets',
            });
            expect(verifyPublicRelease).not.toHaveBeenCalled();
        }
    );

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

    it('rejects a production web URL below the configured origin', async () => {
        await expect(
            runProductionSmoke(
                fixtureInput({ webBaseUrl: 'https://aquila.example/reader' }),
                { verifyPublicRelease: async () => activeResult() }
            )
        ).rejects.toMatchObject({
            code: 'activation-target/production-origin',
        });
    });

    it('rejects browser evidence captured from another production deployment', async () => {
        const evidence = browserEvidence();
        evidence.webBaseUrl = 'https://other-production.example';
        for (const project of evidence.projects) {
            project.webBaseUrl = evidence.webBaseUrl;
        }

        await expect(
            runProductionSmoke(fixtureInput({ browserEvidence: evidence }), {
                verifyPublicRelease: async () => activeResult(),
            })
        ).rejects.toMatchObject({
            code: 'activation-target/browser-identity',
        });
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
