import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitStory } from '../emit';
import type { ParsedCharacterDirectory } from '../parse-characters';
import type { StoryIR } from '../ir';

const mockCharDir: ParsedCharacterDirectory = {
    characters: [
        { id: 'narrator', name: '旁白', aliases: [], portraits: {} },
        { id: 'li_jie', name: '李杰', aliases: [], portraits: {} },
    ],
    getById: (id: string) => mockCharDir.characters.find(c => c.id === id),
    getIdByName: (name: string) =>
        mockCharDir.characters.find(c => c.name === name)?.id,
};

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
                    characterId: 'narrator',
                    displayName: '旁白',
                    dialogue: "It's night.",
                },
                {
                    characterId: 'li_jie',
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
                    characterId: 'narrator',
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
                    characterId: 'narrator',
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
        emitStory(story, dir, mockCharDir);
        expect(existsSync(join(dir, 'scenes', 'act1.ts'))).toBe(true);
        expect(existsSync(join(dir, 'dialogue.zh.ts'))).toBe(true);
        expect(existsSync(join(dir, 'flow.ts'))).toBe(true);
        expect(existsSync(join(dir, 'choices.todo.zh.ts'))).toBe(true);

        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).toContain('../characters');
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

    it('emits background and portrait keys in scene files', () => {
        const storyWithAssets: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: 'narrator',
                            displayName: '旁白',
                            dialogue: 'hello',
                            background: '_root/act1_s0',
                        },
                        {
                            characterId: 'li_jie',
                            displayName: '李杰',
                            dialogue: 'hi',
                            background: '_root/act1_s0',
                            portrait: 'li_jie/angry',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        emitStory(storyWithAssets, dir, mockCharDir);
        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).toContain('background: Background.Root_Act1_S0');
        expect(scene).toContain('portrait: Portrait.LiJie_Angry');

        const portraits = readFileSync(join(dir, 'portraits.ts'), 'utf8');
        expect(portraits).toContain('export enum Portrait {');
        expect(portraits).toContain('LiJie_Angry = "li_jie/angry"');

        const backgrounds = readFileSync(join(dir, 'backgrounds.ts'), 'utf8');
        expect(backgrounds).toContain('export enum Background {');
        expect(backgrounds).toContain('Root_Act1_S0 = "_root/act1_s0"');
    });

    it('emits image-assets.json manifest', () => {
        const storyWithManifest: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: 'narrator',
                            displayName: '旁白',
                            dialogue: 'hello',
                            background: '_root/act1_s0',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
            assetManifest: {
                storyId: 'demo_story',
                backgrounds: [
                    {
                        key: '_root/act1_s0',
                        path: 'demo_story/backgrounds/_root/act1_s0.png',
                        prompt: '月台',
                    },
                ],
                portraits: [
                    {
                        key: 'li_jie/base',
                        path: 'demo_story/characters/li_jie/base.png',
                        prompt: '17yo boy',
                    },
                ],
            },
        };
        emitStory(storyWithManifest, dir, mockCharDir);
        const manifestPath = join(dir, 'image-assets.json');
        expect(existsSync(manifestPath)).toBe(true);
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        expect(manifest.storyId).toBe('demo_story');
        expect(manifest.backgrounds).toHaveLength(1);
        expect(manifest.backgrounds[0].prompt).toBe('月台');
        expect(manifest.portraits).toHaveLength(1);
    });

    it('does not emit background/portrait fields when undefined', () => {
        const storyNoAssets: StoryIR = {
            storyId: 'demo_story',
            name: 'demoStory',
            start: 'act1',
            scenes: [
                {
                    id: 'act1',
                    entries: [
                        {
                            characterId: 'narrator',
                            displayName: '旁白',
                            dialogue: 'hello',
                        },
                    ],
                    next: null,
                    sourcePath: 'act1.md',
                },
            ],
            choices: [],
        };
        emitStory(storyNoAssets, dir, mockCharDir);
        const scene = readFileSync(join(dir, 'scenes', 'act1.ts'), 'utf8');
        expect(scene).not.toContain('background:');
        expect(scene).not.toContain('portrait:');
    });

    it('generates characters.ts with enum and directory', () => {
        emitStory(story, dir, mockCharDir);
        const charFile = readFileSync(join(dir, 'characters.ts'), 'utf8');
        expect(charFile).toContain('export enum CharacterId {');
        expect(charFile).toContain('Narrator = "narrator"');
        expect(charFile).toContain('LiJie = "li_jie"');
        expect(charFile).toContain('export const characterTable');
        expect(charFile).toContain('export class CharacterDirectory');
    });

    it('throws when two character IDs collapse to the same enum key', () => {
        const collidingDir: ParsedCharacterDirectory = {
            characters: [
                {
                    id: 'foo_bar',
                    name: '甲',
                    aliases: [],
                    portraits: {},
                },
                {
                    id: 'fooBar',
                    name: '乙',
                    aliases: [],
                    portraits: {},
                },
            ],
            getById: (id: string) =>
                collidingDir.characters.find(c => c.id === id),
            getIdByName: (name: string) =>
                collidingDir.characters.find(c => c.name === name)?.id,
        };
        // foo_bar and fooBar both derive to enum key "FooBar"
        expect(() => emitStory(story, dir, collidingDir)).toThrow(
            /collision after enum-key derivation.*FooBar.*foo_bar.*fooBar/s
        );
    });
});
