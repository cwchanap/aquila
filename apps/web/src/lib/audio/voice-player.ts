import {
    VoiceIndexSchema,
    hasStoryVoice,
    voiceIndexPath,
    voiceLinePath,
    type VoiceIndex,
} from '@aquila/stories/voice';

/** Voice files ship with the web app; see the voice-casting skill. */
export const VOICE_BASE_URL = '/assets/vn/voice';

export interface VoicePlayer {
    /** Fetch which lines of this story have voice. Resolves true when a new
     *  index arrived, so the caller can speak the line already on screen. */
    load(storyId: string): Promise<boolean>;
    /** Stop the current line and speak this one, if it has voice. Voice is
     *  keyed by position, so it plays whatever language the text is in. */
    play(sceneId: string, dialogueIndex: number): void;
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
    let storyId: string | null = null;
    let scenes: VoiceIndex['scenes'] = {};
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
        async load(nextStoryId) {
            if (disposed || nextStoryId === storyId) return false;
            storyId = nextStoryId;
            scenes = {};
            if (!hasStoryVoice(nextStoryId)) return false;
            try {
                const response = await fetchImpl(
                    `${baseUrl}/${voiceIndexPath(nextStoryId)}`
                );
                if (!response.ok) return false;
                const index = VoiceIndexSchema.parse(await response.json());
                // A newer load replaced this story while we waited.
                if (disposed || storyId !== nextStoryId) return false;
                scenes = index.scenes;
                return true;
            } catch {
                // No voice for this story; reading stays silent.
                return false;
            }
        },
        play(sceneId, dialogueIndex) {
            if (disposed) return;
            stop();
            const lineId = scenes[sceneId]?.[dialogueIndex];
            if (!storyId || !lineId) return;
            try {
                const audio = createAudio(
                    `${baseUrl}/${voiceLinePath(storyId, lineId)}`
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
