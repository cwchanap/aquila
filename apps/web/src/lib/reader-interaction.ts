import type { StoryFlowConfig, SceneNodeDefinition } from '@aquila/stories';

export type ReaderAdvanceDecision =
    | 'skip'
    | 'advance-line'
    | 'open-choice'
    | 'advance-scene'
    | 'complete'
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
    if (isChoicePosition(input.index, input.length, input.hasChoice)) {
        return 'open-choice';
    }
    if (input.canGoNext && !input.hasChoice) return 'advance-scene';
    if (input.length > 0 && !input.hasChoice) return 'complete';
    return 'none';
}

export function isChoicePosition(
    index: number,
    length: number,
    hasChoice: boolean
): boolean {
    return hasChoice && length > 0 && index === length - 1;
}

export type ReaderAdvanceLabelKey =
    'continue' | 'choose' | 'nextScene' | 'complete';

export function advanceLabelKey(
    decision: ReaderAdvanceDecision
): ReaderAdvanceLabelKey | null {
    switch (decision) {
        case 'advance-line':
            return 'continue';
        case 'open-choice':
            return 'choose';
        case 'advance-scene':
            return 'nextScene';
        case 'complete':
            return 'complete';
        default:
            return null;
    }
}

export function isEndingPosition(
    flow: StoryFlowConfig | null,
    sceneId: string | null,
    dialogueIndex: number,
    dialogueLength: number,
    hasChoice: boolean
): boolean {
    if (!flow || !sceneId || hasChoice || dialogueLength === 0) return false;
    if (dialogueIndex !== dialogueLength - 1) return false;
    const node = flow.nodes.find(
        (n): n is SceneNodeDefinition =>
            n.kind === 'scene' && n.sceneId === sceneId
    );
    if (!node) return false;
    return node.next === null || node.next === undefined;
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
