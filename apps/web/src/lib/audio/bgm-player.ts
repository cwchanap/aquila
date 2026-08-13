import { logger } from '@/lib/logger';
import { resolveLocalBgmUrl } from './bgm-catalog';

export interface BgmPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

type AudioLike = Pick<
    HTMLAudioElement,
    'play' | 'pause' | 'currentTime' | 'loop'
>;
type CreateAudio = (src: string) => AudioLike;

export function createBgmPlayer(
    createAudio: CreateAudio = src => new Audio(src)
): BgmPlayer {
    let current: AudioLike | null = null;
    let currentKey: string | null = null;
    let disposed = false;

    function stopCurrent(): void {
        const audio = current;
        current = null;
        currentKey = null;
        if (!audio) return;
        try {
            audio.pause();
        } catch {
            // Best-effort loop cleanup.
        }
        try {
            audio.currentTime = 0;
        } catch {
            // Best-effort loop cleanup.
        }
    }

    return {
        play(cueKey: string): void {
            if (disposed) return;
            const src = resolveLocalBgmUrl(cueKey);
            if (!src) {
                logger.warn('Unknown visual-novel BGM cue', { cueKey });
                return;
            }
            if (current && currentKey === cueKey) return;

            stopCurrent();
            try {
                const audio = createAudio(src);
                audio.loop = true;
                current = audio;
                currentKey = cueKey;
                const result = audio.play();
                void result.catch(() => {
                    if (current === audio) {
                        current = null;
                        currentKey = null;
                    }
                });
            } catch {
                current = null;
                currentKey = null;
            }
        },
        stop(): void {
            stopCurrent();
        },
        dispose(): void {
            if (disposed) return;
            disposed = true;
            stopCurrent();
        },
    };
}
