import type { DirNode } from './scan-story';
import { actSortKey, makeSceneId, optionIdFromDirRel } from './ids';
import type { ChoiceIR } from './ir';

export interface GraphScene {
    id: string;
    sourcePath: string; // md path relative to story root
    next: string | null;
}

export interface StoryGraph {
    start: string;
    scenes: GraphScene[];
    choices: ChoiceIR[];
}

function orderedActs(node: DirNode): string[] {
    if (node.acts.length === 0) {
        throw new Error(
            `[story-compiler] directory "${node.rel || '<root>'}" has no .md scenes`
        );
    }
    return [...node.acts].sort((a, b) => actSortKey(a) - actSortKey(b));
}

function sourcePathFor(dirRel: string, act: string): string {
    return dirRel ? `${dirRel}/${act}.md` : `${act}.md`;
}

export function buildStoryGraph(root: DirNode): StoryGraph {
    const scenes: GraphScene[] = [];
    const choices: ChoiceIR[] = [];

    function process(node: DirNode): void {
        const acts = orderedActs(node);
        // Sorted once and reused for both the choice options and the recursion,
        // so child ordering can never drift between the two.
        const sortedChildren = [...node.children].sort((a, b) =>
            a.rel.localeCompare(b.rel)
        );
        acts.forEach((act, i) => {
            const id = makeSceneId(node.rel, act);
            const sourcePath = sourcePathFor(node.rel, act);
            let next: string | null;
            if (i < acts.length - 1) {
                next = makeSceneId(node.rel, acts[i + 1]);
            } else if (sortedChildren.length > 0) {
                const choiceId = `choice_${id}`;
                choices.push({
                    choiceId,
                    fromSceneId: id,
                    options: sortedChildren.map(child => ({
                        optionId: optionIdFromDirRel(child.rel),
                        nextScene: makeSceneId(
                            child.rel,
                            orderedActs(child)[0]
                        ),
                    })),
                });
                next = `choice:${choiceId}`;
            } else {
                next = null;
            }
            scenes.push({ id, sourcePath, next });
        });
        for (const child of sortedChildren) {
            process(child);
        }
    }

    process(root);
    return { start: makeSceneId('', orderedActs(root)[0]), scenes, choices };
}
