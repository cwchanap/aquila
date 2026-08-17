import { describe, expect, it } from 'vitest';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
} from '@aquila/stories/audio-generation';

describe('@aquila/stories/audio-generation exports', () => {
    it('exposes generation helpers whose hash changes with duration', () => {
        const shorter = buildAudioGenerationSpec({
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening',
            durationMs: 2200,
        });
        const longer = buildAudioGenerationSpec({
            ...shorter,
            durationMs: 2201,
        });

        expect(audioGenerationSpecSha256(shorter)).not.toBe(
            audioGenerationSpecSha256(longer)
        );
    });
});
