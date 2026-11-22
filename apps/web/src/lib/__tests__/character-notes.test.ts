import { describe, expect, it } from 'vitest';
import type {
    Locale,
    StoryFlowConfig,
    StoryNoteCharacter,
    StoryNoteEvent,
    StoryNotes,
    StoryNoteText,
    Translations,
} from '@aquila/stories';
import type { StoryProgress } from '../story-progress-store';
import {
    selectCharacterNotes,
    type CharacterNotesLivePosition,
} from '../character-notes';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        actRangeLabel: 'Acts {first}–{last}',
    },
} as unknown as Translations;

const flow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: 'choice:c1' },
        {
            kind: 'choice',
            id: 'choice:c1',
            choiceId: 'c1',
            nextByOption: { b1: 'b1_act3', b2: 'b2_act3' },
        },
        {
            kind: 'scene',
            id: 'b1_act3',
            sceneId: 'b1_act3',
            next: 'b1_actFinal',
        },
        {
            kind: 'scene',
            id: 'b1_actFinal',
            sceneId: 'b1_actFinal',
            next: null,
        },
        {
            kind: 'scene',
            id: 'b2_act3',
            sceneId: 'b2_act3',
            next: 'b2_actFinal',
        },
        {
            kind: 'scene',
            id: 'b2_actFinal',
            sceneId: 'b2_actFinal',
            next: null,
        },
    ],
} as unknown as StoryFlowConfig;

const text = (zh: string, en: string, ja: string): StoryNoteText => ({
    zh,
    en,
    ja,
});

const liJie: StoryNoteCharacter = {
    id: 'li_jie',
    hidden: false,
    name: text('李杰', 'Li Jie', '李傑'),
    facts: [
        { id: 'age', text: text('十七歲', 'Seventeen', '十七歳') },
        { id: 'secret', text: text('班長', 'Class president', '委員長') },
    ],
};

const emi: StoryNoteCharacter = {
    id: 'emi',
    hidden: false,
    name: text('艾米', 'Emi', 'エミ'),
    knownAs: text('文靜少女', 'Quiet Girl', '物静かな少女'),
    facts: [{ id: 'hair', text: text('短髮', 'Short hair', '短い髪') }],
};

const lingMo: StoryNoteCharacter = {
    id: 'ling_mo',
    hidden: true,
    name: text('凌墨', 'Ling Mo', '凌墨'),
    knownAs: text('神秘黑衣男', 'Mysterious Man in Black', '黒衣の謎の男'),
    facts: [],
};

const student: StoryNoteCharacter = {
    id: 'student',
    hidden: false,
    name: text('真實名字', 'Real Name', '本名'),
    facts: [{ id: 'seat', text: text('靠窗', 'Window seat', '窓際') }],
};

function notes(
    characters: StoryNoteCharacter[],
    events: StoryNoteEvent[]
): StoryNotes {
    return { storyId: 'fixture', characters, events };
}

function speech(
    characterId: string,
    sceneId: string,
    entryIndex: number,
    labels: [string, string, string]
): StoryNoteEvent {
    return {
        sceneId,
        entryIndex,
        characterId,
        kind: 'speech',
        labels: text(...labels),
    };
}

function met(
    characterId: string,
    sceneId: string,
    entryIndex: number
): StoryNoteEvent {
    return { sceneId, entryIndex, characterId, kind: 'met' };
}

function name(
    characterId: string,
    sceneId: string,
    entryIndex: number
): StoryNoteEvent {
    return { sceneId, entryIndex, characterId, kind: 'name' };
}

function fact(
    characterId: string,
    sceneId: string,
    entryIndex: number,
    factId: string
): StoryNoteEvent {
    return { sceneId, entryIndex, characterId, kind: 'fact', factId };
}

function progress(overrides: Partial<StoryProgress> = {}): StoryProgress {
    return {
        sceneId: 'act1',
        dialogueIndex: 0,
        updatedAt: 0,
        finished: false,
        endings: [],
        ...overrides,
    };
}

function select(
    story: StoryNotes,
    saved: StoryProgress,
    locale: Locale = 'en',
    live?: CharacterNotesLivePosition
) {
    return selectCharacterNotes({
        notes: story,
        flow,
        progress: saved,
        live,
        locale,
        t,
    });
}

