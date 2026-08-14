import type { DialogueEntry, StoryFlowConfig } from '@aquila/stories';
import { isForwardAdjacent, type LinePosition } from './sfx-transition';

export function activeBgmAt(
    entries: readonly DialogueEntry[],
    index: number
): string | null | undefined {
    for (let i = Math.min(index, entries.length - 1); i >= 0; i -= 1) {
        const command = entries[i]?.bgm;
        if (command !== undefined) return command;
    }
    return undefined;
}

export function nextBgmSelection(
    previous: LinePosition | null,
    next: LinePosition,
    entries: readonly DialogueEntry[],
    selectedKey: string | null,
    flow: StoryFlowConfig | null,
    previousSceneLength: number | null = null
): string | null {
    const local = activeBgmAt(entries, next.index);
    if (local !== undefined) return local;
    if (!previous) return null;
    if (previous.storyId !== next.storyId) return null;
    if (!isForwardAdjacent(previous, next, flow)) return null;
    // Cross-scene inheritance requires the source to have been at its
    // final dialogue line. Act-panel jumps reset to index 0 and must
    // not be mistaken for genuine forward adjacency. When the previous
    // scene's length is unknown (null), fall back to the legacy behavior.
    if (
        previous.sceneId !== next.sceneId &&
        previousSceneLength !== null &&
        previous.index !== previousSceneLength - 1
    ) {
        return null;
    }
    return selectedKey;
}
