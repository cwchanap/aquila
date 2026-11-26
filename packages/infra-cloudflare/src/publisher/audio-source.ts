import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AudioPlanAsset } from '@aquila/stories';
import {
    loadAudioPublishingContext,
    type AudioPublishingContext,
} from '@aquila/stories/audio-publishing';
import {
    compareQualifiedAssetIds,
    isSafeLogicalKey,
    isSafeRelativePath,
    isStoryId,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import type { PublisherDiagnosticV1 } from './types';

export type AudioCoverageEntryV1 =
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'included';
      }
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'omitted';
          readonly reason: string;
      };

export interface PreparedAudioSource {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly plannedDurationMs: number;
    readonly loop: boolean;
    readonly sourceBytes: Uint8Array;
    readonly sourceFilename: string;
}

export interface AudioSourcePlan {
    readonly storyId: string;
    readonly sources: readonly PreparedAudioSource[];
    readonly coverage: readonly AudioCoverageEntryV1[];
    readonly diagnostics: readonly PublisherDiagnosticV1[];
}

const MISSING_SOUND_REASON = 'no sound file committed yet';

function error(
    code: 'input' | 'coverage' | 'source',
    message: string
): PublisherError {
    return new PublisherError(code, message, {
        context: { stage: code, input: 'audio-source' },
    });
}

function qualified(type: 'sfx' | 'bgm', key: string): string {
    return `${type}:${key.normalize('NFC')}`;
}

function compareAudioAssets(
    left: Pick<AudioPlanAsset, 'type' | 'key'>,
    right: Pick<AudioPlanAsset, 'type' | 'key'>
): number {
    return compareQualifiedAssetIds(
        qualified(left.type, left.key),
        qualified(right.type, right.key)
    );
}

function isNotFound(cause: unknown): boolean {
    return (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === 'ENOENT'
    );
}

function samples(assets: readonly Pick<AudioPlanAsset, 'type' | 'key'>[]) {
    return assets.map(asset => `${asset.type}:${asset.key}`).slice(0, 5);
}

/**
 * Reads the sound files of a story's audio plan. The files are committed at
 * `<mediaRoot>/<storyId>/<sfx|bgm>/<key>.mp3`, next to the story's art.
 *
 * A cue the story uses but that has no file yet is not an error: it is left
 * out of the release with a warning and plays nothing, so cues can be written
 * before their sounds are made.
 */
export async function prepareAudioSources(input: {
    readonly storyFolder: string;
    readonly expectedStoryId: string;
    readonly mediaRoot: string;
}): Promise<AudioSourcePlan> {
    if (!isSafeRelativePath(input.storyFolder)) {
        throw error(
            'input',
            'Audio story folder is not a supported relative path'
        );
    }
    if (!isStoryId(input.expectedStoryId)) {
        throw error('input', 'Audio story id is invalid');
    }

    let context: AudioPublishingContext;
    try {
        context = await loadAudioPublishingContext(input.storyFolder);
    } catch {
        throw error(
            'input',
            'Unable to load compiler-owned audio publishing inputs'
        );
    }
    if (context.storyId !== input.expectedStoryId) {
        throw error(
            'input',
            'Compiler story id does not match the requested story'
        );
    }

    const planAssets = [...context.plan.assets];
    if (planAssets.some(asset => !isSafeLogicalKey(asset.key))) {
        throw error('input', 'Audio plan contains an unsafe cue key');
    }
    const planByKey = new Map(planAssets.map(asset => [asset.key, asset]));
    const usageAssets = [...context.usage.assets].sort(compareAudioAssets);
    const usedKeys = new Set(usageAssets.map(usage => usage.key));
    for (const usage of usageAssets) {
        const planAsset = planByKey.get(usage.key);
        if (planAsset === undefined || planAsset.type !== usage.type) {
            throw error(
                'coverage',
                'Compiler audio usage does not match the audio plan'
            );
        }
    }

    const sources: PreparedAudioSource[] = [];
    const coverage: AudioCoverageEntryV1[] = [];
    const missing: AudioPlanAsset[] = [];
    for (const usage of usageAssets) {
        const asset = planByKey.get(usage.key)!;
        const sourceFilename = `${asset.key}.mp3`;
        let bytes: Uint8Array;
        try {
            bytes = new Uint8Array(
                await readFile(
                    join(
                        input.mediaRoot,
                        context.storyId,
                        asset.type,
                        sourceFilename
                    )
                )
            );
        } catch (cause) {
            if (!isNotFound(cause)) {
                throw error('source', 'Unable to read an audio source file');
            }
            missing.push(asset);
            coverage.push({
                type: usage.type,
                key: usage.key,
                usageCount: usage.usageCount,
                disposition: 'omitted',
                reason: MISSING_SOUND_REASON,
            });
            continue;
        }
        sources.push({
            type: asset.type,
            key: asset.key,
            plannedDurationMs: asset.durationMs,
            loop: asset.type === 'bgm',
            sourceBytes: bytes,
            sourceFilename,
        });
        coverage.push({
            type: usage.type,
            key: usage.key,
            usageCount: usage.usageCount,
            disposition: 'included',
        });
    }

    const diagnostics: PublisherDiagnosticV1[] = [];
    const unusedPlanAssets = planAssets
        .filter(asset => !usedKeys.has(asset.key))
        .sort(compareAudioAssets);
    if (unusedPlanAssets.length > 0) {
        diagnostics.push({
            code: 'audio/plan-unused',
            stage: 'coverage',
            message: 'Audio plan contains cues not used by the story',
            count: unusedPlanAssets.length,
            sampleIdentities: samples(unusedPlanAssets),
        });
    }
    if (missing.length > 0) {
        diagnostics.push({
            code: 'audio/missing-sound',
            stage: 'coverage',
            message: 'Audio cues used by the story have no sound file yet',
            count: missing.length,
            sampleIdentities: samples(missing),
        });
    }

    return { storyId: context.storyId, sources, coverage, diagnostics };
}
