import type { ChoiceMap } from '../types';
import type { FlowConfig } from '../flow-types';

export interface ChoiceText {
    [choiceId: string]: {
        prompt: string;
        labels: Record<string, string>; // optionId -> label
    };
}

/**
 * Merge generated flow transitions (which option leads to which scene) with
 * hand-maintained choice text (prompt + labels) into the runtime ChoiceMap.
 * Missing text falls back to a visible TODO marker.
 */
export function buildChoiceMap(flow: FlowConfig, text: ChoiceText): ChoiceMap {
    const map: ChoiceMap = {};
    for (const node of flow.nodes) {
        if (node.kind !== 'choice') continue;
        const t = text[node.choiceId] ?? { prompt: '', labels: {} };
        map[node.choiceId] = {
            prompt: t.prompt || `TODO: prompt for ${node.choiceId}`,
            options: Object.entries(node.nextByOption).map(
                ([optionId, nextScene]) => ({
                    id: optionId,
                    label: t.labels[optionId] || `TODO: ${optionId}`,
                    nextScene,
                })
            ),
        };
    }
    return map;
}
