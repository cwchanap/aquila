import { trainAdventureFlow } from '../../../stories/src/generated/trainAdventure/flow';
import { scene as act3Dialogue } from '../../../stories/src/generated/trainAdventure/scenes/en/act3';
import { scene as oneOptionDialogue } from '../../../stories/src/generated/trainAdventure/scenes/b1a_b2a_act8';
import { scene as threeOptionDialogue } from '../../../stories/src/generated/trainAdventure/scenes/en/b1b_act8';
import { scene as fourOptionDialogue } from '../../../stories/src/generated/trainAdventure/scenes/b1a_b2b_b3b_b4b_b5a_act70';
import { trainAdventureChoiceTextEn } from '../../../stories/src/stories/trainAdventure/choices.en';
import { buildChoiceMap } from '../../../stories/src/stories/choice-utils';

const flow = trainAdventureFlow;
const choices = buildChoiceMap(flow, trainAdventureChoiceTextEn);

export function choiceAfter(sceneId: string) {
    const node = flow.nodes.find(
        (entry): entry is Extract<typeof entry, { kind: 'scene' }> =>
            entry.kind === 'scene' && entry.sceneId === sceneId
    );
    const ref = node?.next ?? '';
    const choice = ref.startsWith('choice:')
        ? choices[ref.slice('choice:'.length)]
        : undefined;
    if (!choice?.options.length) {
        throw new Error(
            `train-adventure-choices.ts: "${sceneId}" must end at a choice`
        );
    }
    return choice;
}

export const VARIANTS = [
    {
        key: 'one-option',
        sceneId: 'b1a_b2a_act8',
        lastLine: oneOptionDialogue.length,
    },
    { key: 'two-option', sceneId: 'act3', lastLine: act3Dialogue.length },
    {
        key: 'three-option',
        sceneId: 'b1b_act8',
        lastLine: threeOptionDialogue.length,
    },
    {
        key: 'four-option',
        sceneId: 'b1a_b2b_b3b_b4b_b5a_act70',
        lastLine: fourOptionDialogue.length,
    },
].map(variant => ({ ...variant, choice: choiceAfter(variant.sceneId) }));

const EXPECTED_COUNTS: Record<string, number> = {
    'one-option': 1,
    'two-option': 2,
    'three-option': 3,
    'four-option': 4,
};
for (const variant of VARIANTS) {
    if (variant.choice.options.length !== EXPECTED_COUNTS[variant.key]) {
        throw new Error(
            `train-adventure-choices.ts: "${variant.sceneId}" should offer ` +
                `${EXPECTED_COUNTS[variant.key]} options`
        );
    }
}
