import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
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
import type { StoryIR } from '../ir';
import type { StoryNotes } from '../../notes-types';

const charactersMd = [
    '## 1. 旁白（Narrator）',
    '',
    '- **ID**: `narrator`',
    '',
    '- **Aliases**: Narrator',
    '',
    '## 2. 李杰（Li Jie）',
    '',
    '- **ID**: `li_jie`',
    '',
    '- **Aliases**: Li Jie',
    '',
    '## 3. 文靜少女（Quiet Girl）',
    '',
    '- **ID**: `emi`',
    '',
    '- **Aliases**: 短髮少女, Quiet Girl, Short-haired girl',
    '',
    '## 4. 凌墨（Ling Mo）',
    '',
    '- **ID**: `ling_mo`',
    '',
    '- **Aliases**: Ling Mo',
    '',
    '## 5. 佐藤拓海（Sato Takumi）',
    '',
    '- **ID**: `sato_takumi`',
    '',
    '- **Aliases**: Sato Takumi',
    '',
    '## 6. 未知（Unknown）',
    '',
    '- **ID**: `unknown`',
    '',
    '- **Aliases**: ??',
].join('\n');

const defaultAct1 = [
    '# 第一幕',
    '',
    '**李杰**：我是李杰。',
    '',
    '**李杰**：再說一次。',
    '',
    '**短髮少女**：她說話了。',
].join('\n');

const defaultAct2 = ['# 第二幕', '', '**旁白**：結束。'].join('\n');

const config: StoryCompilerConfig = {
    storyId: 'fixture_story',
    defaultSpeakerId: 'narrator',
};

interface FixtureOptions {
    act1?: string;
    act2?: string;
    notesZh?: string;
    notesEn?: string;
    enAct1?: string;
    branches?: { a: string; b: string };
}

const tempDirs: string[] = [];

function makeFixture(opts: FixtureOptions = {}): string {
    const rawDir = mkdtempSync(join(tmpdir(), 'notes-'));
    tempDirs.push(rawDir);
    mkdirSync(join(rawDir, 'docs'), { recursive: true });
    writeFileSync(join(rawDir, 'docs', 'characters.md'), charactersMd);
    writeFileSync(
        join(rawDir, 'docs', 'audio-plan.json'),
        JSON.stringify({ schemaVersion: 1, assets: [] })
    );
    writeFileSync(join(rawDir, 'act1.md'), opts.act1 ?? defaultAct1);
    writeFileSync(join(rawDir, 'act2.md'), opts.act2 ?? defaultAct2);
    if (opts.branches) {
        mkdirSync(join(rawDir, 'branch_1a'), { recursive: true });
        mkdirSync(join(rawDir, 'branch_1b'), { recursive: true });
        writeFileSync(join(rawDir, 'branch_1a', 'act3.md'), opts.branches.a);
        writeFileSync(join(rawDir, 'branch_1b', 'act3.md'), opts.branches.b);
    }
    if (opts.notesZh !== undefined) {
        mkdirSync(join(rawDir, 'notes'), { recursive: true });
        writeFileSync(join(rawDir, 'notes', 'zh.md'), opts.notesZh);
    }
    if (opts.notesEn !== undefined) {
        mkdirSync(join(rawDir, 'notes'), { recursive: true });
        writeFileSync(join(rawDir, 'notes', 'en.md'), opts.notesEn);
    }
    if (opts.enAct1 !== undefined) {
        mkdirSync(join(rawDir, 'en'), { recursive: true });
        writeFileSync(join(rawDir, 'en', 'act1.md'), opts.enAct1);
    }
    return rawDir;
}

function compile(
    rawDir: string,
    opts: { writeOutputs?: boolean; outName?: string } = {}
): StoryIR {
    return compileStory({
        rawDir,
        name: 'fixtureStory',
        outDir: join(rawDir, opts.outName ?? 'out'),
        choicesPath: join(rawDir, `${opts.outName ?? 'out'}-choices.zh.ts`),
        config,
        writeOutputs: opts.writeOutputs,
    });
}

