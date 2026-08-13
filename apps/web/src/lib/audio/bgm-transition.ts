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
    flow: StoryFlowConfig | null
): string | null {
    const local = activeBgmAt(entries, next.index);
    if (local !== undefined) return local;
    if (!previous) return null;
    if (previous.storyId !== next.storyId) return null;
    if (isForwardAdjacent(previous, next, flow)) return selectedKey;
    return null;
}
