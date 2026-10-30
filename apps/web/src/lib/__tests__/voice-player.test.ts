import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVoicePlayer } from '@/lib/audio/voice-player';

const FIRST = '01fa4da79b470a';
const SECOND = '1607a6b16ad510';

function fakeAudio() {
    return { play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
}

function indexResponse(lines: (string | null)[]): Response {
    return new Response(
        JSON.stringify({
            schemaVersion: 2,
            language: 'ja',
            scenes: { ch1_act1: lines },
        })
    );
}

describe('createVoicePlayer', () => {
    beforeEach(() => {
        vi.stubEnv('PUBLIC_ASSET_BASE_URL', 'https://assets.example/');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('stays silent without an asset host', async () => {
        vi.stubEnv('PUBLIC_ASSET_BASE_URL', '');
        const fetchImpl = vi.fn(async () => indexResponse([FIRST]));
        const player = createVoicePlayer({ fetchImpl });

        await expect(player.load('the_seventh_mirror')).resolves.toBe(false);
        player.play('ch1_act1', 0);

        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('plays the take for a scene position', async () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const fetchImpl = vi.fn(async () => indexResponse([FIRST, SECOND]));
        const player = createVoicePlayer({ createAudio, fetchImpl });

        await expect(player.load('the_seventh_mirror')).resolves.toBe(true);
        player.play('ch1_act1', 1);

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://assets.example/vn/voice/the_seventh_mirror/index.json'
        );
        expect(createAudio).toHaveBeenCalledWith(
            `https://assets.example/vn/voice/the_seventh_mirror/${SECOND}.mp3`
        );
        expect(audio.play).toHaveBeenCalledOnce();
    });

    it('stays silent for lines without audio and stops the previous line', async () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const fetchImpl = vi.fn(async () => indexResponse([FIRST, null]));
        const player = createVoicePlayer({ createAudio, fetchImpl });
        await player.load('the_seventh_mirror');
        await expect(player.load('the_seventh_mirror')).resolves.toBe(true);

        player.play('ch1_act1', 0);
        player.play('ch1_act1', 1);
        player.play('ch1_act2', 0);

        expect(fetchImpl).toHaveBeenCalledOnce();
        expect(createAudio).toHaveBeenCalledOnce();
        expect(audio.pause).toHaveBeenCalledOnce();
    });

    it('never fetches for a story without voice', async () => {
        const fetchImpl = vi.fn();
        const createAudio = vi.fn();
        const player = createVoicePlayer({ createAudio, fetchImpl });

        player.play('ch1_act1', 0);
        await player.load('train_adventure');
        player.play('act1', 0);

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(createAudio).not.toHaveBeenCalled();
    });

    it('retries a failed index fetch and shares one in flight', async () => {
        const createAudio = vi.fn(fakeAudio);
        const fetchImpl = vi
            .fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue(indexResponse([FIRST]));
        const player = createVoicePlayer({ createAudio, fetchImpl });

        await expect(player.load('the_seventh_mirror')).resolves.toBe(false);
        const first = player.load('the_seventh_mirror');
        const second = player.load('the_seventh_mirror');
        expect(second).toBe(first);
        await expect(first).resolves.toBe(true);
        player.play('ch1_act1', 0);

        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(createAudio).toHaveBeenCalledOnce();
    });

    it('retries a take the browser blocked once resumed', async () => {
        const blocked = Object.assign(new Error('blocked'), {
            name: 'NotAllowedError',
        });
        const audio = {
            play: vi
                .fn()
                .mockRejectedValueOnce(blocked)
                .mockResolvedValue(undefined),
            pause: vi.fn(),
        };
        const player = createVoicePlayer({
            createAudio: () => audio,
            fetchImpl: async () => indexResponse([FIRST]),
        });
        await player.load('the_seventh_mirror');

        player.resume();
        player.play('ch1_act1', 0);
        await Promise.resolve();
        await Promise.resolve();
        player.resume();
        player.resume();

        expect(audio.play).toHaveBeenCalledTimes(2);
    });

    it('treats a missing or malformed index as no voice', async () => {
        const createAudio = vi.fn();
        const missing = createVoicePlayer({
            createAudio,
            fetchImpl: async () => new Response('', { status: 404 }),
        });
        await missing.load('the_seventh_mirror');
        missing.play('ch1_act1', 0);

        const malformed = createVoicePlayer({
            createAudio,
            fetchImpl: async () => new Response('{"lines":"nope"}'),
        });
        await malformed.load('the_seventh_mirror');
        malformed.play('ch1_act1', 0);

        expect(createAudio).not.toHaveBeenCalled();
    });

    it('drops an index that arrives after another story replaced it', async () => {
        const createAudio = vi.fn(fakeAudio);
        let release: (response: Response) => void = () => {};
        const player = createVoicePlayer({
            createAudio,
            fetchImpl: () => new Promise(done => (release = done)),
        });

        const slow = player.load('the_seventh_mirror');
        await player.load('train_adventure');
        release(indexResponse([FIRST]));
        await expect(slow).resolves.toBe(false);
        player.play('ch1_act1', 0);

        expect(createAudio).not.toHaveBeenCalled();
    });

    it('ignores plays after dispose and swallows blocked autoplay', async () => {
        const audio = {
            play: vi.fn(() => Promise.reject(new Error('NotAllowedError'))),
            pause: vi.fn(),
        };
        const createAudio = vi.fn(() => audio);
        const player = createVoicePlayer({
            createAudio,
            fetchImpl: async () => indexResponse([FIRST]),
        });
        await player.load('the_seventh_mirror');

        player.play('ch1_act1', 0);
        await Promise.resolve();
        player.dispose();
        player.play('ch1_act1', 0);
        await player.load('train_adventure');

        expect(createAudio).toHaveBeenCalledOnce();
    });

    it('stays silent when the browser cannot create audio', async () => {
        const player = createVoicePlayer({
            createAudio: () => {
                throw new Error('no Audio');
            },
            fetchImpl: async () => indexResponse([FIRST]),
        });
        await player.load('the_seventh_mirror');

        expect(() => player.play('ch1_act1', 0)).not.toThrow();
        expect(() => player.stop()).not.toThrow();
    });
});
