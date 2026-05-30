import { SceneDirectory } from './SceneDirectory';

const STORAGE_PREFIX = 'aquila:checkpoint:';
const VERSION = 1;

export interface StoredCheckpoint {
    version: number;
    storyId: string;
    sceneId: string;
    history: string[];
    savedAt: number;
}

export interface CheckpointState {
    sceneId: string;
    history: string[];
}

export interface CheckpointLoadOptions {
    /** Custom scene ID validator. Defaults to SceneDirectory.isRegisteredScene. */
    isValidSceneId?: (id: string) => boolean;
}

function getStorageKey(storyId: string): string {
    return `${STORAGE_PREFIX}${storyId}`;
}

export function saveCheckpoint(storyId: string, state: CheckpointState): void {
    if (!state.history.length) return;
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const payload: StoredCheckpoint = {
            version: VERSION,
            storyId,
            sceneId: state.sceneId,
            history: [...state.history],
            savedAt: Date.now(),
        };
        window.localStorage.setItem(
            getStorageKey(storyId),
            JSON.stringify(payload)
        );
    } catch (error) {
        console.warn('[CheckpointStorage] Failed to save checkpoint', error);
    }
}

export function loadCheckpoint(
    storyId: string,
    options?: CheckpointLoadOptions
): StoredCheckpoint | null {
    const isValidSceneId =
        options?.isValidSceneId ?? SceneDirectory.isRegisteredScene;

    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        const raw = window.localStorage.getItem(getStorageKey(storyId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<StoredCheckpoint>;
        if (!parsed) return null;
        if (parsed.version !== VERSION) return null;
        if (typeof parsed.storyId !== 'string' || parsed.storyId !== storyId) {
            return null;
        }
        const sceneId = parsed.sceneId;
        if (typeof sceneId !== 'string' || !isValidSceneId(sceneId))
            return null;
        const history = Array.isArray(parsed.history) ? parsed.history : [];
        const filteredHistory = history.filter(isValidSceneId);
        if (!filteredHistory.length) return null;
        return {
            version: VERSION,
            storyId,
            sceneId,
            history: filteredHistory,
            savedAt:
                typeof parsed.savedAt === 'number'
                    ? parsed.savedAt
                    : Date.now(),
        };
    } catch (error) {
        console.warn('[CheckpointStorage] Failed to load checkpoint', error);
        return null;
    }
}

export function clearCheckpoint(storyId: string): void {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.removeItem(getStorageKey(storyId));
    } catch (error) {
        console.warn('[CheckpointStorage] Failed to clear checkpoint', error);
    }
}
