import { describe, expect, it } from 'vitest';
import {
    getAudioObjectPath,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { sha256Bytes } from '../hash';
import { buildPreparedAudioRelease } from '../audio-runtime-release';
import type { NormalizedAudioAsset } from '../audio-encoder';
import type { AudioCoverageEntryV1 } from '../audio-source';

const target: PublicationTarget = { kind: 'production' };
const storyId = 'example_story';

type AudioReleaseInput = Parameters<typeof buildPreparedAudioRelease>[0];
type HasNormalizedAssetsAlias =
    'normalizedAssets' extends keyof AudioReleaseInput ? true : false;
const hasNormalizedAssetsAlias: HasNormalizedAssetsAlias = false;
void hasNormalizedAssetsAlias;

function asset(
    type: NormalizedAudioAsset['type'],
    key: string,
    bytes: number[],
    durationMs: number,
    loop: boolean
): NormalizedAudioAsset {
    const normalizedBytes = Uint8Array.from(bytes);
    const sha256 = sha256Bytes(normalizedBytes);
    return {
        type,
        key,
        bytes: normalizedBytes,
        sha256,
        path: getAudioObjectPath(sha256),
        byteLength: normalizedBytes.byteLength,
        durationMs,
        loop,
        contentType: 'audio/mpeg',
    };
}

const sfx = asset('sfx', 'door-open', [1, 2, 3], 2_200, false);
const bgm = asset('bgm', 'dawn-apartment', [4, 5, 6], 12_000, true);
const coverage: AudioCoverageEntryV1[] = [
    {
        type: 'sfx',
        key: 'door-open',
        usageCount: 2,
        disposition: 'included',
    },
    {
        type: 'bgm',
        key: 'dawn-apartment',
        usageCount: 1,
        disposition: 'included',
    },
];

describe('buildPreparedAudioRelease', () => {
    it('sorts normalized assets and makes release bytes/id independent of input order', () => {
        const first = buildPreparedAudioRelease({
            storyId,
            target,
            assets: [sfx, bgm],
            coverage,
        });
        const second = buildPreparedAudioRelease({
            storyId,
            target,
            assets: [bgm, sfx],
            coverage: [...coverage].reverse(),
        });

        expect(second.manifestBytes).toEqual(first.manifestBytes);
        expect(second.releaseId).toBe(first.releaseId);
        expect(second.manifestSha256).toBe(first.manifestSha256);
        expect(
            first.manifest.assets.map(
                entry => `${entry.identity.type}:${entry.identity.key}`
            )
        ).toEqual(['bgm:dawn-apartment', 'sfx:door-open']);
    });

    it('keeps runtime release identity independent of publication target', () => {
        const production = buildPreparedAudioRelease({
            storyId,
            target: { kind: 'production' },
            assets: [sfx, bgm],
            coverage,
        });
        const preview = buildPreparedAudioRelease({
            storyId,
            target: { kind: 'preview', previewId: 'hpa-611-test' },
            assets: [sfx, bgm],
            coverage,
        });

        expect(preview.releaseId).toBe(production.releaseId);
        expect(preview.manifestSha256).toBe(production.manifestSha256);
        expect(preview.manifestBytes).toEqual(production.manifestBytes);
        expect(preview.target).not.toEqual(production.target);
    });

    it.each([
        ['runtime bytes', asset('sfx', 'door-open', [1, 2, 4], 2_200, false)],
        ['duration', asset('sfx', 'door-open', [1, 2, 3], 2_201, false)],
        [
            'loop-dependent identity',
            asset('sfx', 'dawn-apartment', [4, 5, 6], 12_000, false),
        ],
    ])('changes release identity when %s changes', (_label, changed) => {
        const original = buildPreparedAudioRelease({
            storyId,
            target,
            assets: [sfx, bgm],
            coverage,
        });
        const changedRelease = buildPreparedAudioRelease({
            storyId,
            target,
            assets:
                changed.key === 'door-open' ? [changed, bgm] : [sfx, changed],
            coverage,
        });

        expect(changedRelease.releaseId).not.toBe(original.releaseId);
        expect(changedRelease.manifestBytes).not.toEqual(
            original.manifestBytes
        );
    });
});
