import type { ChoiceMap } from '../types';
import type { FlowConfig } from '../flow-types';
import { parseRuby } from '../ruby';

export interface ChoiceText {
    [choiceId: string]: {
        prompt: string;
        labels: Record<string, string>; // optionId -> label
    };
}

/**
 * Merge generated flow transitions (which option leads to which scene) with
 * hand-maintained choice text (prompt + labels) into the runtime ChoiceMap.
 * Missing text falls back to a visible TODO marker. Japanese text may carry
 * furigana markup (`｜漢字《かんじ》`), split out into `promptRuby`/`labelRuby`.
 */
export function buildChoiceMap(flow: FlowConfig, text: ChoiceText): ChoiceMap {
    const map: ChoiceMap = {};
    for (const node of flow.nodes) {
        if (node.kind !== 'choice') continue;
        const t = text[node.choiceId] ?? { prompt: '', labels: {} };
        const prompt = parseRuby(
            t.prompt || `TODO: prompt for ${node.choiceId}`
        );
        map[node.choiceId] = {
            prompt: prompt.text,
            ...(prompt.ruby.length > 0 && { promptRuby: prompt.ruby }),
            options: Object.entries(node.nextByOption).map(
                ([optionId, nextScene]) => {
                    const label = parseRuby(
                        t.labels[optionId] || `TODO: ${optionId}`
                    );
                    return {
                        id: optionId,
                        label: label.text,
                        ...(label.ruby.length > 0 && {
                            labelRuby: label.ruby,
                        }),
                        nextScene,
                    };
                }
            ),
        };
    }
    return map;
}
