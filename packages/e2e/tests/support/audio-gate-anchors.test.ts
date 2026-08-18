import { describe, expect, test } from 'bun:test';
import {
    parseRuntimeAudioManifest,
    type RuntimeAudioManifestV1,
} from '@aquila/stories/runtime-assets';
import type { StoryFlowConfig } from '@aquila/stories/stories';
import type { DialogueMap } from '@aquila/stories/types';
import { findAudioGateAnchors } from './audio-gate-anchors';

const dialogue: DialogueMap = {
    act1: [
        { dialogue: 'landing', bgm: 'dawn-apartment' },
        { dialogue: 'middle' },
        { dialogue: 'effect', sfx: 'door-open' },
    ],
};

const flow = {
    start: 'act1',
    nodes: [{ kind: 'scene', sceneId: 'act1' }],
} as unknown as StoryFlowConfig;

const manifest = parseRuntimeAudioManifest({
    schemaVersion: 1,
    storyId: 'demo_story',
    releaseId: `sha256-${'0'.repeat(64)}`,
    assets: [
        {
            identity: { type: 'bgm', key: 'dawn-apartment' },
            format: 'mp3',
            path: `vn/objects/${'b'.repeat(64)}.mp3`,
            sha256: 'b'.repeat(64),
            byteLength: 128_000,
            durationMs: 3_000,
            loop: true,
        },
        {
            identity: { type: 'sfx', key: 'door-open' },
            format: 'mp3',
            path: `vn/objects/${'a'.repeat(64)}.mp3`,
            sha256: 'a'.repeat(64),
            byteLength: 12_800,
            durationMs: 150,
            loop: false,
        },
    ],
});

function manifestWith(
    assets: RuntimeAudioManifestV1['assets']
): RuntimeAudioManifestV1 {
    return parseRuntimeAudioManifest({
        schemaVersion: 1,
        storyId: 'demo_story',
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    });
}

describe('findAudioGateAnchors', () => {
    test('selects authored BGM and forward SFX anchors in flow order', () => {
        expect(findAudioGateAnchors(dialogue, flow, manifest)).toEqual({
            bgm: {
                sceneId: 'act1',
                page: 1,
                key: 'dawn-apartment',
            },
            sfx: {
                sceneId: 'act1',
                fromPage: 2,
                toPage: 3,
                key: 'door-open',
            },
        });
    });

    test('fails when the manifest has no BGM', () => {
        const withoutBgm = manifestWith(
            manifest.assets.filter(asset => asset.identity.type !== 'bgm')
        );

        expect(() => findAudioGateAnchors(dialogue, flow, withoutBgm)).toThrow(
            /BGM anchor/i
        );
    });

    test('fails when the manifest has no SFX', () => {
        const withoutSfx = manifestWith(
            manifest.assets.filter(asset => asset.identity.type !== 'sfx')
        );

        expect(() => findAudioGateAnchors(dialogue, flow, withoutSfx)).toThrow(
            /SFX anchor/i
        );
    });

    test('fails when an authored cue key is absent from the manifest', () => {
        const withoutAuthoredKeys = manifestWith(
            manifest.assets.map(asset => ({
                ...asset,
                identity: {
                    ...asset.identity,
                    key: `${asset.identity.key}-other`,
                },
                path: asset.path,
            }))
        );

        expect(() =>
            findAudioGateAnchors(dialogue, flow, withoutAuthoredKeys)
        ).toThrow(/BGM anchor/i);
    });

    test('fails when SFX exists only on page 1 with no forward predecessor', () => {
        const firstPageSfxDialogue: DialogueMap = {
            act1: [{ dialogue: 'effect', sfx: 'door-open' }],
        };

        expect(() =>
            findAudioGateAnchors(firstPageSfxDialogue, flow, manifest)
        ).toThrow(/SFX anchor/i);
    });
});
