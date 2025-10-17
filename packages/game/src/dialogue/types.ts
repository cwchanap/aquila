// Game-specific dialogue types that extend the base dialogue package
import type { Character } from '../characters/Character';
import type {
    DialogueEntry as BaseDialogueEntry,
    DialogueMap as BaseDialogueMap,
    ChoiceMap as BaseChoiceMap,
    ChoiceDefinition as BaseChoiceDefinition,
    ChoiceOptionDefinition as BaseChoiceOptionDefinition,
} from '@aquila/dialogue';
import type { SceneId } from '../SceneDirectory';

// Extended dialogue entry that allows Character instance references for game engine
export type DialogueEntry = BaseDialogueEntry & {
    characterRef?: Character;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

// Extended choice option that uses typed SceneId
export type ChoiceOptionDefinition = Omit<
    BaseChoiceOptionDefinition,
    'nextScene'
> & {
    nextScene: SceneId;
};

export type ChoiceDefinition = {
    prompt: string;
    options: ChoiceOptionDefinition[];
};

export type ChoiceMap = { [choiceId: string]: ChoiceDefinition };

// Re-export base types for convenience
export type {
    BaseDialogueEntry,
    BaseDialogueMap,
    BaseChoiceMap,
    BaseChoiceDefinition,
    BaseChoiceOptionDefinition,
};
