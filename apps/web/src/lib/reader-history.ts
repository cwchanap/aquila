import type { DialogueEntry, RubySpan, Translations } from '@aquila/stories';
import {
    actLabel,
    chapterLabel,
    extractActName,
    extractChapterNum,
} from './act-navigation';
import { resolveCharacterName } from './character-name';
import { alignSecondDialogue } from './reader-second-language';

export type HistorySegment = { sceneId: string; lastIndex: number };
export type ReaderHistory = {
    storyId: string;
    current: HistorySegment | null;
    segments: HistorySegment[];
};
export type HistoryLine = {
    characterName: string;
    text: string;
    ruby?: RubySpan[];
    secondText?: string;
    secondRuby?: RubySpan[];
    separator?: string;
    /** Where the line sits in its story, so history can replay its voice. */
    sceneId?: string;
    index?: number;
};

export function updateReaderHistory(
    history: ReaderHistory,
    position: HistorySegment & { storyId: string; ready: boolean }
): ReaderHistory {
    if (!position.storyId) return history;
    if (position.storyId !== history.storyId) {
        history = { storyId: position.storyId, current: null, segments: [] };
    }
    if (!position.ready || !position.sceneId || position.lastIndex < 0)
        return history;
    const current = {
        sceneId: position.sceneId,
        lastIndex: position.lastIndex,
    };
    if (!history.current) return { ...history, current };
    if (history.current.sceneId === current.sceneId) {
        return history.current.lastIndex === current.lastIndex
            ? history
            : { ...history, current };
    }
    return {
        ...history,
        current,
        segments: [...history.segments, history.current].slice(-50),
    };
}

export function sceneHistoryLines(
    dialogue: readonly DialogueEntry[],
    lastIndex: number,
    t: Translations,
    secondDialogue: readonly DialogueEntry[] | null = null,
    separator?: string,
    sceneId?: string
): HistoryLine[] {
    return dialogue.slice(0, lastIndex + 1).map((entry, index) => ({
        characterName: resolveCharacterName(entry, t),
        text: entry.dialogue,
        ruby: entry.ruby,
        secondText: secondDialogue?.[index]?.dialogue,
        secondRuby: secondDialogue?.[index]?.ruby,
        ...(index === 0 && separator ? { separator } : {}),
        ...(sceneId ? { sceneId, index } : {}),
    }));
}

function historyHeading(sceneId: string, t: Translations): string | undefined {
    const act = actLabel(extractActName(sceneId), t);
    const chapter = extractChapterNum(sceneId);
    if (chapter !== null && act) return `${chapterLabel(chapter, t)} · ${act}`;
    if (chapter !== null) return chapterLabel(chapter, t);
    return act || undefined;
}

export function buildHistoryLines(
    segments: readonly HistorySegment[],
    getDialogue: (sceneId: string) => readonly DialogueEntry[] | null,
    second: Record<string, DialogueEntry[]> | undefined,
    t: Translations
): HistoryLine[] {
    return segments.flatMap(({ sceneId, lastIndex }) => {
        const dialogue = getDialogue(sceneId);
        if (!dialogue) return [];
        const label = historyHeading(sceneId, t);
        return sceneHistoryLines(
            dialogue,
            lastIndex,
            t,
            alignSecondDialogue(dialogue, second?.[sceneId]),
            label,
            sceneId
        );
    });
}
