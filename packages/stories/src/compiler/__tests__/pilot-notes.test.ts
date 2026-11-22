import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compileNamedStory } from '../compile-named-story';
import { buildResolveCharacter } from '../resolve-character';
import { parseCharacters } from '../parse-characters';
import { parseScene } from '../parse-scene';
import { scanStory } from '../scan-story';
import { buildStoryGraph } from '../build-graph';
import type { StoryIR } from '../ir';
import type { StoryNotes, StoryNoteEvent } from '../../notes-types';
import config from '../../../raw/trainAdventure/compiler.config';

const rawDir = resolve(__dirname, '../../../raw/trainAdventure');
const PILOT_SCENES = ['act1', 'act2', 'act3'];
const STUDENTS = [
    'tanaka_kenta',
    'suzuki_asuka',
    'sato_takumi',
    'takahashi_misaki',
    'saito_ren',
];
const SILENT = ['shimizu_emi', 'ling_mo', 'kobayashi_yudai', 'kobayashi_hina'];

function eventsFor(
    notes: StoryNotes,
    characterId: string,
    kind?: StoryNoteEvent['kind']
): StoryNoteEvent[] {
    return notes.events.filter(
        e =>
            e.characterId === characterId &&
            (kind === undefined || e.kind === kind)
    );
}

function inPilot(event: StoryNoteEvent): boolean {
    return PILOT_SCENES.includes(event.sceneId);
}

/** Compiler-only marker metadata never reaches dialogue or emitted scenes. */
function runtimeEntries(entries: ReturnType<typeof parseScene>['entries']) {
    return entries.map(entry => {
        const copy = { ...entry };
        delete copy.unlocks;
        return copy;
    });
}

/** Drop standalone unlock fences the same way parseScene splits blocks. */
function withoutUnlockBlocks(markdown: string): string {
    return markdown
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(block => !/^```unlock[ \t]*\n[\s\S]*?\n```$/.test(block))
        .filter(Boolean)
        .join('\n\n');
}

let story: StoryIR;
let notes: StoryNotes;

beforeAll(async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    story = await compileNamedStory('trainAdventure', false);
    if (!story.notes) throw new Error('expected compiled pilot notes');
    notes = story.notes;
}, 60_000);

afterAll(() => {
    vi.restoreAllMocks();
});

