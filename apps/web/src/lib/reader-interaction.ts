export type ReaderAdvanceDecision =
    | 'skip'
    | 'advance-line'
    | 'advance-scene'
    | 'none';

export type ReaderAdvanceInput = {
    isTyping: boolean;
    index: number;
    length: number;
    canGoNext: boolean;
    hasChoice: boolean;
};

export function getReaderAdvanceDecision(
    input: ReaderAdvanceInput
): ReaderAdvanceDecision {
    if (input.isTyping) return 'skip';
    if (input.index < input.length - 1) return 'advance-line';
    if (input.canGoNext && !input.hasChoice) return 'advance-scene';
    return 'none';
}

export function isReaderInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return (
        target.closest(
            'a,button,input,select,textarea,option,[contenteditable],' +
                '[role="dialog"],[data-reader-interactive]'
        ) !== null
    );
}

/**
 * Reader progression controls (Continue, Next Scene, choice buttons) are
 * interactive elements that ALSO count as eligible BGM activation gestures.
 * They carry `data-reader-progression` to distinguish them from settings,
 * history, and other interactive UI that should not activate BGM.
 */
export function isReaderProgressionTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return target.closest('[data-reader-progression]') !== null;
}