function character(view: ReturnType<typeof select>, id: string) {
    const found = view.characters.find(c => c.id === id);
    if (!found) throw new Error(`character ${id} missing from view`);
    return found;
}

describe('selectCharacterNotes', () => {
    it('unlocks markers only up to the current dialogue line', () => {
        const story = notes(
            [liJie, emi],
            [
                speech('li_jie', 'act1', 0, ['李杰', 'Li Jie', '李傑']),
                name('li_jie', 'act1', 0),
                met('emi', 'act1', 1),
                fact('li_jie', 'act1', 2, 'age'),
                fact('li_jie', 'act1', 3, 'secret'),
            ]
        );

        const line0 = select(story, progress({ dialogueIndex: 0 }));
        expect(character(line0, 'li_jie')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Li Jie',
            facts: [],
            factCount: 2,
        });
        expect(character(line0, 'emi')).toMatchObject({
            met: false,
            nameKnown: false,
            label: null,
            facts: [],
        });
        expect(line0.metCount).toBe(1);

        const line2 = select(story, progress({ dialogueIndex: 2 }));
        expect(character(line2, 'emi')).toMatchObject({
            met: true,
            nameKnown: false,
            label: 'Quiet Girl',
        });
        expect(character(line2, 'li_jie').facts).toEqual([
            { id: 'age', text: 'Seventeen', act: 'Act 1' },
        ]);
        expect(line2.metCount).toBe(2);

        const line3 = select(story, progress({ dialogueIndex: 3 }));
        expect(character(line3, 'li_jie').facts.map(f => f.id)).toEqual([
            'age',
            'secret',
        ]);
    });

    it('keeps an unfinished non-active Act 3 locked after jumping back to Act 1', () => {
        const story = notes(
            [student, liJie],
            [
                speech('student', 'b1_act3', 0, [
                    '短髮少女',
                    'Short-haired girl',
                    '短髪の少女',
                ]),
                name('student', 'b1_act3', 1),
                fact('student', 'b1_act3', 1, 'seat'),
                speech('li_jie', 'act1', 0, ['李杰', 'Li Jie', '李傑']),
                name('li_jie', 'act1', 0),
                fact('li_jie', 'act1', 4, 'age'),
            ]
        );

        const view = select(
            story,
            progress({
                sceneId: 'act1',
                dialogueIndex: 0,
                visited: ['act1', 'act2', 'b1_act3'],
            })
        );

        expect(character(view, 'student')).toMatchObject({
            met: false,
            nameKnown: false,
            label: null,
            facts: [],
            factCount: 1,
        });
        expect(character(view, 'li_jie')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Li Jie',
        });
        expect(character(view, 'li_jie').facts.map(f => f.id)).toEqual(['age']);
        expect(view.metCount).toBe(1);
    });

    it('keeps a synced union of unfinished devices conservative', () => {
        const story = notes(
            [student],
            [
                speech('student', 'b1_act3', 0, [
                    '短髮少女',
                    'Short-haired girl',
                    '短髪の少女',
                ]),
                fact('student', 'b1_act3', 1, 'seat'),
                speech('student', 'b2_act3', 0, [
                    '眼鏡女',
                    'Glasses girl',
                    '眼鏡の少女',
                ]),
            ]
        );

        const view = select(
            story,
            progress({
                sceneId: 'act1',
                dialogueIndex: 0,
                visited: ['act1', 'b1_act3', 'b2_act3'],
            })
        );
        expect(character(view, 'student')).toMatchObject({
            met: false,
            label: null,
            facts: [],
        });
        expect(view.metCount).toBe(0);
    });

    it('passes a recorded ending chain without a visited ledger', () => {
        const story = notes(
            [student],
            [
                speech('student', 'b2_act3', 0, [
                    '眼鏡女',
                    'Glasses girl',
                    '眼鏡の少女',
                ]),
                name('student', 'b2_act3', 9),
            ]
        );

        const view = select(
            story,
            progress({
                sceneId: 'act1',
                dialogueIndex: 0,
                endings: ['b2_actFinal'],
                visited: undefined,
            })
        );
        expect(character(view, 'student')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Real Name',
        });
    });

    it('falls back to the saved scene when the visited ledger is trimmed', () => {
        const story = notes(
            [liJie],
            [
                speech('li_jie', 'act1', 0, ['李杰', 'Li Jie', '李傑']),
                name('li_jie', 'act1', 0),
                fact('li_jie', 'act1', 5, 'age'),
                fact('li_jie', 'act2', 2, 'secret'),
            ]
        );

        const before = select(
            story,
            progress({
                sceneId: 'act2',
                dialogueIndex: 1,
                visited: undefined,
            })
        );
        expect(character(before, 'li_jie')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Li Jie',
        });
        expect(character(before, 'li_jie').facts.map(f => f.id)).toEqual([
            'age',
        ]);

        const atBoundary = select(
            story,
            progress({
                sceneId: 'act2',
                dialogueIndex: 2,
                visited: undefined,
            })
        );
        expect(character(atBoundary, 'li_jie').facts.map(f => f.id)).toEqual([
            'age',
            'secret',
        ]);
    });

    it('keeps hidden characters absent until a reached marker meets them', () => {
        const story = notes(
            [lingMo],
            [met('ling_mo', 'act2', 1), name('ling_mo', 'act2', 2)]
        );

        expect(
            select(story, progress({ dialogueIndex: 0 })).characters
        ).toEqual([]);
        expect(
            select(story, progress({ sceneId: 'act2', dialogueIndex: 0 }))
                .characters
        ).toEqual([]);

        const revealed = select(
            story,
            progress({ sceneId: 'act2', dialogueIndex: 1 }),
            'ja'
        );
        expect(revealed.characters).toEqual([
            {
                id: 'ling_mo',
                hidden: true,
                met: true,
                nameKnown: false,
                label: '黒衣の謎の男',
                facts: [],
                factCount: 0,
            },
        ]);
        expect(revealed.metCount).toBe(1);

        const named = select(
            story,
            progress({ sceneId: 'act2', dialogueIndex: 2 })
        );
        expect(character(named, 'ling_mo')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Ling Mo',
        });

        const live = select(
            story,
            progress({ sceneId: 'act1', dialogueIndex: 0 }),
            'en',
            { sceneId: 'act2', dialogueIndex: 1 }
        );
        expect(character(live, 'ling_mo').met).toBe(true);
    });

    it('meets a character through a reached fact or name marker', () => {
        const factOnly = notes([emi], [fact('emi', 'act1', 0, 'hair')]);
        expect(character(select(factOnly, progress()), 'emi')).toMatchObject({
            met: true,
            nameKnown: false,
            label: 'Quiet Girl',
            facts: [{ id: 'hair', text: 'Short hair', act: 'Act 1' }],
        });

        const nameOnly = notes([emi], [name('emi', 'act1', 0)]);
        expect(character(select(nameOnly, progress()), 'emi')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Emi',
            facts: [],
        });
    });

    it('collects a fact unlocked on any completed route exactly once', () => {
        const story = notes(
            [emi],
            [
                fact('emi', 'b1_act3', 0, 'hair'),
                fact('emi', 'b2_act3', 1, 'hair'),
                name('emi', 'b2_act3', 0),
            ]
        );

        const oneRoute = select(story, progress({ endings: ['b1_actFinal'] }));
        expect(character(oneRoute, 'emi')).toMatchObject({
            met: true,
            nameKnown: false,
            label: 'Quiet Girl',
            facts: [{ id: 'hair', text: 'Short hair', act: 'Act 3' }],
        });

        const bothRoutes = select(
            story,
            progress({ endings: ['b1_actFinal', 'b2_actFinal'] })
        );
        expect(character(bothRoutes, 'emi')).toMatchObject({
            met: true,
            nameKnown: true,
            label: 'Emi',
        });
        expect(character(bothRoutes, 'emi').facts).toHaveLength(1);
    });

    it('selects the shallowest reached speech label (BFS depth first)', () => {
        const story = notes(
            [student],
            [
                speech('student', 'act1', 5, ['甲', 'Shallow', '甲']),
                speech('student', 'b1_act3', 0, ['乙', 'Deep', '乙']),
            ]
        );

        const view = select(
            story,
            progress({
                sceneId: 'b1_act3',
                dialogueIndex: 0,
                endings: ['b1_actFinal'],
            })
        );
        expect(character(view, 'student')).toMatchObject({
            met: true,
            nameKnown: false,
            label: 'Shallow',
        });
    });

    it('prefers a current-route scene on a depth tie', () => {
        const story = notes(
            [student],
            [
                speech('student', 'b1_act3', 0, ['甲', 'B1 label', '甲']),
                speech('student', 'b2_act3', 0, ['乙', 'B2 label', '乙']),
            ]
        );

        const view = select(
            story,
            progress({
                sceneId: 'b2_act3',
                dialogueIndex: 0,
                endings: ['b1_actFinal'],
            })
        );
        expect(character(view, 'student').label).toBe('B2 label');
    });

    it('uses the lower entry index before the lexical scene tie-break', () => {
        const story = notes(
            [student],
            [
                speech('student', 'b1_act3', 5, ['甲', 'B1 label', '甲']),
                speech('student', 'b2_act3', 2, ['乙', 'B2 label', '乙']),
            ]
        );

        const view = select(
            story,
            progress({ endings: ['b1_actFinal', 'b2_actFinal'] })
        );
        expect(character(view, 'student').label).toBe('B2 label');
    });

    it('falls back to the lexical scene id as the final tie-break', () => {
        const story = notes(
            [student],
            [
                speech('student', 'b2_act3', 0, ['乙', 'B2 label', '乙']),
                speech('student', 'b1_act3', 0, ['甲', 'B1 label', '甲']),
            ]
        );

        const view = select(
            story,
            progress({ endings: ['b1_actFinal', 'b2_actFinal'] })
        );
        expect(character(view, 'student').label).toBe('B1 label');
    });

    it('keeps a speaking character descriptive until a name is reached', () => {
        const story = notes(
            [student],
            [
                speech('student', 'act2', 0, [
                    '短髮少女',
                    'Short-haired girl',
                    '短髪の少女',
                ]),
            ]
        );

        const view = select(
            story,
            progress({ sceneId: 'act2', dialogueIndex: 0 })
        );
        expect(character(view, 'student')).toMatchObject({
            met: true,
            nameKnown: false,
            label: 'Short-haired girl',
        });
    });

    it('localizes the revealed name, fact text and act provenance', () => {
        const story = notes(
            [liJie],
            [
                speech('li_jie', 'act1', 0, ['李杰', 'Li Jie', '李傑']),
                name('li_jie', 'act1', 0),
                fact('li_jie', 'b1_act3', 1, 'age'),
            ]
        );

        const view = select(
            story,
            progress({ endings: ['b1_actFinal'] }),
            'ja'
        );
        expect(character(view, 'li_jie')).toMatchObject({
            label: '李傑',
            facts: [{ id: 'age', text: '十七歳', act: 'Act 3' }],
        });
    });

    it('counts only visible met characters', () => {
        const story = notes(
            [emi, lingMo],
            [met('emi', 'act1', 0), met('ling_mo', 'act2', 0)]
        );

        const early = select(story, progress({ dialogueIndex: 0 }));
        expect(early.characters.map(c => c.id)).toEqual(['emi']);
        expect(early.metCount).toBe(1);

        const later = select(
            story,
            progress({ sceneId: 'act2', dialogueIndex: 0 })
        );
        expect(later.characters.map(c => c.id)).toEqual(['emi', 'ling_mo']);
        expect(later.metCount).toBe(2);
    });

    it('locks every character when no position or ending is known', () => {
        const story = notes(
            [liJie, emi],
            [
                speech('li_jie', 'act1', 0, ['李杰', 'Li Jie', '李傑']),
                met('emi', 'act1', 0),
            ]
        );

        const view = selectCharacterNotes({
            notes: story,
            flow,
            progress: null,
            locale: 'en',
            t,
        });
        expect(view.metCount).toBe(0);
        expect(view.characters).toEqual([
            {
                id: 'li_jie',
                hidden: false,
                met: false,
                nameKnown: false,
                label: null,
                facts: [],
                factCount: 2,
            },
            {
                id: 'emi',
                hidden: false,
                met: false,
                nameKnown: false,
                label: null,
                facts: [],
                factCount: 1,
            },
        ]);
    });
});
