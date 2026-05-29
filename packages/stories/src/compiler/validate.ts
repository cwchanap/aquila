import type { StoryIR } from './ir';

export function validateStory(story: StoryIR): void {
    const sceneIds = new Set(story.scenes.map(s => s.id));
    const choiceById = new Map(story.choices.map(c => [c.choiceId, c]));

    if (!sceneIds.has(story.start)) {
        throw new Error(
            `[story-compiler] start scene "${story.start}" does not exist`
        );
    }

    // Every next target resolves to a scene or a known choice node.
    for (const scene of story.scenes) {
        if (scene.next === null) continue;
        if (scene.next.startsWith('choice:')) {
            const choiceId = scene.next.slice('choice:'.length);
            if (!choiceById.has(choiceId)) {
                throw new Error(
                    `[story-compiler] scene "${scene.id}" has dangling next -> unknown choice "${choiceId}"`
                );
            }
        } else if (!sceneIds.has(scene.next)) {
            throw new Error(
                `[story-compiler] scene "${scene.id}" has dangling next -> "${scene.next}"`
            );
        }
    }

    // Every choice option points at a real scene.
    for (const choice of story.choices) {
        for (const opt of choice.options) {
            if (!sceneIds.has(opt.nextScene)) {
                throw new Error(
                    `[story-compiler] choice "${choice.choiceId}" option "${opt.optionId}" -> missing scene "${opt.nextScene}"`
                );
            }
        }
    }

    // Reachability from start.
    const adjacency = new Map<string, string[]>();
    for (const scene of story.scenes) {
        const outs: string[] = [];
        if (scene.next && scene.next.startsWith('choice:')) {
            const c = choiceById.get(scene.next.slice('choice:'.length));
            if (c) outs.push(...c.options.map(o => o.nextScene));
        } else if (scene.next) {
            outs.push(scene.next);
        }
        adjacency.set(scene.id, outs);
    }
    const seen = new Set<string>();
    const stack = [story.start];
    while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const n of adjacency.get(id) ?? []) stack.push(n);
    }
    for (const scene of story.scenes) {
        if (!seen.has(scene.id)) {
            throw new Error(
                `[story-compiler] scene "${scene.id}" is unreachable from start`
            );
        }
    }
}
