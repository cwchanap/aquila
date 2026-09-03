import type { DialogueEntry } from '@aquila/stories';

export type PortraitStageSlot = 'left' | 'right';

export type StagePortrait = {
    characterId: string;
    portrait: string;
};

export type PortraitStage = {
    left: StagePortrait | null;
    right: StagePortrait | null;
    activeSlot: PortraitStageSlot | null;
};

export function projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage {
    let left: StagePortrait | null = null;
    let right: StagePortrait | null = null;
    let activeSlot: PortraitStageSlot | null = null;
    let lastSpeakerSlot: PortraitStageSlot | null = null;

    const last = Math.min(dialogueIndex, dialogue.length - 1);
    for (let index = 0; index <= last; index += 1) {
        const entry = dialogue[index];

        if (!entry?.characterId) {
            activeSlot = null;
            continue;
        }

        const visibleSlot: PortraitStageSlot | null =
            left?.characterId === entry.characterId
                ? 'left'
                : right?.characterId === entry.characterId
                  ? 'right'
                  : null;

        if (visibleSlot) {
            const existing = visibleSlot === 'left' ? left! : right!;
            const next = entry.portrait
                ? { characterId: entry.characterId, portrait: entry.portrait }
                : existing;
            if (visibleSlot === 'left') left = next;
            else right = next;
            activeSlot = visibleSlot;
            lastSpeakerSlot = visibleSlot;
            continue;
        }

        if (!entry.portrait) {
            activeSlot = null;
            continue;
        }

        const target: PortraitStageSlot =
            left === null
                ? 'left'
                : right === null
                  ? 'right'
                  : lastSpeakerSlot === 'left'
                    ? 'right'
                    : 'left';

        const placed = {
            characterId: entry.characterId,
            portrait: entry.portrait,
        };
        if (target === 'left') left = placed;
        else right = placed;
        activeSlot = target;
        lastSpeakerSlot = target;
    }

    return { left, right, activeSlot };
}
