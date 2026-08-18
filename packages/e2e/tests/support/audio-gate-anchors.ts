import type { RuntimeAudioManifestV1 } from '@aquila/stories/runtime-assets';
import type { StoryFlowConfig } from '@aquila/stories/stories';
import type { DialogueMap } from '@aquila/stories/types';

export type AudioGateAnchors = {
    bgm: {
        sceneId: string;
        page: number;
        key: string;
    };
    sfx: {
        sceneId: string;
        fromPage: number;
        toPage: number;
        key: string;
    };
};

export function findAudioGateAnchors(
    dialogue: DialogueMap,
    flow: StoryFlowConfig,
    manifest: RuntimeAudioManifestV1
): AudioGateAnchors {
    const bgmKeys = new Set(
        manifest.assets
            .filter(asset => asset.identity.type === 'bgm')
            .map(asset => asset.identity.key)
    );
    const sfxKeys = new Set(
        manifest.assets
            .filter(asset => asset.identity.type === 'sfx')
            .map(asset => asset.identity.key)
    );

    let bgm: AudioGateAnchors['bgm'] | undefined;
    let sfx: AudioGateAnchors['sfx'] | undefined;

    for (const node of flow.nodes) {
        if (node.kind !== 'scene') continue;
        const lines = dialogue[node.sceneId];
        if (!lines) continue;

        for (const [index, entry] of lines.entries()) {
            if (
                bgm === undefined &&
                typeof entry.bgm === 'string' &&
                bgmKeys.has(entry.bgm)
            ) {
                bgm = {
                    sceneId: node.sceneId,
                    page: index + 1,
                    key: entry.bgm,
                };
            }

            if (
                sfx === undefined &&
                index > 0 &&
                typeof entry.sfx === 'string' &&
                sfxKeys.has(entry.sfx)
            ) {
                sfx = {
                    sceneId: node.sceneId,
                    fromPage: index,
                    toPage: index + 1,
                    key: entry.sfx,
                };
            }

            if (bgm !== undefined && sfx !== undefined) {
                return { bgm, sfx };
            }
        }
    }

    const missing: string[] = [];
    if (bgm === undefined) {
        missing.push(
            'BGM anchor requires an authored bgm key included in the audio manifest'
        );
    }
    if (sfx === undefined) {
        missing.push(
            'SFX anchor requires an authored manifest cue on a page after the first'
        );
    }
    throw new Error(
        `Audio release gate prerequisites are not met: ${missing.join('; ')}`
    );
}
