import { describe, expect, it } from 'vitest';
import manifestFixture from '../__fixtures__/runtime-manifest.v1.json';
import planFixture from '../__fixtures__/release-plan.v1.json';
import {
    AssetResolverError,
    assertActivationAllowed,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
    validateReleaseCoverage,
    validateRuntimeManifestCoverage,
    compareQualifiedAssetIds,
    type AuthoringAssetCatalog,
    type AuthoringAssetReference,
} from '..';

const authoringAssets: AuthoringAssetReference[] = [
    {
        identity: { type: 'background', key: '第一章/鏡 房/夜' },
        sourcePath: 'fixture_story/backgrounds/chapter_1/mirror_room.png',
        section: 'chapter_1',
    },
    {
        identity: { type: 'portrait', key: '第一章/鏡 房/夜' },
        sourcePath: 'fixture_story/characters/mirror_room/base.png',
        section: 'chapter_1',
    },
    {
        identity: { type: 'portrait', key: '朝倉澪/缺少 表情' },
        sourcePath: 'fixture_story/characters/asakura_mio/missing.png',
        section: 'chapter_2',
    },
];
const authoringCatalog: AuthoringAssetCatalog = {
    storyId: 'fixture_story',
    assets: authoringAssets,
};

const availableSources = new Set([
    'fixture_story/backgrounds/chapter_1/mirror_room.png',
    'fixture_story/characters/mirror_room/base.png',
]);

describe('story asset release coverage', () => {
    it('reports included and explicitly omitted assets by type and section', () => {
        const plan = parseStoryAssetReleasePlan(planFixture);
        const report = validateReleaseCoverage(
            authoringCatalog,
            plan,
            availableSources
        );

        expect(report.totals).toEqual({
            total: 3,
            included: 2,
            omitted: 1,
            unclassified: 0,
        });
        expect(report.byType.portrait.omitted).toBe(1);
        expect(report.bySection.chapter_1.included).toBe(2);
        expect(report.bySection.chapter_2.omitted).toBe(1);
    });

    it('fails production publication for an unclassified key', () => {
        const plan = parseStoryAssetReleasePlan({
            ...planFixture,
            entries: planFixture.entries.slice(0, 2),
        });
        expect(() =>
            validateReleaseCoverage(authoringCatalog, plan, availableSources)
        ).toThrow(AssetResolverError);
    });

    it('allows incomplete preview classification but isolates activation', () => {
        const plan = parseStoryAssetReleasePlan({
            ...planFixture,
            channel: 'preview',
            entries: planFixture.entries.slice(0, 2),
        });
        const report = validateReleaseCoverage(
            authoringCatalog,
            plan,
            availableSources
        );
        expect(report.totals.unclassified).toBe(1);
        expect(() =>
            assertActivationAllowed(plan, { kind: 'production' })
        ).toThrow(/cannot update the production pointer/);
        expect(() =>
            assertActivationAllowed(plan, {
                kind: 'preview',
                previewId: 'hpa-227',
            })
        ).not.toThrow();
    });

    it('fails publication when an included source asset is missing', () => {
        const plan = parseStoryAssetReleasePlan(planFixture);
        expect(() =>
            validateReleaseCoverage(authoringCatalog, plan, new Set())
        ).toThrow(/coverage validation failed/i);
    });

    it('rejects a release plan for a different story', () => {
        const plan = parseStoryAssetReleasePlan(planFixture);
        expect(() =>
            validateReleaseCoverage(
                { ...authoringCatalog, storyId: 'another_story' },
                plan,
                availableSources
            )
        ).toThrow(/story ids differ/);
    });

    it('keeps omitted keys out of runtime data', () => {
        const plan = parseStoryAssetReleasePlan(planFixture);
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        expect(() =>
            validateRuntimeManifestCoverage(manifest, plan)
        ).not.toThrow();

        const invalidManifest = structuredClone(manifestFixture);
        invalidManifest.assets.push({
            ...structuredClone(invalidManifest.assets[1]),
            identity: {
                type: 'portrait',
                key: '朝倉澪/缺少 表情',
            },
        });
        invalidManifest.assets.sort((left, right) =>
            compareQualifiedAssetIds(
                `${left.identity.type}:${left.identity.key}`,
                `${right.identity.type}:${right.identity.key}`
            )
        );
        expect(() =>
            validateRuntimeManifestCoverage(
                parseRuntimeAssetManifest(invalidManifest),
                plan
            )
        ).toThrow(/does not match its release plan/);
    });
});
