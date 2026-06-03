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

interface ProcessResult {
    firstSceneId: string;
    lastSceneId: string;
}

export function buildStoryGraph(root: DirNode): StoryGraph {
    const scenes: GraphScene[] = [];
    const choices: ChoiceIR[] = [];

    function process(node: DirNode): ProcessResult | null {
        const sortedChildren = [...node.children].sort((a, b) =>
            a.rel.localeCompare(b.rel)
        );
        const sortedChapters = [...node.chapters].sort((a, b) =>
            a.rel.localeCompare(b.rel)
        );

        let firstSceneId: string | null = null;
        let lastSceneId: string | null = null;

        if (node.acts.length > 0) {
            const acts = orderedActs(node);
            acts.forEach((act, i) => {
                const id = makeSceneId(node.rel, act);
                const sourcePath = sourcePathFor(node.rel, act);
                if (!firstSceneId) firstSceneId = id;
                lastSceneId = id;

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
        }

        for (const child of sortedChildren) {
            process(child);
        }

        for (let i = 0; i < sortedChapters.length; i++) {
            const chapterResult = process(sortedChapters[i]);
            if (!chapterResult) continue;

            if (!firstSceneId) {
                firstSceneId = chapterResult.firstSceneId;
            }

            if (lastSceneId) {
                const prev = scenes.find(s => s.id === lastSceneId);
                if (prev && prev.next === null) {
                    prev.next = chapterResult.firstSceneId;
                }
            }

            lastSceneId = chapterResult.lastSceneId;
        }

        return firstSceneId
            ? { firstSceneId, lastSceneId: lastSceneId! }
            : null;
    }

    const result = process(root);
    if (!result) {
        throw new Error(
            `[story-compiler] story has no scenes (no acts or chapters found)`
        );
    }
    return { start: result.firstSceneId, scenes, choices };
}
