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

function clampIndex(index: number, length: number): number {
    // Empty dialogue -> index 0 valid; never produce negative/NaN.
    if (length <= 0) return 0;
    return Math.min(Math.max(0, Math.trunc(index)), length - 1);
}

/** Parse URL `dialogue=N` (1-based). Returns 0-based index, or null if absent/invalid. */
export function parseDialogueParam(raw: string | null): number | null {
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1) return null;
    return n - 1;
}

function sceneExists(flow: FlowConfig | undefined, sceneId: string): boolean {
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
        sceneId: flow?.start ?? 'act1',
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
                : (flowForUrl.start as string);
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
    const dialogueIndex =
        typeof s.dialogueIndex === 'number' && !Number.isNaN(s.dialogueIndex)
            ? Math.max(0, s.dialogueIndex)
            : 0;
    return {
        storyId: s.storyId,
        sceneId: s.sceneId,
        dialogueIndex,
        locale: s.locale as Locale,
        version: STORAGE_VERSION,
    };
}
