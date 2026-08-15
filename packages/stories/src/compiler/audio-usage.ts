import type { AudioAssetType, AudioPlanV1 } from '../audio-plan';
import { compareQualifiedAssetIds } from '../runtime-assets/paths';
import type { StoryIR } from './ir';

export interface AudioUsageLocation {
    sceneId: string;
    sourcePath: string;
    entryIndex: number;
}

export interface AudioCueUsage extends AudioUsageLocation {
    type: AudioAssetType;
    key: string;
}

export interface CollectedAudioUsage {
    cues: AudioCueUsage[];
    bgmStops: AudioUsageLocation[];
}

export interface AudioUsageReportAsset {
    type: AudioAssetType;
    key: string;
    usageCount: number;
    usages: AudioUsageLocation[];
}

export interface AudioUsageReport {
    story: string;
    assets: AudioUsageReportAsset[];
    bgmStops: AudioUsageLocation[];
    unused: Array<{ type: AudioAssetType; key: string }>;
}

function qualified(type: AudioAssetType, key: string): string {
    return `${type}:${key.normalize('NFC')}`;
}

export function collectAudioUsage(story: StoryIR): CollectedAudioUsage {
    const cues: AudioCueUsage[] = [];
    const bgmStops: AudioUsageLocation[] = [];

    for (const scene of story.scenes) {
        scene.entries.forEach((entry, entryIndex) => {
            const location = {
                sceneId: scene.id,
                sourcePath: scene.sourcePath,
                entryIndex,
            };
            if (entry.sfx !== undefined) {
                cues.push({ ...location, type: 'sfx', key: entry.sfx });
            }
            if (entry.bgm === null) {
                bgmStops.push(location);
            } else if (entry.bgm !== undefined) {
                cues.push({ ...location, type: 'bgm', key: entry.bgm });
            }
        });
    }
    return { cues, bgmStops };
}

export function buildAudioUsageReport(
    storyName: string,
    usage: CollectedAudioUsage,
    plan: AudioPlanV1 | undefined
): AudioUsageReport {
    const byQualifiedId = new Map<string, AudioUsageReportAsset>();
    for (const cue of usage.cues) {
        const id = qualified(cue.type, cue.key);
        let asset = byQualifiedId.get(id);
        if (!asset) {
            asset = { type: cue.type, key: cue.key, usageCount: 0, usages: [] };
            byQualifiedId.set(id, asset);
        }
        asset.usageCount += 1;
        asset.usages.push({
            sceneId: cue.sceneId,
            sourcePath: cue.sourcePath,
            entryIndex: cue.entryIndex,
        });
    }

    const assets = [...byQualifiedId.values()].sort((left, right) =>
        compareQualifiedAssetIds(
            qualified(left.type, left.key),
            qualified(right.type, right.key)
        )
    );

    const unused = (plan?.assets ?? [])
        .filter(asset => !byQualifiedId.has(qualified(asset.type, asset.key)))
        .sort((left, right) =>
            compareQualifiedAssetIds(
                qualified(left.type, left.key),
                qualified(right.type, right.key)
            )
        )
        .map(asset => ({ type: asset.type, key: asset.key }));

    return {
        story: storyName,
        assets,
        bgmStops: [...usage.bgmStops],
        unused,
    };
}

export function validateAudioUsage(
    usage: CollectedAudioUsage,
    plan: AudioPlanV1 | undefined,
    planDisplayPath: string
): string[] {
    if (!plan) {
        const first = usage.cues[0];
        if (!first) return [];
        throw new Error(
            `[story-compiler] ${first.sourcePath}#${first.entryIndex}: audio cue "${first.key}" requires ${planDisplayPath}`
        );
    }

    const byKey = new Map(plan.assets.map(asset => [asset.key, asset]));
    const usedKeys = new Set<string>();
    for (const cue of usage.cues) {
        const asset = byKey.get(cue.key);
        if (!asset) {
            throw new Error(
                `[story-compiler] ${cue.sourcePath}#${cue.entryIndex}: unknown audio cue "${cue.key}"`
            );
        }
        if (asset.type !== cue.type) {
            throw new Error(
                `[story-compiler] ${cue.sourcePath}#${cue.entryIndex}: audio cue "${cue.key}" type mismatch; authored as ${cue.type}, planned as ${asset.type}`
            );
        }
        usedKeys.add(cue.key);
    }

    return plan.assets
        .filter(asset => !usedKeys.has(asset.key))
        .sort((left, right) =>
            compareQualifiedAssetIds(
                qualified(left.type, left.key),
                qualified(right.type, right.key)
            )
        )
        .map(
            asset =>
                `[story-compiler] unused audio-plan entry ${asset.type}:${asset.key}`
        );
}
