import type { Locale, DialogueEntry, FlowConfig } from '@aquila/stories';

export interface ReaderSessionState {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    locale: Locale;
}

export interface PersistedSession {
    storyId: string;
    sceneId: string;
    dialogueIndex: number;
    locale: Locale;
    version: number;
}

export const STORAGE_VERSION = 2;

/** Fallback scene id when a flow has no `start` field. Used by both
 *  `defaultState` (here) and `ReaderManager`'s constructor seeding of
 *  `readerState` before the first `resolveAndApply()`. Centralized so the two
 *  sites cannot drift. */
export const DEFAULT_SCENE_ID = 'act1';

export type StoryFlowProvider = (storyId: string) => FlowConfig | undefined;
export type DialogueProvider = (
    storyId: string,
    sceneId: string,
    locale: Locale
) => DialogueEntry[];

export interface ResolveDeps {
    flow: StoryFlowProvider;
    dialogue: DialogueProvider;
    defaultStoryId: string;
}

function isLocale(v: unknown): v is Locale {
    return v === 'en' || v === 'zh';
}

/** Clamp a 0-based dialogue index into `[0, length-1]`. Empty dialogue
 *  (`length <= 0`) -> index 0 is valid (the UI shows its empty/end state).
 *  Never produces a negative or NaN value. Shared by `validateSessionState`
 *  (restore/popstate) and `ReaderManager.onIndexChange` (write-path
 *  defense-in-depth). */
export function clampIndex(index: number, length: number): number {
    // Empty dialogue -> index 0 valid; never produce negative/NaN.
    if (length <= 0) return 0;
    // NaN slips through Math.trunc/Math.max/Math.min (all return NaN), so guard
    // it explicitly to honor the "never produces NaN" invariant. A NaN write
    // would otherwise propagate to the URL as `dialogue=NaN` and to persisted
    // state as a corrupted index. Default NaN to 0 (the start-of-scene line).
    if (Number.isNaN(index)) return 0;
    return Math.min(Math.max(0, Math.trunc(index)), length - 1);
}

/** Parse URL `dialogue=N` (1-based). Returns 0-based index, or null if absent/invalid.
 *  The entire raw value must consist only of digits, so partially numeric
 *  inputs like "2junk" or "1.5" are rejected rather than silently coerced. */
export function parseDialogueParam(raw: string | null): number | null {
    if (raw === null) return null;
    if (!/^\d+$/.test(raw)) return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n - 1;
}

/** True if a scene node with this sceneId exists anywhere in the flow graph. */
export function sceneExists(
    flow: FlowConfig | undefined,
    sceneId: string
): boolean {
    return (
        !!flow &&
        flow.nodes.some(n => n.kind === 'scene' && n.sceneId === sceneId)
    );
}

/**
 * Validate a resolved 0-based session. Non-negative index is clamped into bounds
 * (empty dialogue -> 0). Negative/NaN index or unknown story/scene -> null.
 */
export function validateSessionState(
    state: unknown,
    flow: FlowConfig | undefined,
    dialogue: DialogueEntry[]
): ReaderSessionState | null {
    if (!state || typeof state !== 'object') return null;
    const s = state as Record<string, unknown>;
    const { storyId, sceneId, dialogueIndex, locale } = s;
    if (typeof storyId !== 'string') return null;
    if (typeof sceneId !== 'string') return null;
    if (!isLocale(locale)) return null;
    if (!flow) return null;
    if (!sceneExists(flow, sceneId)) return null;
    if (
        typeof dialogueIndex !== 'number' ||
        Number.isNaN(dialogueIndex) ||
        dialogueIndex < 0
    ) {
        // negative/NaN -> invalid; but allow missing/undefined as 0
        if (dialogueIndex === undefined) {
            return { storyId, sceneId, dialogueIndex: 0, locale };
        }
        return null;
    }
    return {
        storyId,
        sceneId,
        dialogueIndex: clampIndex(dialogueIndex, dialogue.length),
        locale,
    };
}

/** Build the canonical URL query for a session (story/scene/dialogue=N). */
export function serializeSessionParams(
    state: ReaderSessionState
): URLSearchParams {
    const p = new URLSearchParams();
    p.set('story', state.storyId);
    p.set('scene', state.sceneId);
    p.set('dialogue', String(state.dialogueIndex + 1));
    return p;
}