describe('trainAdventure pilot notes (Acts 1-3)', () => {
    it('names Li Jie from his first canonical Act 1 speech without a .name marker', () => {
        const names = eventsFor(notes, 'li_jie', 'name');
        const firstSpeech = eventsFor(notes, 'li_jie', 'speech').filter(
            inPilot
        )[0];
        const pilotMarkdown = PILOT_SCENES.map(name =>
            readFileSync(join(rawDir, `${name}.md`), 'utf8')
        ).join('\n');

        expect(firstSpeech).toMatchObject({
            sceneId: 'act1',
            entryIndex: 4,
        });
        expect(names[0]).toEqual({
            sceneId: 'act1',
            entryIndex: 4,
            characterId: 'li_jie',
            kind: 'name',
        });
        expect(pilotMarkdown).not.toMatch(/```unlock\n[^\n]+\.name\n```/);
        expect(notes.characters.find(c => c.id === 'li_jie')?.name).toEqual({
            zh: '李杰',
            en: 'Li Jie',
            ja: 'リー・ジエ',
        });
    });

    it('keeps the four students under their descriptive labels through Act 3', () => {
        const expected = [
            [
                'tanaka_kenta',
                8,
                '健談男大生',
                'Loudmouth Student',
                'おしゃべりな男子大学生',
            ],
            [
                'suzuki_asuka',
                10,
                '活潑女大生',
                'Bubbly Student',
                '元気な女子大生',
            ],
            [
                'takahashi_misaki',
                11,
                '多話女大生',
                'Chatterbox Student',
                '話好きな女子大生',
            ],
            [
                'sato_takumi',
                14,
                '沉穩男大生',
                'Steady Student',
                '落ち着いた男子大学生',
            ],
            [
                'saito_ren',
                19,
                '膽小眼鏡男',
                'Timid Guy in Glasses',
                '気弱な眼鏡の青年',
            ],
        ] as const;

        for (const [id, entryIndex, zh, en, ja] of expected) {
            const speech = eventsFor(notes, id, 'speech').find(
                e => e.sceneId === 'act1' && e.entryIndex === entryIndex
            );
            expect(speech?.labels).toEqual({ zh, en, ja });
            expect(eventsFor(notes, id, 'name').filter(inPilot)).toEqual([]);
        }

        for (const id of STUDENTS) {
            const character = notes.characters.find(c => c.id === id)!;
            expect(character.knownAs).toBeUndefined();
            expect(character.name.zh).not.toBe('');
            expect(
                eventsFor(notes, id, 'speech')
                    .filter(inPilot)
                    .map(e => e.labels?.zh)
            ).not.toContain(character.name.zh);
        }
    });

    it('introduces Emi, Ling Mo, Yudai and Hina before they speak, with localized known-as only', () => {
        const expected = [
            [
                'shimizu_emi',
                'act1',
                36,
                '文靜少女',
                'Quiet Girl',
                '物静かな少女',
            ],
            [
                'ling_mo',
                'act1',
                41,
                '神秘黑衣男',
                'Mysterious Man in Black',
                '黒衣の謎の男',
            ],
            [
                'kobayashi_yudai',
                'act2',
                39,
                '沉穩父親',
                'Steady Father',
                '落ち着いた父親',
            ],
            [
                'kobayashi_hina',
                'act2',
                39,
                '懂事姐姐',
                'Sensible Big Sister',
                'しっかり者の姉',
            ],
        ] as const;

        for (const [id, sceneId, entryIndex, zh, en, ja] of expected) {
            expect(eventsFor(notes, id, 'met')).toContainEqual({
                sceneId,
                entryIndex,
                characterId: id,
                kind: 'met',
            });
            expect(notes.characters.find(c => c.id === id)?.knownAs).toEqual({
                zh,
                en,
                ja,
            });
        }
    });

    it('does not reveal the silent four or the students before Act 3 ends', () => {
        for (const id of [...SILENT, ...STUDENTS]) {
            const pilotEvents = notes.events.filter(
                e => e.characterId === id && inPilot(e)
            );
            expect(pilotEvents.length).toBeGreaterThan(0);
            expect(pilotEvents.filter(e => e.kind === 'name')).toEqual([]);
            if (SILENT.includes(id)) {
                expect(pilotEvents.filter(e => e.kind === 'speech')).toEqual(
                    []
                );
            }
        }

        for (const id of SILENT) {
            const character = notes.characters.find(c => c.id === id)!;
            expect(character.knownAs).toBeDefined();
            expect(Object.values(character.knownAs!)).not.toContain(
                character.name.zh
            );
            expect(Object.values(character.knownAs!)).not.toContain(
                character.name.en
            );
            expect(Object.values(character.knownAs!)).not.toContain(
                character.name.ja
            );
        }
    });

    it('authors facts only for Acts 1-3 and unlocks every one of them', () => {
        expect(notes.characters.map(c => c.id).sort()).toEqual(
            [
                'ito_makoto',
                'ito_nana',
                'kobayashi_hina',
                'kobayashi_shota',
                'kobayashi_tomoko',
                'kobayashi_yudai',
                'li_jie',
                'ling_mo',
                'nakamura_hayato',
                'saito_ren',
                'sato_takumi',
                'shimizu_emi',
                'suzuki_asuka',
                'takahashi_misaki',
                'tanaka_kenta',
                'yamamoto_koji',
            ].sort()
        );

        const factEvents = notes.events.filter(e => e.kind === 'fact');
        expect(factEvents.length).toBeGreaterThan(0);
        expect(factEvents.every(inPilot)).toBe(true);

        for (const character of notes.characters) {
            const unlocked = new Set(
                eventsFor(notes, character.id, 'fact').map(e => e.factId)
            );
            expect([...unlocked].sort()).toEqual(
                character.facts.map(f => f.id).sort()
            );
        }

        expect(notes.events.some(e => 'sourcePath' in e)).toBe(false);
        expect(notes.events.every(e => inPilot(e) || e.kind !== 'fact')).toBe(
            true
        );
    });

    it('leaves dialogue indices, cues, mirrors and the graph untouched', () => {
        const charDir = parseCharacters(
            readFileSync(join(rawDir, 'docs/characters.md'), 'utf8')
        );
        const resolveCharacter = buildResolveCharacter(charDir, config);
        const defaultSpeaker = (() => {
            const info = charDir.getById(config.defaultSpeakerId!);
            if (!info) throw new Error('missing narrator');
            return { id: info.id, displayName: info.name };
        })();
        const graph = buildStoryGraph(scanStory(rawDir));

        expect(graph.start).toBe('act1');
        expect(graph.scenes).toHaveLength(495);
        expect(graph.choices).toHaveLength(30);

        for (const scene of graph.scenes) {
            const markdown = readFileSync(
                join(rawDir, scene.sourcePath),
                'utf8'
            );
            const withFences = parseScene(
                markdown,
                resolveCharacter,
                scene.sourcePath,
                defaultSpeaker
            );
            const withoutFences = parseScene(
                withoutUnlockBlocks(markdown),
                resolveCharacter,
                scene.sourcePath,
                defaultSpeaker
            );
            expect(withFences.title).toEqual(withoutFences.title);
            expect(runtimeEntries(withFences.entries)).toEqual(
                runtimeEntries(withoutFences.entries)
            );
            expect(withFences.title).not.toContain('unlock');
            for (const entry of withFences.entries) {
                expect(entry.dialogue).not.toContain('```unlock');
            }
        }

        const entries = (id: string) =>
            story.scenes.find(s => s.id === id)!.entries.length;
        expect(entries('act1')).toBe(60);
        expect(entries('act2')).toBe(69);
        expect(entries('act3')).toBe(47);

        for (const locale of ['en', 'ja'] as const) {
            const mirror = story.mirrors?.[locale] ?? [];
            for (const id of PILOT_SCENES) {
                expect(mirror.find(s => s.id === id)!.entries).toHaveLength(
                    entries(id)
                );
            }
        }
    });
});
