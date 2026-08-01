import { TextDecoder, TextEncoder } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
    canonicalReleaseContent,
    getObjectPath,
    qualifyAssetIdentity,
    type PublicationTarget,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanEntryV1,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { buildPreparedRelease } from '../runtime-release';
import { PublisherError } from '../errors';
import { sha256Bytes } from '../hash';
import type { EncodedAsset, EncodedVariant } from '../types';

function encodedVariant(format: EncodedVariant['format']): EncodedVariant {
    const bytes = new TextEncoder().encode(`encoded-${format}`);
    const sha256 = sha256Bytes(bytes);
    return {
        format,
        bytes,
        sha256,
        path: getObjectPath(sha256, format),
        byteLength: bytes.byteLength,
        contentType: format === 'webp' ? 'image/webp' : 'image/avif',
    };
}

function coverage(storyId: string): StoryAssetCoverageReport {
    return {
        storyId,
        byType: {
            background: { total: 1, included: 1, omitted: 0, unclassified: 0 },
            portrait: { total: 1, included: 1, omitted: 0, unclassified: 0 },
        },
        bySection: {
            chapter_1: { total: 2, included: 2, omitted: 0, unclassified: 0 },
        },
        totals: { total: 2, included: 2, omitted: 0, unclassified: 0 },
    };
}

function includedPlanEntry(
    asset: EncodedAsset
): Extract<StoryAssetReleasePlanEntryV1, { disposition: 'included' }> {
    return {
        identity: asset.identity,
        disposition: 'included',
        sourcePath: asset.sourcePath,
        ...(asset.planSection === undefined
            ? {}
            : { section: asset.planSection }),
    };
}

function fixtureInput(options?: {
    storyId?: string;
    planSection?: string;
    authoringSection?: string;
    assets?: EncodedAsset[];
}): {
    storyId: string;
    target: PublicationTarget;
    releasePlan: StoryAssetReleasePlanV1;
    encodedAssets: EncodedAsset[];
    coverage: StoryAssetCoverageReport;
} {
    const storyId = options?.storyId ?? 'example_story';
    const background: EncodedAsset = {
        identity: { type: 'background', key: 'chapter_1/bg' },
        sourcePath: 'example/backgrounds/chapter_1/bg.png',
        ...(options?.authoringSection === undefined
            ? {}
            : { authoringSection: options.authoringSection }),
        ...(options?.planSection === undefined
            ? {}
            : { planSection: options.planSection }),
        variants: [encodedVariant('webp'), encodedVariant('avif')],
        width: 1672,
        height: 941,
        sourceHasAlpha: false,
        outputHasAlpha: false,
    };
    const portrait: EncodedAsset = {
        identity: { type: 'portrait', key: 'mio/base' },
        sourcePath: 'example/characters/mio/base.png',
        variants: [encodedVariant('webp')],
        width: 1086,
        height: 1448,
        sourceHasAlpha: true,
        outputHasAlpha: true,
    };
    const assets = options?.assets ?? [portrait, background];
    const releasePlan: StoryAssetReleasePlanV1 = {
        schemaVersion: 1,
        storyId,
        channel: 'production',
        entries: assets.map(includedPlanEntry),
    };
    return {
        storyId,
        target: { kind: 'production' },
        releasePlan,
        encodedAssets: assets,
        coverage: coverage(storyId),
    };
}

describe('buildPreparedRelease', () => {
    it('uses plan section over authoring section and includes it in identity', () => {
        const first = buildPreparedRelease(
            fixtureInput({
                planSection: 'chapter_1',
                authoringSection: 'character_mio',
            })
        );
        const second = buildPreparedRelease(
            fixtureInput({
                planSection: 'chapter_2',
                authoringSection: 'character_mio',
            })
        );

        expect(first.manifest.assets[0]?.section).toBe('chapter_1');
        expect(first.releaseId).not.toBe(second.releaseId);
    });

    it('sorts by qualified identity and emits one final LF', () => {
        const result = buildPreparedRelease(fixtureInput());
        const identities = result.manifest.assets.map(asset =>
            qualifyAssetIdentity(asset.identity)
        );
        const manifestText = new TextDecoder().decode(result.manifestBytes);

        expect(identities).toEqual([...identities].sort());
        expect(manifestText.endsWith('\n')).toBe(true);
        expect(manifestText.endsWith('\n\n')).toBe(false);
        expect(canonicalReleaseContent(result.manifest)).not.toContain(
            result.releaseId
        );
    });

    it('validates the placeholder draft before canonicalization', () => {
        expect(() =>
            buildPreparedRelease(fixtureInput({ storyId: 'INVALID STORY' }))
        ).toThrow(/runtime asset manifest/i);
    });

    it('requires WebP for every asset', () => {
        const input = fixtureInput();
        const background = input.encodedAssets.find(
            asset => asset.identity.type === 'background'
        );
        if (background === undefined)
            throw new Error('Fixture lacks background');
        background.variants = [encodedVariant('avif')];

        expect(() => buildPreparedRelease(input)).toThrow(PublisherError);
        expect(() => buildPreparedRelease(input)).toThrow(/webp/i);
    });

    it('requires AVIF for backgrounds and rejects it for portraits', () => {
        const withoutBackgroundAvif = fixtureInput();
        const background = withoutBackgroundAvif.encodedAssets.find(
            asset => asset.identity.type === 'background'
        );
        if (background === undefined)
            throw new Error('Fixture lacks background');
        background.variants = [encodedVariant('webp')];

        expect(() => buildPreparedRelease(withoutBackgroundAvif)).toThrow(
            /background.*avif/i
        );

        const withPortraitAvif = fixtureInput();
        const portrait = withPortraitAvif.encodedAssets.find(
            asset => asset.identity.type === 'portrait'
        );
        if (portrait === undefined) throw new Error('Fixture lacks portrait');
        portrait.variants = [encodedVariant('webp'), encodedVariant('avif')];

        expect(() => buildPreparedRelease(withPortraitAvif)).toThrow(
            /portrait.*avif/i
        );
    });

    it('requires at least one background for empty and portrait-only releases', () => {
        const empty = fixtureInput({ assets: [] });
        const portraitOnly = fixtureInput();
        portraitOnly.encodedAssets = portraitOnly.encodedAssets.filter(
            asset => asset.identity.type === 'portrait'
        );
        portraitOnly.releasePlan.entries =
            portraitOnly.releasePlan.entries.filter(
                entry => entry.identity.type === 'portrait'
            );

        for (const input of [empty, portraitOnly]) {
            expect(() => buildPreparedRelease(input)).toThrow(PublisherError);
            expect(() => buildPreparedRelease(input)).toThrow(/background/i);
        }
    });
});
