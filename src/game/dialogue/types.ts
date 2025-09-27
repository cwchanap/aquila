import type { CharacterId } from '../characters/CharacterDirectory';
import type { SceneId } from '../SceneDirectory';

export type DialogueEntry = {
    character?: string;
    characterId?: CharacterId;
    dialogue: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

export type ChoiceOptionDefinition = {
    id: string;
    nextScene: SceneId;
    label: string;
};

export type ChoiceDefinition = {
    prompt: string;
    options: ChoiceOptionDefinition[];
};

export type ChoiceMap = { [choiceId: string]: ChoiceDefinition };
