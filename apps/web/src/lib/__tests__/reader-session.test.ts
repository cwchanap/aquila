import { describe, it, expect } from 'vitest';
import {
    parseDialogueParam,
    serializeSessionParams,
    migratePersisted,
    clampIndex,
    STORAGE_VERSION,
} from '../reader-session';

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
    it('preserves a negative dialogueIndex so validateLoadedIntent can reject it', () => {
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
