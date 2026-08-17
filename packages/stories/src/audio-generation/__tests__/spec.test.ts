import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAudioPlan } from '../../audio-plan-loader';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    buildAudioGenerationSpecSet,
    estimateScheduledAudioCostUsd,
} from '../spec';

describe('audio generation spec', () => {
    it('maps SFX to the exact current paid inputs', () => {
        expect(
            buildAudioGenerationSpec({
                key: 'door-open',
                type: 'sfx',
                prompt: 'Heavy apartment door opening',
                durationMs: 2200,
            })
        ).toEqual({
            schemaVersion: 1,
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening',
            durationMs: 2200,
            provider: 'elevenlabs',
            modelId: 'eleven_text_to_sound_v2',
            outputFormat: 'mp3_44100_128',
            loop: false,
            promptInfluence: 0.3,
        });
    });

    it('maps BGM to current instrumental music_v2 inputs', () => {
        expect(
            buildAudioGenerationSpec({
                key: 'dawn-apartment',
                type: 'bgm',
                prompt: 'Cold Tokyo dawn underscore',
                durationMs: 90_000,
                loop: true,
            })
        ).toEqual({
            schemaVersion: 1,
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Cold Tokyo dawn underscore',
            durationMs: 90_000,
            provider: 'elevenlabs',
            modelId: 'music_v2',
            outputFormat: 'auto',
            loopIntent: true,
            forceInstrumental: true,
        });
    });

    it('aggregates every provider-illegal row', () => {
        const result = buildAudioGenerationSpecSet([
            { key: 'too-short', type: 'sfx', prompt: 'x', durationMs: 400 },
            { key: 'too-long', type: 'sfx', prompt: 'y', durationMs: 30_001 },
            {
                key: 'tiny-music',
                type: 'bgm',
                prompt: 'z',
                durationMs: 2_999,
                loop: true,
            },
            {
                key: 'verbose-music',
                type: 'bgm',
                prompt: 'x'.repeat(4_101),
                durationMs: 90_000,
                loop: true,
            },
        ]);
        expect(result.issues.map(issue => issue.key)).toEqual([
            'too-short',
            'too-long',
            'tiny-music',
            'verbose-music',
        ]);
        expect(result.issues[3].message).toMatch(/prompt must be at most 4100/);
    });

    it('keeps the committed Seventh Mirror plan provider-compatible', () => {
        const rawDir = fileURLToPath(
            new URL('../../../raw/theSeventhMirror/', import.meta.url)
        );
        const plan = loadAudioPlan(rawDir);
        expect(plan).toBeDefined();
        expect(buildAudioGenerationSpecSet(plan!.assets).issues).toEqual([]);
    });

    it('hashes every paid input', () => {
        const spec = buildAudioGenerationSpec({
            key: 'impact',
            type: 'sfx',
            prompt: 'Muted impact',
            durationMs: 900,
        });
        expect(audioGenerationSpecSha256(spec)).toMatch(/^[a-f0-9]{64}$/);
        expect(
            audioGenerationSpecSha256({ ...spec, promptInfluence: 0.5 })
        ).not.toBe(audioGenerationSpecSha256(spec));
    });

    it('estimates over the repeated scheduled list, not unique keys', () => {
        const spec = buildAudioGenerationSpec({
            key: 'ambience',
            type: 'sfx',
            prompt: 'Thirty second ambience',
            durationMs: 30_000,
        });
        expect(estimateScheduledAudioCostUsd([spec, spec])).toBeCloseTo(
            0.12,
            8
        );
    });
});
