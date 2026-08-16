import { createHash } from 'node:crypto';
import type { AudioPlanAsset } from '../audio-plan';
import { canonicalJson, type JsonValue } from '../runtime-assets';

const SFX_MIN_DURATION_MS = 500;
const SFX_MAX_DURATION_MS = 30_000;
const BGM_MIN_DURATION_MS = 3_000;
const BGM_MAX_DURATION_MS = 600_000;

export const ELEVENLABS_PRICING_AS_OF = '2026-08-16';
export const ELEVENLABS_SFX_USD_PER_MINUTE = 0.12;
export const ELEVENLABS_BGM_USD_PER_MINUTE = 0.15;

type CurrentSfxAudioGenerationSpec = {
    readonly schemaVersion: 1;
    readonly key: string;
    readonly type: 'sfx';
    readonly prompt: string;
    readonly durationMs: number;
    readonly provider: 'elevenlabs';
    readonly modelId: 'eleven_text_to_sound_v2';
    readonly outputFormat: 'mp3_44100_128';
    readonly loop: false;
    readonly promptInfluence: number;
};

type CurrentBgmAudioGenerationSpec = {
    readonly schemaVersion: 1;
    readonly key: string;
    readonly type: 'bgm';
    readonly prompt: string;
    readonly durationMs: number;
    readonly provider: 'elevenlabs';
    readonly modelId: 'music_v2';
    readonly outputFormat: 'auto';
    readonly loopIntent: true;
    readonly forceInstrumental: true;
};

export type CurrentAudioGenerationSpec =
    | CurrentSfxAudioGenerationSpec
    | CurrentBgmAudioGenerationSpec;

export interface AudioGenerationSpecIssue {
    readonly key: string;
    readonly type: AudioPlanAsset['type'];
    readonly message: string;
}

export interface AudioGenerationSpecSet {
    readonly specs: readonly CurrentAudioGenerationSpec[];
    readonly issues: readonly AudioGenerationSpecIssue[];
}

function assertDurationInRange(
    asset: AudioPlanAsset,
    minimum: number,
    maximum: number,
    label: string
): void {
    if (asset.durationMs < minimum || asset.durationMs > maximum) {
        throw new Error(
            `${label} durationMs must be between ${minimum} and ${maximum}ms (received ${asset.durationMs})`
        );
    }
}

export function buildAudioGenerationSpec(
    asset: Extract<AudioPlanAsset, { type: 'sfx' }>
): CurrentSfxAudioGenerationSpec;
export function buildAudioGenerationSpec(
    asset: Extract<AudioPlanAsset, { type: 'bgm' }>
): CurrentBgmAudioGenerationSpec;
export function buildAudioGenerationSpec(
    asset: AudioPlanAsset
): CurrentAudioGenerationSpec;
export function buildAudioGenerationSpec(
    asset: AudioPlanAsset
): CurrentAudioGenerationSpec {
    if (asset.type === 'sfx') {
        assertDurationInRange(
            asset,
            SFX_MIN_DURATION_MS,
            SFX_MAX_DURATION_MS,
            'SFX'
        );
        return {
            schemaVersion: 1,
            key: asset.key,
            type: 'sfx',
            prompt: asset.prompt,
            durationMs: asset.durationMs,
            provider: 'elevenlabs',
            modelId: 'eleven_text_to_sound_v2',
            outputFormat: 'mp3_44100_128',
            loop: false,
            promptInfluence: 0.3,
        };
    }

    assertDurationInRange(
        asset,
        BGM_MIN_DURATION_MS,
        BGM_MAX_DURATION_MS,
        'BGM'
    );
    return {
        schemaVersion: 1,
        key: asset.key,
        type: 'bgm',
        prompt: asset.prompt,
        durationMs: asset.durationMs,
        provider: 'elevenlabs',
        modelId: 'music_v2',
        outputFormat: 'auto',
        loopIntent: asset.loop,
        forceInstrumental: true,
    };
}

export function buildAudioGenerationSpecSet(
    assets: readonly AudioPlanAsset[]
): AudioGenerationSpecSet {
    const specs: CurrentAudioGenerationSpec[] = [];
    const issues: AudioGenerationSpecIssue[] = [];

    for (const asset of assets) {
        try {
            specs.push(buildAudioGenerationSpec(asset));
        } catch (error) {
            issues.push({
                key: asset.key,
                type: asset.type,
                message: error instanceof Error ? error.message : String(error),
            });
        }
    }

    return { specs, issues };
}

export function audioGenerationSpecSha256(
    spec: CurrentAudioGenerationSpec
): string {
    return createHash('sha256')
        .update(canonicalJson(spec as unknown as JsonValue))
        .digest('hex');
}

export function estimateScheduledAudioCostUsd(
    specs: readonly CurrentAudioGenerationSpec[]
): number {
    return specs.reduce(
        (total, spec) =>
            total +
            (spec.durationMs / 60_000) *
                (spec.type === 'sfx'
                    ? ELEVENLABS_SFX_USD_PER_MINUTE
                    : ELEVENLABS_BGM_USD_PER_MINUTE),
        0
    );
}
