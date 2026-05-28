import type { CharacterId } from '../characters';

export interface DialogueEntryIR {
    characterId: CharacterId;
    dialogue: string;
}

export interface SceneIR {
    id: string; // e.g. 'b1b_b2c_act14'
    title?: string; // from the leading "# ..." H1
    entries: DialogueEntryIR[];
    next: string | null; // scene id, 'choice:<choiceId>', or null (terminal)
    sourcePath: string; // md path relative to the story root (diagnostics)
}

export interface ChoiceOptionIR {
    optionId: string; // e.g. 'b2a'
    nextScene: string; // first scene id of the child branch
}

export interface ChoiceIR {
    choiceId: string; // e.g. 'choice_b1b_act8'
    fromSceneId: string; // the choice-point scene id
    options: ChoiceOptionIR[];
}

export interface StoryIR {
    storyId: string; // registry id, e.g. 'train_adventure'
    name: string; // raw dir name / export prefix, e.g. 'trainAdventure'
    start: string;
    scenes: SceneIR[];
    choices: ChoiceIR[];
}
