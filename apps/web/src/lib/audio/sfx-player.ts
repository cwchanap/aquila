import { logger } from '@/lib/logger';
import { resolveLocalSfxUrl } from './sfx-catalog';

export interface SfxPlayer {
    play(cueKey: string): void;
    stop(): void;
    dispose(): void;
}

type AudioLike = Pick<HTMLAudioElement, 'play' | 'pause' | 'currentTime'>;
type CreateAudio = (src: string) => AudioLike;

export function createSfxPlayer(
    createAudio: CreateAudio = src => new Audio(src)
): SfxPlayer {
    let current: AudioLike | null = null;
    let disposed = false;

    function stopCurrent(): void {
        const audio = current;
        current = null;
        if (!audio) return;
        try {
            audio.pause();
        } catch {
            // Best-effort one-shot cleanup.
        }
        try {
            audio.currentTime = 0;
        } catch {
            // Best-effort one-shot cleanup.
        }
    }

    return {
        play(cueKey: string): void {
            if (disposed) return;
            stopCurrent();
            const src = resolveLocalSfxUrl(cueKey);
            if (!src) {
                logger.warn('Unknown visual-novel SFX cue', { cueKey });
                return;
            }
            try {
                const audio = createAudio(src);
                current = audio;
                const result = audio.play();
                void result.catch(() => {
                    if (current === audio) current = null;
                });
            } catch {
                current = null;
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
