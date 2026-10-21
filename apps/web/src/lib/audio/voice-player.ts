import type { DialogueEntry } from '@aquila/stories';
import {
    VoiceIndexSchema,
    hasStoryVoice,
    voiceIndexPath,
    voiceLineId,
    voiceLinePath,
} from '@aquila/stories/voice';

/** Voice files ship with the web app; see the voice-casting skill. */
export const VOICE_BASE_URL = '/assets/vn/voice';

export interface VoicePlayer {
    /** Fetch which lines of this story have voice in this language. */
    load(storyId: string, locale: string): Promise<void>;
    /** Stop the current line and speak this one, if it has voice. */
    play(entry: DialogueEntry | undefined): void;
    stop(): void;
    dispose(): void;
}

type AudioLike = Pick<HTMLAudioElement, 'play' | 'pause'>;

export type VoicePlayerOptions = {
    createAudio?: (src: string) => AudioLike;
    fetchImpl?: typeof fetch;
    baseUrl?: string;
};

export function createVoicePlayer(
    options: VoicePlayerOptions = {}
): VoicePlayer {
    const createAudio = options.createAudio ?? (src => new Audio(src));
    const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const baseUrl = options.baseUrl ?? VOICE_BASE_URL;
    let loadedKey: string | null = null;
    let story: { storyId: string; locale: string } | null = null;
    let lines: ReadonlySet<string> = new Set();
    let current: AudioLike | null = null;
    let disposed = false;

    function stop(): void {
        const audio = current;
        current = null;
        try {
            audio?.pause();
        } catch {
            // Best-effort cleanup.
        }
    }

    return {
        async load(storyId, locale) {
            const key = `${storyId}/${locale}`;
            if (disposed || key === loadedKey) return;
            loadedKey = key;
            story = { storyId, locale };
            lines = new Set();
            if (!hasStoryVoice(storyId, locale)) return;
            try {
                const response = await fetchImpl(
                    `${baseUrl}/${voiceIndexPath(storyId, locale)}`
                );
                if (!response.ok) return;
                const index = VoiceIndexSchema.parse(await response.json());
                // A newer load replaced this story while we waited.
                if (loadedKey === key) lines = new Set(index.lines);
            } catch {
                // No voice for this story; reading stays silent.
            }
        },
        play(entry) {
            if (disposed) return;
            stop();
            if (!entry || !story) return;
            const lineId = voiceLineId(entry);
            if (!lines.has(lineId)) return;
            try {
                const audio = createAudio(
                    `${baseUrl}/${voiceLinePath(story.storyId, story.locale, lineId)}`
                );
                current = audio;
                void audio.play().catch(() => {
                    if (current === audio) current = null;
                });
            } catch {
                current = null;
            }
        },
        stop,
        dispose() {
            disposed = true;
            stop();
        },
    };
}
