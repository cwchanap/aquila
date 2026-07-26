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
            'a,button,input,select,textarea,option,[contenteditable="true"],' +
                '[role="dialog"],[data-reader-interactive]'
        ) !== null
    );
}
