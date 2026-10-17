import { afterAll, describe, expect, it, vi } from 'vitest';
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compileStory } from '../compile';
import type { StoryCompilerConfig } from '../config';

const charactersMd = [
    '## 1. 旁白（Narrator）',
    '',
    '- **ID**: `narrator`',
    '- **Aliases**: Narrator',
    '',
    '## 2. 林雨（Lin Yu）',
    '',
    '- **ID**: `lin_yu`',
    '- **Aliases**: Lin Yu',
    '',
    '### Portrait Prompts',
    '',
    '- **base**: young woman, short hair',
    '- **sad**: downcast eyes',
].join('\n');

const zhAct1 = [
    '# 第一幕：雨',
    '',
    '```bg',
    'laundromat at night, rain on the glass',
    '```',
    '',
    '**旁白**：下雨了。',
    '',
    '**林雨** [sad]：(內心)又是星期四。',
].join('\n');

const zhAct2 = ['# 第二幕：結局', '', '**旁白**：天亮了。'].join('\n');

const enAct1 = [
    '# Act 1: Rain',
    '',
    '**Narrator**: It was raining.',
    '',
    '**Lin Yu**: (thinking) Thursday again.',
].join('\n');

const enAct2 = ['# Act 2: Ending', '', '**Narrator**: Morning came.'].join(
    '\n'
);

const config: StoryCompilerConfig = {
    storyId: 'mirror_story',
    defaultSpeakerId: 'narrator',
};

const tempDirs: string[] = [];

function write(root: string, rel: string, content: string): void {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
}

function makeFixture(files: Record<string, string>): string {
    const rawDir = mkdtempSync(join(tmpdir(), 'localize-'));
    tempDirs.push(rawDir);
    write(rawDir, 'docs/characters.md', charactersMd);
    write(rawDir, 'act1.md', zhAct1);
    write(rawDir, 'act2.md', zhAct2);
    for (const [rel, content] of Object.entries(files)) {
        write(rawDir, rel, content);
    }
    return rawDir;
}

function compile(rawDir: string, writeOutputs = false) {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return compileStory({
        rawDir,
        name: 'mirrorStory',
        outDir: join(rawDir, 'out'),
        choicesPath: join(rawDir, 'choices.zh.ts'),
        config,
        writeOutputs,
    });
}

afterAll(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('en mirror tree', () => {
    it('leaves story.en undefined when there is no en/ directory', () => {
        const story = compile(makeFixture({}));
        expect(story.en).toBeUndefined();
    });

    it('takes text from en/ and visuals from the zh entry at the same index', () => {
        const story = compile(
            makeFixture({ 'en/act1.md': enAct1, 'en/act2.md': enAct2 })
        );
        const zh = story.scenes[0].entries;
        const en = story.en![0].entries;
        expect(en.map(e => e.dialogue)).toEqual([
            'It was raining.',
            '(thinking) Thursday again.',
        ]);
        expect(en.map(e => e.displayName)).toEqual(['Narrator', 'Lin Yu']);
        expect(en[0].background).toBe(zh[0].background);
        expect(en[1].portrait).toBe('lin_yu/sad');
        expect(story.en!.map(s => s.id)).toEqual(['act1', 'act2']);
    });

    it('keeps the zh title when a translation has no heading', () => {
        const story = compile(
            makeFixture({
                'en/act1.md': enAct1,
                'en/act2.md': '**Narrator**: Morning came.',
            })
        );
        expect(story.en!.map(s => s.title)).toEqual([
            'Act 1: Rain',
            '第二幕：結局',
        ]);
    });

    it('emits dialogue.en.ts and scenes/en/*.ts that import from the story root', () => {
        const rawDir = makeFixture({
            'en/act1.md': enAct1,
            'en/act2.md': enAct2,
        });
        compile(rawDir, true);
        const out = join(rawDir, 'out');
        const index = readFileSync(join(out, 'dialogue.en.ts'), 'utf8');
        expect(index).toContain("from './scenes/en/act1'");
        expect(index).toContain('export const mirrorStoryEnDialogue');
        const scene = readFileSync(join(out, 'scenes/en/act1.ts'), 'utf8');
        expect(scene).toContain("from '../../../../types'");
        expect(scene).toContain("from '../../characters'");
        expect(scene).toContain('Background.');
        expect(scene).toContain('"It was raining."');
    });

    it('rejects a translation with a different number of entries', () => {
        const rawDir = makeFixture({
            'en/act1.md': enAct1 + '\n\n**Narrator**: Extra line.',
            'en/act2.md': enAct2,
        });
        expect(() => compile(rawDir)).toThrow(/3 entries but act1.md has 2/);
    });

    it('rejects a translation whose speaker differs from zh', () => {
        const rawDir = makeFixture({
            'en/act1.md': enAct1.replace(
                '**Lin Yu**: (thinking)',
                '**Narrator**:'
            ),
            'en/act2.md': enAct2,
        });
        expect(() => compile(rawDir)).toThrow(
            /entry 2 is spoken by "narrator"/
        );
    });

    it('rejects a missing translation file', () => {
        const rawDir = makeFixture({ 'en/act1.md': enAct1 });
        expect(() => compile(rawDir)).toThrow(
            /missing en translation: en\/act2.md/
        );
    });

    it('rejects translation files with no zh source', () => {
        const rawDir = makeFixture({
            'en/act1.md': enAct1,
            'en/act2.md': enAct2,
            'en/act3.md': enAct2,
        });
        expect(() => compile(rawDir)).toThrow(/no zh source: act3.md/);
    });

    it('rejects bg blocks and expression tags in translations', () => {
        const withBg = makeFixture({
            'en/act1.md': enAct1.replace(
                '**Narrator**: It',
                '```bg\nrain\n```\n\n**Narrator**: It'
            ),
            'en/act2.md': enAct2,
        });
        expect(() => compile(withBg)).toThrow(/fenced bg\/sfx\/bgm blocks/);

        const withTag = makeFixture({
            'en/act1.md': enAct1.replace('**Lin Yu**:', '**Lin Yu** [sad]:'),
            'en/act2.md': enAct2,
        });
        expect(() => compile(withTag)).toThrow(/\[expression\] tags/);
        expect(existsSync(join(withTag, 'out'))).toBe(false);
    });
});
