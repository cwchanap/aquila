import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitStory } from '../emit';
import { CharacterId } from '../../characters';
import type { StoryIR } from '../ir';

const dir = mkdtempSync(join(tmpdir(), 'emit-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const story: StoryIR = {
    storyId: 'demo_story',
    name: 'demoStory',
    start: 'act1',
    scenes: [
        {
            id: 'act1',
            title: '第一幕',
            entries: [
                {
                    characterId: CharacterId.Narrator,
                    displayName: '旁白',
                    dialogue: "It's night.",
                },
                {
                    characterId: CharacterId.LiJie,
                    displayName: '李杰（內心）',
                    dialogue: '(內心)hm.',
                },
            ],
            next: 'choice:choice_act1',
            sourcePath: 'act1.md',
        },
        {
            id: 'b1a_act2',
            entries: [
                {
                    characterId: CharacterId.Narrator,
                    displayName: '旁白',
                    dialogue: 'a',
                },
            ],
            next: null,
            sourcePath: 'branch_1a/act2.md',
        },
        {
            id: 'b1b_act2',
            entries: [
                {
                    characterId: CharacterId.Narrator,
                    displayName: '旁白',
                    dialogue: 'b',
                },
            ],
            next: null,
            sourcePath: 'branch_1b/act2.md',
        },
    ],
    choices: [
        {
            choiceId: 'choice_act1',
            fromSceneId: 'act1',
            options: [
                { optionId: 'b1a', nextScene: 'b1a_act2' },
                { optionId: 'b1b', nextScene: 'b1b_act2' },
            ],
        },
    ],
};

describe('emitStory', () => {
    it('writes scene files, dialogue index, flow, and choice stub', () => {
        emitStory(story, dir);
        expect(existsSync(join(dir, 'scenes', 'act1.ts'))).toBe(true);
        expect(existsSync(join(dir, 'dialogue.zh.ts'))).toBe(true);
        expect(existsSync(join(dir, 'flow.ts'))).toBe(true);
        expect(existsSync(join(dir, 'choices.todo.zh.ts'))).toBe(true);

        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).toContain('../../../characters');
        expect(scene).toContain('CharacterId.Narrator');
        // string is JSON-escaped, so apostrophes survive safely
        expect(scene).toContain(JSON.stringify("It's night."));
        // as-written display label is emitted as the `character` field
        expect(scene).toContain(`character: ${JSON.stringify('李杰（內心）')}`);

        const flow = readFileSync(join(dir, 'flow.ts'), 'utf8');
        expect(flow).toContain('start: "act1"');
        expect(flow).toContain('id: "choice:choice_act1"');
        expect(flow).toContain('choiceId: "choice_act1"');
        expect(flow).toContain('export const demoStoryFlow');

        const idx = readFileSync(join(dir, 'dialogue.zh.ts'), 'utf8');
        expect(idx).toContain('export const demoStoryZhDialogue');
        expect(idx).toContain('"b1b_act2": s_b1b_act2');
    });
});
