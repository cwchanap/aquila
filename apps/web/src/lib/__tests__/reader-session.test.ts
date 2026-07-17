import { describe, it, expect } from 'vitest';
import type { DialogueEntry, Locale } from '@aquila/stories';
import type { FlowConfig } from '@aquila/stories';
import {
    validateSessionState,
    resolveInitialState,
    parseDialogueParam,
    serializeSessionParams,
    migratePersisted,
    STORAGE_VERSION,
    type ResolveDeps,
} from '../reader-session';

const flow: FlowConfig = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
    ],
};
const dialogue: Record<string, DialogueEntry[]> = {
    act1: [{ dialogue: 'a' }, { dialogue: 'b' }, { dialogue: 'c' }],
    act2: [{ dialogue: 'x' }],
};
const emptySceneDialogue: Record<string, DialogueEntry[]> = { act3: [] };

const deps: ResolveDeps = {
    flow: sid => (sid === 'train_adventure' ? flow : undefined),
    dialogue: (sid, sceneId) =>
        sid === 'train_adventure'
            ? (dialogue[sceneId] ?? emptySceneDialogue[sceneId] ?? [])
            : [],
    defaultStoryId: 'train_adventure',
};

describe('STORAGE_VERSION', () => {
    it('is 2', () => {
        expect(STORAGE_VERSION).toBe(2);
    });
});

describe('parseDialogueParam', () => {
    it('returns N-1 for N>=1', () => {
        expect(parseDialogueParam('1')).toBe(0);
        expect(parseDialogueParam('3')).toBe(2);
    });
    it('returns null (absent) for 0, negative, NaN, null', () => {
        expect(parseDialogueParam('0')).toBeNull();
        expect(parseDialogueParam('-1')).toBeNull();
        expect(parseDialogueParam('abc')).toBeNull();
        expect(parseDialogueParam(null)).toBeNull();
    });
});

describe('validateSessionState', () => {
    const base = {
        storyId: 'train_adventure',
        sceneId: 'act1',
        dialogueIndex: 1,
        locale: 'en' as Locale,
    };
    it('clamps a non-negative index into bounds', () => {
        expect(
            validateSessionState(
                { ...base, dialogueIndex: 99 },
                flow,
                dialogue.act1
            )?.dialogueIndex
        ).toBe(2);
    });
    it('keeps an in-bounds index', () => {
        expect(
            validateSessionState(base, flow, dialogue.act1)?.dialogueIndex
        ).toBe(1);
    });
    it('empty dialogue -> index 0 valid', () => {
        expect(
            validateSessionState(
                { ...base, dialogueId: undefined, dialogueIndex: 0 },
                flow,
                []
            )?.dialogueIndex
        ).toBe(0);
    });
    it('returns null for negative or NaN index', () => {
        expect(
            validateSessionState(
                { ...base, dialogueIndex: -1 },
                flow,
                dialogue.act1
            )
        ).toBeNull();
        expect(
            validateSessionState(
                { ...base, dialogueIndex: NaN },
                flow,
                dialogue.act1
            )
        ).toBeNull();
    });
    it('returns null for unknown scene', () => {
        expect(
            validateSessionState({ ...base, sceneId: 'nope' }, flow, [])
        ).toBeNull();
    });
    it('returns null for non-object', () => {
        expect(validateSessionState(null, flow, [])).toBeNull();
        expect(validateSessionState('x', flow, [])).toBeNull();
    });
});

describe('resolveInitialState', () => {
    it('URL with valid story wins fully (story-only -> story start)', () => {
        const p = new URLSearchParams('story=train_adventure');
        const r = resolveInitialState(p, null, 'en', deps);
        expect(r).toEqual({
            storyId: 'train_adventure',
            sceneId: 'act1',
            dialogueIndex: 0,
            locale: 'en',
        });
    });
    it('story+scene URL -> that scene, index 0', () => {
        const r = resolveInitialState(
            new URLSearchParams('story=train_adventure&scene=act2'),
            null,
            'en',
            deps
        );
        expect(r.sceneId).toBe('act2');
        expect(r.dialogueIndex).toBe(0);
    });
    it('dialogue=N -> N-1 clamped', () => {
        const r = resolveInitialState(
            new URLSearchParams('story=train_adventure&scene=act1&dialogue=99'),
            null,
            'en',
            deps
        );
        expect(r.dialogueIndex).toBe(2);
    });
    it('dialogue=0 -> absent -> index 0 (no contract break)', () => {
        const r = resolveInitialState(
            new URLSearchParams('story=train_adventure&scene=act1&dialogue=0'),
            null,
            'en',
            deps
        );
        expect(r.dialogueIndex).toBe(0);
    });
    it('same-story card link does NOT resume persisted scene of same story', () => {
        const persisted = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'en',
            version: 2,
        };
        const r = resolveInitialState(
            new URLSearchParams('story=train_adventure'),
            persisted,
            'en',
            deps
        );
        expect(r.sceneId).toBe('act1'); // story start, not persisted act2
    });
    it('invalid story falls through to persisted', () => {
        const persisted = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'en',
            version: 2,
        };
        const r = resolveInitialState(
            new URLSearchParams('story=bogus'),
            persisted,
            'en',
            deps
        );
        expect(r.sceneId).toBe('act2');
    });
    it('no URL -> persisted', () => {
        const persisted = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'en',
            version: 2,
        };
        const r = resolveInitialState(
            new URLSearchParams(''),
            persisted,
            'en',
            deps
        );
        expect(r.sceneId).toBe('act2');
    });
    it('no URL, no persisted -> default story start', () => {
        const r = resolveInitialState(
            new URLSearchParams(''),
            null,
            'en',
            deps
        );
        expect(r).toEqual({
            storyId: 'train_adventure',
            sceneId: 'act1',
            dialogueIndex: 0,
            locale: 'en',
        });
    });
    it('persisted with wrong locale is ignored', () => {
        const persisted = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'zh',
            version: 2,
        };
        const r = resolveInitialState(
            new URLSearchParams(''),
            persisted,
            'en',
            deps
        );
        expect(r.sceneId).toBe('act1');
    });
});

describe('serializeSessionParams', () => {
    it('produces story/scene/dialogue=N', () => {
        const s = serializeSessionParams({
            storyId: 'train_adventure',
            sceneId: 'act1',
            dialogueIndex: 2,
            locale: 'en',
        });
        expect(s.get('story')).toBe('train_adventure');
        expect(s.get('scene')).toBe('act1');
        expect(s.get('dialogue')).toBe('3');
    });
});

describe('migratePersisted', () => {
    it('passes through valid v2', () => {
        const v2 = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 1,
            locale: 'en',
            version: 2,
        };
        expect(migratePersisted(v2, 'en')).toEqual(v2);
    });
    it('upgrades v1 (no dialogueIndex) to v2 with index 0', () => {
        const v1 = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
        };
        expect(migratePersisted(v1, 'en')).toEqual({
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'en',
            version: 2,
        });
    });
    it('returns null for garbage', () => {
        expect(migratePersisted('nope', 'en')).toBeNull();
        expect(migratePersisted(null, 'en')).toBeNull();
    });
    it('returns null for wrong locale', () => {
        const v2 = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 0,
            locale: 'zh',
            version: 2,
        };
        expect(migratePersisted(v2, 'en')).toBeNull();
    });
});