function defaultState(deps: ResolveDeps, locale: Locale): ReaderSessionState {
    const flow = deps.flow(deps.defaultStoryId);
    return {
        storyId: deps.defaultStoryId,
        sceneId: flow?.start ?? DEFAULT_SCENE_ID,
        dialogueIndex: 0,
        locale,
    };
}

/**
 * Three-tier precedence:
 * 1. Valid explicit URL (valid `story` locks the tier; fields resolved independently)
 * 2. Valid persisted session (only when URL has no valid story)
 * 3. Story start/default
 */
export function resolveInitialState(
    params: URLSearchParams,
    persisted: PersistedSession | null,
    locale: Locale,
    deps: ResolveDeps
): ReaderSessionState {
    const urlStory = params.get('story');
    const urlScene = params.get('scene');
    const flowForUrl = urlStory ? deps.flow(urlStory) : undefined;

    // Tier 1: URL carries a valid story -> fully resolve, never fall through.
    if (urlStory && flowForUrl) {
        const sceneId =
            urlScene && sceneExists(flowForUrl, urlScene)
                ? urlScene
                : (flowForUrl.start ?? DEFAULT_SCENE_ID);
        const dialogue = deps.dialogue(urlStory, sceneId, locale);
        const idx = parseDialogueParam(params.get('dialogue'));
        return {
            storyId: urlStory,
            sceneId,
            dialogueIndex: idx !== null ? clampIndex(idx, dialogue.length) : 0,
            locale,
        };
    }

    // Tier 2: persisted (only when URL had no valid story); ignore locale mismatch.
    // The locale check is resolveInitialState's own contract — it is exercised
    // by direct unit tests that pass a persisted object bypassing
    // migratePersisted, so it is NOT dead despite migratePersisted also
    // filtering locale mismatches when called via ReaderManager.resolveAndApply.
    if (persisted && persisted.locale === locale) {
        const flow = deps.flow(persisted.storyId);
        const validated = validateSessionState(
            persisted,
            flow,
            deps.dialogue(persisted.storyId, persisted.sceneId, locale)
        );
        if (validated) return validated;
    }

    // Tier 3: default.
    return defaultState(deps, locale);
}

/** Migrate a raw localStorage value to PersistedSession v2, or null if unusable. */
export function migratePersisted(
    raw: unknown,
    locale: Locale
): PersistedSession | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (typeof s.storyId !== 'string' || typeof s.sceneId !== 'string')
        return null;
    if (!isLocale(s.locale) || s.locale !== locale) return null;
    // Branch on the persisted schema version rather than on `dialogueIndex`
    // presence, so unsupported future versions aren't silently rewritten as
    // v2 and so legacy detection is explicit and extensible.
    //
    // A missing or non-number `version` (including NaN) is treated as legacy:
    // `undefined < 2` is `false`, so a naive `version < 2` check would wrongly
    // accept a record with no `version` field; the explicit `typeof`/NaN guard
    // routes those to the legacy path instead.
    //
    // Legacy records (version < 2, missing, or invalid) never carried a
    // reliable `dialogueIndex`, so default to 0 regardless of any value
    // present. A supported v2 record must carry a valid numeric
    // `dialogueIndex`; a missing or non-number value (null, string, boolean,
    // NaN) is a corrupted v2 record, not legacy, and is rejected so the full
    // Tier-2 path falls through to the default session. The raw numeric value
    // is preserved as-is (including negatives) so `validateSessionState` can
    // enforce its own contract: negative/NaN indices are invalid and must
    // fall through; coercing negatives to 0 here would bypass the validator
    // and accept a malformed record (restoring a non-default scene).
    //
    // An unsupported future version (version > 2) is rejected rather than
    // silently downgraded, so state stored under a schema this code doesn't
    // understand is not restored under v2 semantics.
    const version = s.version;
    let dialogueIndex: number;
    if (typeof version !== 'number' || Number.isNaN(version) || version < 2) {
        // Legacy (v1, missing, or invalid version) -> default to 0.
        dialogueIndex = 0;
    } else if (version === 2) {
        if (
            typeof s.dialogueIndex === 'number' &&
            !Number.isNaN(s.dialogueIndex)
        ) {
            dialogueIndex = s.dialogueIndex;
        } else {
            // Missing or non-number dialogueIndex on a v2 record is corrupted.
            return null;
        }
    } else {
        // version > 2: unsupported future version -> don't silently rewrite as v2.
        return null;
    }
    return {
        storyId: s.storyId,
        sceneId: s.sceneId,
        dialogueIndex,
        locale: s.locale as Locale,
        version: STORAGE_VERSION,
    };
}
