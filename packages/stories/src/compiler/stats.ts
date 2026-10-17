import type { StoryStats } from '../story-stats';
import type { SceneIR, StoryIR } from './ir';

function sceneChars(scene: SceneIR): number {
    let total = 0;
    for (const e of scene.entries)
        total += e.dialogue.replace(/\s/g, '').length;
    return total;
}

/** Measures a compiled story: scene/ending counts and the reading length of
 *  its shortest and longest paths from the start scene to an ending. */
export function computeStoryStats(
    story: StoryIR,
    chapters: number
): StoryStats {
    const scenes = new Map(story.scenes.map(s => [s.id, s]));
    const choices = new Map(story.choices.map(c => [c.choiceId, c]));

    const successors = (scene: SceneIR): string[] => {
        if (scene.next === null) return [];
        if (scene.next.startsWith('choice:')) {
            const choice = choices.get(scene.next.slice('choice:'.length));
            return choice ? choice.options.map(o => o.nextScene) : [];
        }
        return [scene.next];
    };

    // Iterative post-order DFS so 400+ scene sagas don't hit the call stack.
    const span = new Map<string, { min: number; max: number }>();
    const stack: { id: string; expanded: boolean }[] = [
        { id: story.start, expanded: false },
    ];
    const onPath = new Set<string>();
    while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const scene = scenes.get(top.id);
        if (!scene || span.has(top.id)) {
            stack.pop();
            continue;
        }
        const next = successors(scene).filter(id => scenes.has(id));
        if (!top.expanded) {
            top.expanded = true;
            onPath.add(top.id);
            for (const id of next) {
                if (onPath.has(id)) {
                    throw new Error(
                        `[story-compiler] ${story.name}: scene graph has a cycle through "${id}"`
                    );
                }
                if (!span.has(id)) stack.push({ id, expanded: false });
            }
            continue;
        }
        stack.pop();
        onPath.delete(top.id);
        const own = sceneChars(scene);
        if (next.length === 0) {
            span.set(top.id, { min: own, max: own });
        } else {
            const spans = next.map(id => span.get(id)!);
            span.set(top.id, {
                min: own + Math.min(...spans.map(s => s.min)),
                max: own + Math.max(...spans.map(s => s.max)),
            });
        }
    }

    const root = span.get(story.start) ?? { min: 0, max: 0 };
    return {
        scenes: story.scenes.length,
        chapters,
        endings: story.scenes.filter(s => s.next === null).length,
        minPathChars: root.min,
        maxPathChars: root.max,
    };
}
