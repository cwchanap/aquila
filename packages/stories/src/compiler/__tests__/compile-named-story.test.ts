import {
    existsSync,
    mkdtempSync,
    mkdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { STORIES_RAW_ROOT } from '../config';
import { compileNamedStory } from '../compile-named-story';

const fixtureRoots: string[] = [];

afterEach(() => {
    for (const root of fixtureRoots.splice(0)) {
        const storyFolder = basename(root);
        rmSync(root, { recursive: true, force: true });
        rmSync(join(STORIES_RAW_ROOT, '..', 'src', 'generated', storyFolder), {
            recursive: true,
            force: true,
        });
        rmSync(join(STORIES_RAW_ROOT, '..', 'src', 'stories', storyFolder), {
            recursive: true,
            force: true,
        });
    }
});

function makeFixture(): string {
    const rawDir = mkdtempSync(join(STORIES_RAW_ROOT, 'compile-named-story-'));
    fixtureRoots.push(rawDir);
    mkdirSync(join(rawDir, 'docs'), { recursive: true });
    writeFileSync(
        join(rawDir, 'compiler.config.ts'),
        "export default { storyId: 'fixture_story', defaultSpeakerId: 'narrator' };\n"
    );
    writeFileSync(
        join(rawDir, 'docs', 'characters.md'),
        [
            '## 1. 旁白（Narrator）',
            '',
            '- **ID**: `narrator`',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: fixture narrator',
        ].join('\n')
    );
    writeFileSync(
        join(rawDir, 'act1.md'),
        ['# 第一幕：Fixture', '', '**旁白**：Hello.'].join('\n')
    );
    return rawDir;
}

describe('compileNamedStory', () => {
    it('compiles without creating generated or choices output when disabled', async () => {
        const rawDir = makeFixture();
        const storyFolder = basename(rawDir);
        const generatedDir = join(
            STORIES_RAW_ROOT,
            '..',
            'src',
            'generated',
            storyFolder
        );
        const choicesPath = join(
            STORIES_RAW_ROOT,
            '..',
            'src',
            'stories',
            storyFolder,
            'choices.zh.ts'
        );

        const story = await compileNamedStory(storyFolder, false);

        expect(story.storyId).toBe('fixture_story');
        expect(story.scenes).toHaveLength(1);
        expect(existsSync(generatedDir)).toBe(false);
        expect(existsSync(choicesPath)).toBe(false);
    });

    it('keeps the CLI generated and choices output paths when enabled', async () => {
        const rawDir = makeFixture();
        const storyFolder = basename(rawDir);
        const generatedDir = join(
            STORIES_RAW_ROOT,
            '..',
            'src',
            'generated',
            storyFolder
        );
        const choicesPath = join(
            STORIES_RAW_ROOT,
            '..',
            'src',
            'stories',
            storyFolder,
            'choices.zh.ts'
        );

        await compileNamedStory(storyFolder, true);

        expect(existsSync(join(generatedDir, 'scenes', 'act1.ts'))).toBe(true);
        expect(existsSync(choicesPath)).toBe(true);
    });
});
