import { describe, expect, it, vi } from 'vitest';
import { voiceLineId } from '@aquila/stories/voice';
import { createVoicePlayer } from '@/lib/audio/voice-player';

const line = { characterId: 'narrator', dialogue: '手機螢幕亮了。' };
const other = { characterId: 'narrator', dialogue: '什麼都沒有。' };

function fakeAudio() {
    return { play: vi.fn(() => Promise.resolve()), pause: vi.fn() };
}

function indexResponse(lines: string[]): Response {
    return new Response(JSON.stringify({ schemaVersion: 1, lines }));
}

describe('createVoicePlayer', () => {
    it('plays a voiced line from the story and locale it loaded', async () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const fetchImpl = vi.fn(async () => indexResponse([voiceLineId(line)]));
        const player = createVoicePlayer({ createAudio, fetchImpl });

        await player.load('the_seventh_mirror', 'zh');
        player.play(line);

        expect(fetchImpl).toHaveBeenCalledWith(
            '/assets/vn/voice/the_seventh_mirror/zh/index.json'
        );
        expect(createAudio).toHaveBeenCalledWith(
            `/assets/vn/voice/the_seventh_mirror/zh/${voiceLineId(line)}.mp3`
        );
        expect(audio.play).toHaveBeenCalledOnce();
    });

    it('stays silent for lines without audio and stops the previous line', async () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const player = createVoicePlayer({
            createAudio,
            fetchImpl: async () => indexResponse([voiceLineId(line)]),
        });
        await player.load('the_seventh_mirror', 'zh');

        player.play(line);
        player.play(other);

        expect(createAudio).toHaveBeenCalledOnce();
        expect(audio.pause).toHaveBeenCalledOnce();
    });

    it('never fetches for a story or language without voice', async () => {
        const fetchImpl = vi.fn();
        const createAudio = vi.fn();
        const player = createVoicePlayer({ createAudio, fetchImpl });

        await player.load('the_seventh_mirror', 'en');
        await player.load('train_adventure', 'zh');
        player.play(line);

        expect(fetchImpl).not.toHaveBeenCalled();
        expect(createAudio).not.toHaveBeenCalled();
    });

    it('treats a missing or malformed index as no voice', async () => {
        const createAudio = vi.fn();
        const missing = createVoicePlayer({
            createAudio,
            fetchImpl: async () => new Response('', { status: 404 }),
        });
        await missing.load('the_seventh_mirror', 'zh');
        missing.play(line);

        const malformed = createVoicePlayer({
            createAudio,
            fetchImpl: async () => new Response('{"lines":"nope"}'),
        });
        await malformed.load('the_seventh_mirror', 'zh');
        malformed.play(line);

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
            fetchImpl: async () => indexResponse([voiceLineId(line)]),
        });
        await player.load('the_seventh_mirror', 'zh');

        player.play(line);
        await Promise.resolve();
        player.dispose();
        player.play(line);

        expect(createAudio).toHaveBeenCalledOnce();
    });

    it('stays silent when the browser cannot create audio', async () => {
        const player = createVoicePlayer({
            createAudio: () => {
                throw new Error('no Audio');
            },
            fetchImpl: async () => indexResponse([voiceLineId(line)]),
        });
        await player.load('the_seventh_mirror', 'zh');

        expect(() => player.play(line)).not.toThrow();
        expect(() => player.stop()).not.toThrow();
    });
});
