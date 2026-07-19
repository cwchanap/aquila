import { describe, it, expect } from 'vitest';
import type { DialogueEntry, Locale } from '@aquila/stories';
import type { FlowConfig } from '@aquila/stories';
import {
    validateSessionState,
    resolveInitialState,
    parseDialogueParam,
    serializeSessionParams,
    migratePersisted,
    clampIndex,
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

describe('clampIndex', () => {
    it('clamps into [0, length-1]', () => {
        expect(clampIndex(0, 3)).toBe(0);
        expect(clampIndex(2, 3)).toBe(2);
        expect(clampIndex(99, 3)).toBe(2);
        expect(clampIndex(-5, 3)).toBe(0);
    });
    it('empty dialogue -> 0 (never negative)', () => {
        expect(clampIndex(5, 0)).toBe(0);
        expect(clampIndex(-1, 0)).toBe(0);
    });
    it('truncates fractional indices', () => {
        expect(clampIndex(1.9, 3)).toBe(1);
    });
    it('returns 0 for NaN (never produces NaN)', () => {
        // Regression guard: Math.trunc/Math.max/Math.min all return NaN for a
        // NaN input, so without an explicit guard clampIndex(NaN, n) would
        // return NaN — violating the documented invariant and propagating
        // `dialogue=NaN` to the URL and persisted state. Default NaN to 0.
        expect(clampIndex(NaN, 3)).toBe(0);
        expect(clampIndex(NaN, 0)).toBe(0);
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
    it('returns null for partially numeric values (no silent coercion)', () => {
        expect(parseDialogueParam('2junk')).toBeNull();
        expect(parseDialogueParam('1.5')).toBeNull();
        expect(parseDialogueParam(' 3')).toBeNull();
        expect(parseDialogueParam('3 ')).toBeNull();
        expect(parseDialogueParam('+2')).toBeNull();
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
    it('preserves a negative dialogueIndex so validateSessionState can reject it', () => {
        // Regression: Math.max(0, ...) previously coerced -1 to 0, bypassing
        // the validator's "negative = invalid" contract and accepting a
        // malformed record that should fall through to the default session.
        const corrupted = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: -1,
            locale: 'en',
            version: 2,
        };
        const migrated = migratePersisted(corrupted, 'en');
        expect(migrated).not.toBeNull();
        expect(migrated?.dialogueIndex).toBe(-1);
        // The full Tier-2 path must reject the malformed record and fall
        // through to the default session, not restore scene act2.
        const params = new URLSearchParams(); // no URL story -> Tier 2
        const state = resolveInitialState(params, migrated, 'en', {
            flow: () => ({
                start: 'act1',
                nodes: [
                    { kind: 'scene', id: 'act1', sceneId: 'act1', next: null },
                    { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
                ],
            }),
            dialogue: () => [],
            defaultStoryId: 'train_adventure',
        });
        expect(state.sceneId).toBe('act1');
        expect(state.dialogueIndex).toBe(0);
    });
    it('rejects a v2-shaped record with a non-number dialogueIndex (null/string/boolean)', () => {
        // Regression guard: a v2-shaped record carrying a non-number
        // dialogueIndex is corrupted, not legacy. Coercing it to 0 would make
        // the record look valid and restore its scene, bypassing the
        // validator's "non-number = invalid" contract. Only a MISSING
        // dialogueIndex (the legacy v1 case) defaults to 0; everything else
        // is rejected by migratePersisted so the full Tier-2 path falls
        // through to the default session.
        const base = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
            version: 2,
        };
        for (const bad of [null, 'bad', true, false, {}]) {
            const corrupted = { ...base, dialogueIndex: bad };
            expect(migratePersisted(corrupted, 'en')).toBeNull();
        }
        // NaN is a number type but still invalid -> reject.
        expect(
            migratePersisted({ ...base, dialogueIndex: NaN }, 'en')
        ).toBeNull();
    });
    it('still defaults a MISSING dialogueIndex (legacy v1) to 0', () => {
        // The legacy v1 case (no version field) must still migrate to 0.
        // Under the version-based branch, this is detected as "missing
        // version -> legacy" rather than "missing dialogueIndex -> legacy",
        // but the outcome is the same.
        const v1 = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
        };
        const migrated = migratePersisted(v1, 'en');
        expect(migrated).not.toBeNull();
        expect(migrated?.dialogueIndex).toBe(0);
    });
    it('treats a missing or non-number version as legacy -> dialogueIndex 0', () => {
        // Regression guard for the `undefined < 2` edge case: a naive
        // version check would let a missing version fall through to the v2
        // preserve path; the explicit typeof/NaN guard routes it to legacy.
        const base = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
            dialogueIndex: 5,
        };
        // Missing version -> legacy -> 0 (dialogueIndex ignored).
        expect(migratePersisted({ ...base }, 'en')?.dialogueIndex).toBe(0);
        // Non-number versions -> legacy -> 0.
        for (const bad of [null, '2', true, NaN]) {
            expect(
                migratePersisted({ ...base, version: bad }, 'en')?.dialogueIndex
            ).toBe(0);
        }
    });
    it('treats version < 2 as legacy -> dialogueIndex 0', () => {
        const legacy = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
            version: 1,
            dialogueIndex: 7,
        };
        // A v1 record carrying a stale dialogueIndex must still default to 0;
        // legacy indices are not preserved under the v2 schema contract.
        expect(migratePersisted(legacy, 'en')?.dialogueIndex).toBe(0);
    });
    it('rejects a v2 record with a missing dialogueIndex (corrupted, not legacy)', () => {
        // Behavior change vs. the prior "missing dialogueIndex -> 0" rule:
        // under version-based detection, a v2 record missing its
        // dialogueIndex is a corrupted v2 record, not legacy v1. Reject so
        // the Tier-2 path falls through to the default session.
        const v2MissingIndex = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            locale: 'en',
            version: 2,
        };
        expect(migratePersisted(v2MissingIndex, 'en')).toBeNull();
    });
    it('rejects an unsupported future version (no silent downgrade to v2)', () => {
        // Regression guard: a version > STORAGE_VERSION must not be silently
        // rewritten as v2 with its dialogueIndex preserved — that would
        // restore state under a schema this code doesn't understand. Reject
        // so the caller falls through to the default session.
        const future = {
            storyId: 'train_adventure',
            sceneId: 'act2',
            dialogueIndex: 3,
            locale: 'en',
            version: 99,
        };
        expect(migratePersisted(future, 'en')).toBeNull();
    });
});
