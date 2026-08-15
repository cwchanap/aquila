import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileStory } from '../compile';
import type { StoryCompilerConfig } from '../config';

const charactersMd = [
    '## 1. 旁白（Narrator）',
    '',
    '- **ID**: `narrator`',
].join('\n');

const audioPlanJson = JSON.stringify(
    {
        schemaVersion: 1,
        assets: [
            {
                key: 'door-open',
                type: 'sfx',
                prompt: 'Door',
                durationMs: 2200,
            },
            {
                key: 'dawn-apartment',
                type: 'bgm',
                prompt: 'Dawn',
                durationMs: 90000,
                loop: true,
            },
        ],
    },
    null,
    2
);

const validAct = [
    '# 第一幕：Fixture',
    '',
    '```sfx',
    'door-open',
    '```',
    '',
    '**旁白**：Door.',
    '',
    '```bgm',
    'dawn-apartment',
    '```',
    '',
    '**旁白**：Music.',
    '',
    '```bgm',
    'stop',
    '```',
    '',
    '**旁白**：Quiet.',
].join('\n');

const config: StoryCompilerConfig = {
    storyId: 'fixture_story',
    defaultSpeakerId: 'narrator',
};

const tempDirs: string[] = [];

function makeFixture(act1: string): string {
    const rawDir = mkdtempSync(join(tmpdir(), 'compile-'));
    tempDirs.push(rawDir);
    mkdirSync(join(rawDir, 'docs'), { recursive: true });
    writeFileSync(join(rawDir, 'docs', 'characters.md'), charactersMd);
    writeFileSync(join(rawDir, 'docs', 'audio-plan.json'), audioPlanJson);
    writeFileSync(join(rawDir, 'act1.md'), act1);
    return rawDir;
}

beforeAll(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe('compileStory', () => {
    it('emits the generated scene for plan-backed SFX and BGM', () => {
        const rawDir = makeFixture(validAct);
        const outDir = join(rawDir, 'out');
        const choicesPath = join(rawDir, 'choices.zh.ts');

        const story = compileStory({
            rawDir,
            name: 'fixtureStory',
            outDir,
            choicesPath,
            config,
        });

        expect(story.scenes).toHaveLength(1);
        const sceneFile = readFileSync(
            join(outDir, 'scenes', 'act1.ts'),
            'utf8'
        );
        expect(sceneFile).toContain('sfx: "door-open"');
        expect(sceneFile).toContain('bgm: "dawn-apartment"');
        expect(sceneFile).toContain('bgm: null');
        expect(existsSync(choicesPath)).toBe(true);
    });

    it('fails on an unknown audio cue before creating outputs', () => {
        const rawDir = makeFixture(
            validAct.replace('door-open', 'unknown-door')
        );
        const outDir = join(rawDir, 'out');
        const choicesPath = join(rawDir, 'choices.zh.ts');

        expect(() =>
            compileStory({
                rawDir,
                name: 'fixtureStory',
                outDir,
                choicesPath,
                config,
            })
        ).toThrow(/unknown audio cue/);
        expect(existsSync(outDir)).toBe(false);
        expect(existsSync(choicesPath)).toBe(false);
    });

    it('returns the StoryIR with cues but writes nothing when writeOutputs is false', () => {
        const rawDir = makeFixture(validAct);
        const outDir = join(rawDir, 'out');
        const choicesPath = join(rawDir, 'choices.zh.ts');

        const story = compileStory({
            rawDir,
            name: 'fixtureStory',
            outDir,
            choicesPath,
            config,
            writeOutputs: false,
        });

        expect(story.scenes[0].entries).toEqual([
            {
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: 'Door.',
                sfx: 'door-open',
            },
            {
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: 'Music.',
                bgm: 'dawn-apartment',
            },
            {
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: 'Quiet.',
                bgm: null,
            },
        ]);
        expect(existsSync(outDir)).toBe(false);
        expect(existsSync(choicesPath)).toBe(false);
    });
});
