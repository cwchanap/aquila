import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLocalBgmUrl } from '@/lib/audio/bgm-catalog';
import { createBgmPlayer } from '@/lib/audio/bgm-player';

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
    loop: boolean;
};

function fakeAudio(currentTime = 0): FakeAudio {
    return {
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
        currentTime,
        loop: false,
    };
}

describe('local BGM catalog', () => {
    it('returns undefined for an unknown cue', () => {
        expect(resolveLocalBgmUrl('unknown')).toBeUndefined();
    });
});

describe('createBgmPlayer', () => {
    beforeEach(() => {
        warn.mockReset();
    });

    it('starts a catalog cue and loops it', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const player = createBgmPlayer(createAudio);

        player.play('dawn-apartment');

        expect(createAudio).toHaveBeenCalledWith(
            '/assets/vn/audio/bgm/dawn-apartment.wav'
        );
        expect(audio.loop).toBe(true);
        expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it('passes an injected resolved URL to native audio', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const resolveUrl = vi.fn(
            () => 'https://assets.example/vn/audio/bgm/dawn-apartment.mp3'
        );

        createBgmPlayer(createAudio, resolveUrl).play('dawn-apartment');

        expect(resolveUrl).toHaveBeenCalledWith('dawn-apartment');
        expect(createAudio).toHaveBeenCalledWith(
            'https://assets.example/vn/audio/bgm/dawn-apartment.mp3'
        );
    });

    it('does not restart the active cue when the key is unchanged', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const player = createBgmPlayer(createAudio);

        player.play('dawn-apartment');
        player.play('dawn-apartment');

        expect(createAudio).toHaveBeenCalledTimes(1);
        expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it('does not restart when the resolved URL changes for the active key', () => {
        const audio = fakeAudio();
        const createAudio = vi.fn(() => audio);
        const resolveUrl = vi
            .fn<() => string | undefined>()
            .mockReturnValueOnce(
                'https://assets.example/vn/audio/bgm/dawn-apartment-v1.mp3'
            )
            .mockReturnValueOnce(
                'https://assets.example/vn/audio/bgm/dawn-apartment-v2.mp3'
            );
        const player = createBgmPlayer(createAudio, resolveUrl);

        player.play('dawn-apartment');
        player.play('dawn-apartment');

        expect(resolveUrl).toHaveBeenCalledTimes(2);
        expect(createAudio).toHaveBeenCalledTimes(1);
        expect(audio.play).toHaveBeenCalledTimes(1);
    });

    it('replaces the current cue and rewinds it', () => {
        const first = fakeAudio(2);
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createBgmPlayer(createAudio);

        player.play('dawn-apartment');
        player.play('tension-pulse');

        expect(first.pause).toHaveBeenCalledTimes(1);
        expect(first.currentTime).toBe(0);
        expect(second.loop).toBe(true);
        expect(second.play).toHaveBeenCalledTimes(1);
    });

    it('logs and returns for an unknown runtime key', () => {
        const createAudio = vi.fn(() => fakeAudio());
        const player = createBgmPlayer(createAudio);

        player.play('unknown-runtime-cue');

        expect(createAudio).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith('Visual-novel BGM cue unavailable', {
            cueKey: 'unknown-runtime-cue',
        });
    });

    it('stops and rewinds the active cue', () => {
        const audio = fakeAudio(4);
        const player = createBgmPlayer(() => audio);

        player.play('dawn-apartment');
        player.stop();

        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(audio.currentTime).toBe(0);
    });

    it('contains a synchronous play throw', () => {
        const audio = fakeAudio();
        audio.play.mockImplementationOnce(() => {
            throw new Error('not allowed');
        });
        const player = createBgmPlayer(() => audio);

        expect(() => player.play('dawn-apartment')).not.toThrow();
        expect(() => player.stop()).not.toThrow();
    });

    it('contains a rejected play promise', async () => {
        const audio = fakeAudio();
        audio.play.mockReturnValueOnce(Promise.reject(new Error('blocked')));
        const player = createBgmPlayer(() => audio);

        expect(() => player.play('dawn-apartment')).not.toThrow();
        await Promise.resolve();
        expect(() => player.stop()).not.toThrow();
    });

    it('can retry the same key after its play promise rejects', async () => {
        const first = fakeAudio();
        first.play.mockReturnValueOnce(Promise.reject(new Error('blocked')));
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createBgmPlayer(createAudio);

        player.play('dawn-apartment');
        await Promise.resolve();
        player.play('dawn-apartment');

        expect(createAudio).toHaveBeenCalledTimes(2);
        expect(second.play).toHaveBeenCalledTimes(1);
    });

    it('disposes once and becomes inert', () => {
        const first = fakeAudio(3);
        const second = fakeAudio();
        const createAudio = vi
            .fn()
            .mockReturnValueOnce(first)
            .mockReturnValueOnce(second);
        const player = createBgmPlayer(createAudio);

        player.play('dawn-apartment');
        player.dispose();
        player.dispose();
        player.play('tension-pulse');

        expect(first.pause).toHaveBeenCalledTimes(1);
        expect(first.currentTime).toBe(0);
        expect(createAudio).toHaveBeenCalledTimes(1);
        expect(second.play).not.toHaveBeenCalled();
    });

    it('swallows a throw from pause() during stopCurrent cleanup', () => {
        const audio = fakeAudio(2);
        audio.pause.mockImplementation(() => {
            throw new Error('pause unavailable');
        });
        const player = createBgmPlayer(() => audio);

        player.play('dawn-apartment');
        // stopCurrent must not propagate the pause() throw; currentTime is
        // still reset afterwards.
        expect(() => player.stop()).not.toThrow();
        expect(audio.currentTime).toBe(0);
    });

    it('swallows a throw from the currentTime setter during stopCurrent cleanup', () => {
        const audio = fakeAudio(2);
        Object.defineProperty(audio, 'currentTime', {
            get: () => 2,
            set: () => {
                throw new Error('seek locked');
            },
            configurable: true,
        });
        const player = createBgmPlayer(() => audio);

        player.play('dawn-apartment');
        // pause() still runs; the currentTime setter throw is swallowed.
        expect(() => player.stop()).not.toThrow();
        expect(audio.pause).toHaveBeenCalledTimes(1);
    });
});
