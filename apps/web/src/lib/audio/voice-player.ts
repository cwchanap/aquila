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
    /** Fetch which lines of this story have voice. Resolves true once the
     *  story's index is ready, so the caller can speak the line on screen. A
     *  failed fetch is retried on the next call. */
    load(storyId: string): Promise<boolean>;
    /** Stop the current line and speak this one, if it has voice. Voice is
     *  keyed by position, so it plays whatever language the text is in. */
    play(sceneId: string, dialogueIndex: number): void;
    /** Retry a line the browser blocked before the reader's first gesture. */
    resume(): void;
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
    let loading: Promise<boolean> | null = null;
    let current: AudioLike | null = null;
    let blocked = false;
    let disposed = false;

    function stop(): void {
        const audio = current;
        current = null;
        blocked = false;
        try {
            audio?.pause();
        } catch {
            // Best-effort cleanup.
        }
    }

    function start(audio: AudioLike): void {
        void audio.play().catch((error: unknown) => {
            if (current !== audio) return;
            // Autoplay before any gesture: keep the take for resume().
            if (error instanceof Error && error.name === 'NotAllowedError') {
                blocked = true;
            } else {
                current = null;
            }
        });
    }

    async function fetchIndex(id: string): Promise<boolean> {
        if (!hasStoryVoice(id)) return false;
        try {
            const response = await fetchImpl(
                `${baseUrl}/${voiceIndexPath(id)}`
            );
            if (response.ok) {
                const index = VoiceIndexSchema.parse(await response.json());
                // A newer load replaced this story while we waited.
                if (storyId !== id) return false;
                scenes = index.scenes;
                return true;
            }
        } catch {
            // Fall through: reading stays silent until a retry.
        }
        if (storyId === id) loading = null;
        return false;
    }

    return {
        load(nextStoryId) {
            if (disposed) return Promise.resolve(false);
            if (nextStoryId !== storyId) {
                storyId = nextStoryId;
                scenes = {};
                loading = null;
            }
            loading ??= fetchIndex(nextStoryId);
            return loading;
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
                start(audio);
            } catch {
                current = null;
            }
        },
        resume() {
            if (disposed || !blocked || !current) return;
            blocked = false;
            start(current);
        },
        stop,
        dispose() {
            disposed = true;
            stop();
        },
    };
}
