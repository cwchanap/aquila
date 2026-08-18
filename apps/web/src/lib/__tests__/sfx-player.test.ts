import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSfxPlayer } from '@/lib/audio/sfx-player';

const { warn } = vi.hoisted(() => ({
    warn: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: { warn },
}));

type FakeAudio = {
    play: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    currentTime: number;
};

function fakeAudio(currentTime = 0): FakeAudio {
    return {
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
        currentTime,
    };
}

describe('createSfxPlayer', () => {
    beforeEach(() => {
        warn.mockReset();
    });

    it('starts a catalog cue', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');

        expect(createAudio).toHaveBeenCalledWith(
            '/assets/vn/audio/sfx/door-open.wav'
        );
        expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it('passes an injected resolved URL to native audio', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const resolveUrl = vi.fn(
            () => 'https://assets.example/vn/objects/sfx.mp3'
        );

        createSfxPlayer(createAudio, resolveUrl).play('door-open');

        expect(resolveUrl).toHaveBeenCalledWith('door-open');
        expect(createAudio).toHaveBeenCalledWith(
            'https://assets.example/vn/objects/sfx.mp3'
        );
    });

    it('replaces the current cue and rewinds it', () => {
        const first = fakeAudio(2);
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');
        player.play('impact');

        expect(first.pause).toHaveBeenCalledTimes(1);
        expect(first.currentTime).toBe(0);
        expect(second.play).toHaveBeenCalledTimes(1);
    });

    it('logs and returns for an unknown runtime key', () => {
        const createAudio = vi.fn(() => fakeAudio());
        const player = createSfxPlayer(createAudio);

        player.play('unknown-runtime-cue');

        expect(createAudio).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('Visual-novel SFX cue unavailable', {
            cueKey: 'unknown-runtime-cue',
        });
    });

    it('contains a rejected play promise', async () => {
        const audio = fakeAudio();
        audio.play.mockReturnValueOnce(Promise.reject(new Error('blocked')));
        const player = createSfxPlayer(() => audio);

        expect(() => player.play('door-open')).not.toThrow();
        await Promise.resolve();
        expect(() => player.stop()).not.toThrow();
    });

    it('contains a synchronous play throw', () => {
        const audio = fakeAudio();
        audio.play.mockImplementationOnce(() => {
            throw new Error('not allowed');
        });
        const player = createSfxPlayer(() => audio);

        expect(() => player.play('door-open')).not.toThrow();
        expect(() => player.stop()).not.toThrow();
    });

    it('contains pause/rewind failures during stop', () => {
        let rewindAttempts = 0;
        const audio = {
            play: vi.fn(() => Promise.resolve()),
            pause: vi.fn(() => {
                throw new Error('pause failed');
            }),
            get currentTime(): number {
                return 4;
            },
            set currentTime(_value: number) {
                rewindAttempts += 1;
                throw new Error('rewind failed');
            },
        };
        const player = createSfxPlayer(() => audio);

        player.play('door-open');

        expect(() => player.stop()).not.toThrow();
        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(rewindAttempts).toBe(1);
    });

    it('disposes once and becomes inert', () => {
        const first = fakeAudio(3);
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createSfxPlayer(createAudio);

        player.play('door-open');
        player.dispose();
        player.dispose();
        player.play('impact');

        expect(first.pause).toHaveBeenCalledTimes(1);
        expect(first.currentTime).toBe(0);
        expect(createAudio).toHaveBeenCalledTimes(1);
        expect(second.play).not.toHaveBeenCalled();
    });
});
