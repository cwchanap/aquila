import { SceneDirectory, type SceneId } from './SceneDirectory';

const STORAGE_PREFIX = 'aquila:checkpoint:';
const VERSION = 1;

export interface StoredCheckpoint {
    version: number;
    storyId: string;
    sceneId: SceneId;
    history: SceneId[];
    savedAt: number;
}

export interface CheckpointState {
    sceneId: SceneId;
    history: SceneId[];
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

export function loadCheckpoint(storyId: string): StoredCheckpoint | null {
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
        if (!SceneDirectory.isSceneId(sceneId)) return null;
        const history = Array.isArray(parsed.history) ? parsed.history : [];
        const filteredHistory = history.filter(SceneDirectory.isSceneId);
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