function notesOf(story: StoryIR): StoryNotes {
    if (!story.notes) throw new Error('expected compiled notes');
    return story.notes;
}

function eventsFor(
    notes: StoryNotes,
    characterId: string,
    kind?: StoryNotes['events'][number]['kind']
) {
    return notes.events.filter(
        e =>
            e.characterId === characterId &&
            (kind === undefined || e.kind === kind)
    );
}

beforeAll(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe('compileStory notes', () => {
    it('takes canonical zh names and localized facts from characters.md and mirrors', () => {
        const rawDir = makeFixture({
            act1: [
                '```unlock',
                'li_jie.age',
                '```',
                '',
                '**李杰**：我是李杰。',
            ].join('\n'),
            notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
            notesEn: [
                '## li_jie',
                '',
                'name: Li Jie',
                '',
                '- age: seventeen',
            ].join('\n'),
        });
        const notes = notesOf(compile(rawDir));

        expect(notes.storyId).toBe('fixture_story');
        expect(notes.characters).toEqual([
            {
                id: 'li_jie',
                hidden: false,
                name: { zh: '李杰', en: 'Li Jie', ja: '李杰' },
                facts: [
                    {
                        id: 'age',
                        text: { zh: '十七歲', en: 'seventeen', ja: '十七歲' },
                    },
                ],
            },
        ]);
    });

    it('emits one speech meet per character and scene with mirrored labels', () => {
        const rawDir = makeFixture({
            notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
            act1: [
                '```unlock',
                'li_jie.age',
                '```',
                '',
                '**李杰**：我是李杰。',
                '',
                '**李杰**：再說一次。',
                '',
                '**短髮少女**：她說話了。',
            ].join('\n'),
            act2: ['# 第二幕', '', '**李杰**：另一幕。'].join('\n'),
            enAct1: [
                '# Act One',
                '',
                '**Li Jie**: I am Li Jie.',
                '',
                '**Li Jie**: Again.',
                '',
                '**Short-haired girl**: She spoke.',
            ].join('\n'),
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));
        const speech = eventsFor(notes, 'li_jie', 'speech');

        expect(speech).toHaveLength(2);
        expect(speech[0]).toMatchObject({
            sceneId: 'act1',
            entryIndex: 0,
            labels: { zh: '李杰', en: 'Li Jie', ja: '李杰' },
        });
        expect(speech[1]).toMatchObject({
            sceneId: 'act2',
            entryIndex: 0,
            labels: { zh: '李杰', en: '李杰', ja: '李杰' },
        });
        expect(eventsFor(notes, 'narrator')).toEqual([]);
        expect(eventsFor(notes, 'emi')).toEqual([]);
    });

    it('emits a name event only for a canonical zh speaker header, once per scene', () => {
        const rawDir = makeFixture({
            notesZh: ['## li_jie', '', '## emi'].join('\n'),
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));

        expect(eventsFor(notes, 'li_jie', 'name')).toEqual([
            {
                sceneId: 'act1',
                entryIndex: 0,
                characterId: 'li_jie',
                kind: 'name',
            },
        ]);
        expect(eventsFor(notes, 'emi', 'name')).toEqual([]);
        expect(eventsFor(notes, 'emi', 'speech')).toHaveLength(1);
    });

    it('emits explicit met, name and fact markers with met-only known-as labels', () => {
        const rawDir = makeFixture({
            act2: [
                '# 第二幕',
                '',
                '```unlock',
                'ling_mo.met',
                '```',
                '',
                '**旁白**：他出現。',
                '',
                '```unlock',
                'ling_mo.name',
                '```',
                '',
                '**旁白**：名字。',
                '',
                '```unlock',
                'ling_mo.age',
                '```',
                '',
                '**旁白**：更年長。',
            ].join('\n'),
            notesZh: [
                '## ling_mo',
                '',
                'hidden: true',
                '',
                'known-as: 神秘黑衣男',
                '',
                '- age: 不詳',
            ].join('\n'),
            notesEn: [
                '## ling_mo',
                '',
                'known-as: Mysterious Man in Black',
            ].join('\n'),
        });
        const story = compile(rawDir, { writeOutputs: false });
        const notes = notesOf(story);

        expect(notes.characters).toEqual([
            {
                id: 'ling_mo',
                hidden: true,
                name: { zh: '凌墨', en: '凌墨', ja: '凌墨' },
                knownAs: {
                    zh: '神秘黑衣男',
                    en: 'Mysterious Man in Black',
                    ja: '神秘黑衣男',
                },
                facts: [
                    {
                        id: 'age',
                        text: { zh: '不詳', en: '不詳', ja: '不詳' },
                    },
                ],
            },
        ]);
        expect(eventsFor(notes, 'ling_mo', 'met')).toEqual([
            {
                sceneId: 'act2',
                entryIndex: 0,
                characterId: 'ling_mo',
                kind: 'met',
            },
        ]);
        expect(eventsFor(notes, 'ling_mo', 'name')).toHaveLength(1);
        expect(eventsFor(notes, 'ling_mo', 'fact')).toEqual([
            {
                sceneId: 'act2',
                entryIndex: 2,
                characterId: 'ling_mo',
                kind: 'fact',
                factId: 'age',
            },
        ]);
    });

    it('does not strip a punctuation-only speaker label to an empty known-as', () => {
        const rawDir = makeFixture({
            act1: ['# 第一幕', '', '**??**：聲音。'].join('\n'),
            act2: ['# 第二幕', '', '**旁白**：結束。'].join('\n'),
            notesZh: ['## unknown'].join('\n'),
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));

        expect(eventsFor(notes, 'unknown', 'speech')).toEqual([
            {
                sceneId: 'act1',
                entryIndex: 0,
                characterId: 'unknown',
                kind: 'speech',
                labels: { zh: '??', en: '??', ja: '??' },
            },
        ]);
    });

    it('allows a repeated fact unlock on alternative branches', () => {
        const rawDir = makeFixture({
            notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
            branches: {
                a: [
                    '# A',
                    '',
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**旁白**：A。',
                ].join('\n'),
                b: [
                    '# B',
                    '',
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**旁白**：B。',
                ].join('\n'),
            },
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));
        const facts = eventsFor(notes, 'li_jie', 'fact');

        expect(facts).toHaveLength(2);
        expect(facts.map(e => e.sceneId).sort()).toEqual([
            'b1a_act3',
            'b1b_act3',
        ]);
    });

    it('does not require every canonical name to be revealable', () => {
        const rawDir = makeFixture({
            act1: [
                '# 第一幕',
                '',
                '**短髮少女**：她說話了。',
                '',
                '**旁白**：結束。',
            ].join('\n'),
            act2: ['# 第二幕', '', '**旁白**：真的結束。'].join('\n'),
            notesZh: ['## emi'].join('\n'),
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));

        expect(eventsFor(notes, 'emi', 'name')).toEqual([]);
        expect(eventsFor(notes, 'emi', 'speech')).toHaveLength(1);
    });

    it('skips a narrator notes section', () => {
        const rawDir = makeFixture({
            notesZh: [
                '## narrator',
                '',
                '- voice: 低沉',
                '',
                '## li_jie',
                '',
                '- age: 十七歲',
            ].join('\n'),
            act1: [
                '```unlock',
                'li_jie.age',
                '```',
                '',
                '**李杰**：我是李杰。',
            ].join('\n'),
        });
        const notes = notesOf(compile(rawDir, { writeOutputs: false }));

        expect(notes.characters.map(c => c.id)).toEqual(['li_jie']);
    });

    describe('validation', () => {
        it('rejects a character that can never be met on any route', () => {
            const rawDir = makeFixture({
                notesZh: [
                    '## li_jie',
                    '',
                    '- age: 十七歲',
                    '',
                    '## sato_takumi',
                ].join('\n'),
                act1: [
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /character "sato_takumi" can never be met by any speech, \.met, \.name or fact marker/
            );
        });

        it('rejects a fact that is never unlocked', () => {
            const rawDir = makeFixture({
                notesZh: ['## li_jie', '', '- secret: 班長'].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /fact "secret" is never unlocked by an unlock fence/
            );
        });

        it('rejects unknown note characters and invalid unlock targets', () => {
            const unknownNoteChar = makeFixture({
                notesZh: ['## nobody', '', '- age: 1'].join('\n'),
            });
            expect(() =>
                compile(unknownNoteChar, { writeOutputs: false })
            ).toThrow(/unknown character "nobody"/);

            const unknownTarget = makeFixture({
                notesZh: ['## li_jie', '', '- age: 1'].join('\n'),
                act1: [
                    '```unlock',
                    'nobody.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });
            expect(() =>
                compile(unknownTarget, { writeOutputs: false })
            ).toThrow(/unknown character "nobody"/);

            const charWithoutNotes = makeFixture({
                notesZh: ['## li_jie', '', '- age: 1'].join('\n'),
                act1: [
                    '```unlock',
                    'sato_takumi.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });
            expect(() =>
                compile(charWithoutNotes, { writeOutputs: false })
            ).toThrow(/no notes section/);

            const unknownFact = makeFixture({
                notesZh: ['## li_jie', '', '- age: 1'].join('\n'),
                act1: [
                    '```unlock',
                    'li_jie.secret',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });
            expect(() => compile(unknownFact, { writeOutputs: false })).toThrow(
                /fact "secret" which is not defined/
            );
        });

        it('requires an explicit .met marker before authoring known-as', () => {
            const rawDir = makeFixture({
                notesZh: [
                    '## emi',
                    '',
                    'known-as: 文靜少女',
                    '',
                    '- height: 很高',
                ].join('\n'),
                act1: [
                    '# 第一幕',
                    '',
                    '**短髮少女**：她說話了。',
                    '',
                    '```unlock',
                    'emi.height',
                    '```',
                    '',
                    '**旁白**：更高。',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /known-as requires at least one explicit \.met marker/
            );
        });

        it('rejects orphan mirror characters and facts', () => {
            const orphanCharacter = makeFixture({
                notesZh: ['## li_jie', '', '- age: 1'].join('\n'),
                notesEn: ['## emi', '', '- height: 2'].join('\n'),
            });
            expect(() =>
                compile(orphanCharacter, { writeOutputs: false })
            ).toThrow(/notes\/en\.md:1: orphan character "emi"/);

            const orphanFact = makeFixture({
                notesZh: ['## li_jie', '', '- age: 1'].join('\n'),
                notesEn: ['## li_jie', '', '- secret: 2'].join('\n'),
            });
            expect(() => compile(orphanFact, { writeOutputs: false })).toThrow(
                /notes\/en\.md:3: orphan fact "secret" for character "li_jie"/
            );
        });

        it('rejects a mirror known-as label the zh source did not declare', () => {
            const rawDir = makeFixture({
                notesZh: ['## ling_mo', '', '- age: 不詳'].join('\n'),
                notesEn: ['## ling_mo', '', 'known-as: Man in Black'].join(
                    '\n'
                ),
                act2: [
                    '```unlock',
                    'ling_mo.met',
                    '```',
                    '',
                    '**旁白**：他出現。',
                    '',
                    '```unlock',
                    'ling_mo.age',
                    '```',
                    '',
                    '**旁白**：更年長。',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /notes\/en\.md:3: known-as can only be declared in zh\.md/
            );
        });

        it('rejects an unlock fence folded into dialogue instead of publishing the marker', () => {
            const rawDir = makeFixture({
                notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
                act1: [
                    '**李杰**：前一句',
                    '```unlock',
                    'li_jie.age',
                    '```',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /act1\.md: malformed unlock block; expected .*blank-line-separated/
            );
        });

        it('rejects an unlock fence folded into a title', () => {
            const rawDir = makeFixture({
                notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
                act1: [
                    '# 第一幕',
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /act1\.md: malformed unlock block; expected .*blank-line-separated/
            );
        });

        it('rejects an unrecognized adjacent target before it can bypass target validation', () => {
            const rawDir = makeFixture({
                notesZh: ['## li_jie'].join('\n'),
                act1: [
                    '**李杰**：前一句',
                    '```unlock',
                    'nobody.met',
                    '```',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /act1\.md: malformed unlock block; expected .*blank-line-separated/
            );
        });

        it('rejects unlock fences when the story has no notes source', () => {
            const rawDir = makeFixture({
                act1: [
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                ].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /unlock marker "li_jie\.age" in act1\.md .* but the story has no notes\/zh\.md/
            );
        });

        it('rejects mirror notes without a zh source', () => {
            const rawDir = makeFixture({
                notesEn: ['## li_jie', '', '- age: 1'].join('\n'),
            });

            expect(() => compile(rawDir, { writeOutputs: false })).toThrow(
                /notes\/en\.md exists without notes\/zh\.md/
            );
        });
    });

    describe('emitted output', () => {
        it('keeps a fence out of dialogue and leaves generated dialogue, mirrors and flow unchanged', () => {
            const enAct1 = [
                '# Act One',
                '',
                '**Li Jie**: I am Li Jie.',
                '',
                '**Li Jie**: Again.',
                '',
                '**Short-haired girl**: She spoke.',
            ].join('\n');
            const plain = makeFixture({
                notesZh: ['## li_jie'].join('\n'),
                enAct1,
            });
            const fenced = makeFixture({
                notesZh: ['## li_jie'].join('\n'),
                enAct1,
                act1: [
                    '```unlock',
                    'li_jie.met',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                    '',
                    '**李杰**：再說一次。',
                    '',
                    '**短髮少女**：她說話了。',
                ].join('\n'),
            });

            const plainStory = compile(plain, {
                writeOutputs: true,
                outName: 'out-plain',
            });
            const fencedStory = compile(fenced, {
                writeOutputs: true,
                outName: 'out-fenced',
            });

            expect(fencedStory.scenes[0].entries[0].dialogue).toBe(
                '我是李杰。'
            );
            expect(fencedStory.scenes[0].entries).toHaveLength(3);
            expect(fencedStory.mirrors?.en?.[0].entries).toHaveLength(3);

            for (const file of [
                join('scenes', 'act1.ts'),
                join('scenes', 'act2.ts'),
                'dialogue.zh.ts',
                'dialogue.en.ts',
                'flow.ts',
                'characters.ts',
            ]) {
                expect(
                    readFileSync(join(fenced, 'out-fenced', file), 'utf8')
                ).toBe(readFileSync(join(plain, 'out-plain', file), 'utf8'));
            }
            expect(plainStory.scenes[0].entries).toHaveLength(3);
        });

        it('emits compact notes without source paths', () => {
            const rawDir = makeFixture({
                notesZh: ['## li_jie', '', '- age: 十七歲'].join('\n'),
                act1: [
                    '```unlock',
                    'li_jie.age',
                    '```',
                    '',
                    '**李杰**：我是李杰。',
                    '',
                    '**李杰**：再說一次。',
                    '',
                    '**短髮少女**：她說話了。',
                ].join('\n'),
                act2: ['# 第二幕', '', '**李杰**：另一幕。'].join('\n'),
            });
            compile(rawDir, { writeOutputs: true });
            const emitted = readFileSync(
                join(rawDir, 'out', 'notes.ts'),
                'utf8'
            );

            expect(emitted).toContain('export const fixtureStoryNotes');
            expect(emitted).toContain('import type { StoryNotes }');
            expect(emitted).toContain('kind: "speech"');
            expect(emitted).toContain('sceneId: "act1"');
            expect((emitted.match(/kind: "speech"/g) ?? []).length).toBe(2);
            expect(emitted).not.toContain('sourcePath');
            expect(emitted).not.toContain('act1.md');
        });

        it('emits an empty notes payload when the story has no notes source', () => {
            const rawDir = makeFixture();
            const story = compile(rawDir, { writeOutputs: true });

            expect(story.notes).toBeUndefined();
            const emitted = readFileSync(
                join(rawDir, 'out', 'notes.ts'),
                'utf8'
            );
            expect(emitted).toContain('export const fixtureStoryNotes');
            expect(emitted).toContain('characters: []');
            expect(emitted).toContain('events: []');
        });
    });
});
