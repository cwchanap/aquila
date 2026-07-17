# Centralize Aquila reader session and URL state — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `readerState` the single canonical owner of reader progression (including the active dialogue index) with controlled reader components, a three-tier restore-precedence resolver, and correct browser-history/popstate synchronization.

**Architecture:** `readerState.svelte.ts` (Svelte 5 `$state` singleton) gains `dialogueIndex` and stays the only reactive store. A new pure module `reader-session.ts` holds all serialization/precedence/validation logic (injectable story accessors → unit-testable without `@aquila/stories`). `ReaderManager` becomes a plain-TS orchestrator that owns behavior (restore, URL/history, persistence, popstate) and reads/writes the store — it drops its private `currentState` mirror. `ReaderShell.svelte` becomes the full reactive store→props bridge. `NovelReader`/`MobileNovelReader` become pure controlled components (props in, `onIndexChange` out, no store import) that derive their visible history from the index.

**Tech Stack:** Svelte 5 (runes: `$state`/`$derived`/`$effect`/`$props`), TypeScript, Vitest (`happy-dom`, globals, fake timers already global in `src/lib/test-setup.ts`), `@testing-library/svelte`, `@aquila/stories` (`Locale`, `DialogueEntry`, `ChoiceDefinition`, `FlowConfig`).

**Spec:** `docs/superpowers/specs/2026-07-16-hpa-234-centralize-reader-session-design.md`

## Global Constraints

- Locale is path-owned (`/en/`, `/zh/`); it is mirrored in session state for cross-checking but **never serialized into the URL**. URL params are `story`, `scene`, `dialogue` only.
- URL `dialogue=N` is 1-based ("N lines shown"); canonical `dialogueIndex` is 0-based. `dialogue=0`/absent/NaN → treated as absent → index 0 (preserves current behavior at `reader-manager.ts:123`, test `:475` — no contract change).
- Persisted localStorage schema is `{storyId, sceneId, dialogueIndex, locale, version}` with `version: 2`. Legacy `version < 2` / missing `dialogueIndex` is migrated in place.
- Runtime scene payload (`dialogue`, `choice`, `canGoNext`) lives on `readerState` but is **never persisted** — only `ReaderSessionState` crosses the URL/localStorage boundary.
- Reader-mode preference (text vs visual) is **not** part of session state.
- `readerState.reset()` (called by the global test `beforeEach`) must reset `dialogueIndex` to 0.
- All reader components keep `typingText`/`isTyping`/`skipTyping`/`sceneVersion` as **component-local** presentation state; only the index is canonical.
- No `innerHTML`; use `document.createElement`/`textContent` (existing codebase rule).

---

## File Structure

**Create:**
- `apps/web/src/lib/reader-session.ts` — pure helpers: `ReaderSessionState`, `PersistedSession`, `STORAGE_VERSION`, `validateSessionState`, `resolveInitialState`, `parseDialogueParam`, `serializeSessionParams`, `migratePersisted`. No Svelte, no `@aquila/stories` import (accessors injected).
- `apps/web/src/lib/__tests__/reader-session.test.ts` — unit tests for all helpers.

**Modify:**
- `apps/web/src/lib/reader-state.svelte.ts` — add `dialogueIndex`, update `reset()`, add architecture header comment.
- `apps/web/src/lib/reader-manager.ts` — orchestrator refactor (drop `currentState`, use helpers, index/history/persistence glue, popstate, pagehide).
- `apps/web/src/components/ReaderShell.svelte` — full reactive store→props bridge.
- `apps/web/src/components/NovelReader.svelte` — controlled reader (desktop).
- `apps/web/src/components/MobileNovelReader.svelte` — controlled reader (mobile).
- `apps/web/src/components/__tests__/ReaderShell.test.ts`, `NovelReader.test.ts`, `MobileNovelReader.test.ts`, `apps/web/src/lib/__tests__/reader-manager.test.ts` — updated contracts.
- `apps/web/src/lib/reader-state.svelte.ts` header + a short `docs/reader-state-architecture.md` note.

---

### Task 1: Pure session helpers (`reader-session.ts`)

**Files:**
- Create: `apps/web/src/lib/reader-session.ts`
- Test: `apps/web/src/lib/__tests__/reader-session.test.ts`

**Interfaces:**
- Consumes: `Locale`, `DialogueEntry` from `@aquila/stories`; `FlowConfig` from `@aquila/stories` (`flow-types.ts`).
- Produces (used by Task 3+):
  - `interface ReaderSessionState { storyId: string; sceneId: string; dialogueIndex: number; locale: Locale }`
  - `interface PersistedSession { storyId: string; sceneId: string; dialogueIndex: number; locale: Locale; version: number }`
  - `const STORAGE_VERSION = 2`
  - `type StoryFlowProvider = (storyId: string) => FlowConfig | undefined`
  - `type DialogueProvider = (storyId: string, sceneId: string, locale: Locale) => DialogueEntry[]`
  - `interface ResolveDeps { flow: StoryFlowProvider; dialogue: DialogueProvider; defaultStoryId: string }`
  - `function validateSessionState(state: unknown, flow: FlowConfig | undefined, dialogue: DialogueEntry[]): ReaderSessionState | null`
  - `function resolveInitialState(params: URLSearchParams, persisted: PersistedSession | null, locale: Locale, deps: ResolveDeps): ReaderSessionState`
  - `function parseDialogueParam(raw: string | null): number | null` — returns 0-based index or null (absent)
  - `function serializeSessionParams(state: ReaderSessionState): URLSearchParams`
  - `function migratePersisted(raw: unknown, locale: Locale): PersistedSession | null`

- [ ] **Step 1: Write the failing test file**

Create `apps/web/src/lib/__tests__/reader-session.test.ts`:

```ts
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
    flow: (sid) => (sid === 'train_adventure' ? flow : undefined),
    dialogue: (sid, sceneId) =>
        sid === 'train_adventure'
            ? dialogue[sceneId] ?? emptySceneDialogue[sceneId] ?? []
            : [],
    defaultStoryId: 'train_adventure',
};

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
    const base = { storyId: 'train_adventure', sceneId: 'act1', dialogueIndex: 1, locale: 'en' as Locale };
    it('clamps a non-negative index into bounds', () => {
        expect(validateSessionState({ ...base, dialogueIndex: 99 }, flow, dialogue.act1)?.dialogueIndex).toBe(2);
    });
    it('keeps an in-bounds index', () => {
        expect(validateSessionState(base, flow, dialogue.act1)?.dialogueIndex).toBe(1);
    });
    it('empty dialogue -> index 0 valid', () => {
        expect(validateSessionState({ ...base, dialogueId: undefined, dialogueIndex: 0 }, flow, [])?.dialogueIndex).toBe(0);
    });
    it('returns null for negative or NaN index', () => {
        expect(validateSessionState({ ...base, dialogueIndex: -1 }, flow, dialogue.act1)).toBeNull();
        expect(validateSessionState({ ...base, dialogueIndex: NaN }, flow, dialogue.act1)).toBeNull();
    });
    it('returns null for unknown scene', () => {
        expect(validateSessionState({ ...base, sceneId: 'nope' }, flow, [])).toBeNull();
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
        expect(r).toEqual({ storyId: 'train_adventure', sceneId: 'act1', dialogueIndex: 0, locale: 'en' });
    });
    it('story+scene URL -> that scene, index 0', () => {
        const r = resolveInitialState(new URLSearchParams('story=train_adventure&scene=act2'), null, 'en', deps);
        expect(r.sceneId).toBe('act2');
        expect(r.dialogueIndex).toBe(0);
    });
    it('dialogue=N -> N-1 clamped', () => {
        const r = resolveInitialState(new URLSearchParams('story=train_adventure&scene=act1&dialogue=99'), null, 'en', deps);
        expect(r.dialogueIndex).toBe(2);
    });
    it('dialogue=0 -> absent -> index 0 (no contract break)', () => {
        const r = resolveInitialState(new URLSearchParams('story=train_adventure&scene=act1&dialogue=0'), null, 'en', deps);
        expect(r.dialogueIndex).toBe(0);
    });
    it('same-story card link does NOT resume persisted scene of same story', () => {
        const persisted = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'en', version: 2 };
        const r = resolveInitialState(new URLSearchParams('story=train_adventure'), persisted, 'en', deps);
        expect(r.sceneId).toBe('act1'); // story start, not persisted act2
    });
    it('invalid story falls through to persisted', () => {
        const persisted = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'en', version: 2 };
        const r = resolveInitialState(new URLSearchParams('story=bogus'), persisted, 'en', deps);
        expect(r.sceneId).toBe('act2');
    });
    it('no URL -> persisted', () => {
        const persisted = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'en', version: 2 };
        const r = resolveInitialState(new URLSearchParams(''), persisted, 'en', deps);
        expect(r.sceneId).toBe('act2');
    });
    it('no URL, no persisted -> default story start', () => {
        const r = resolveInitialState(new URLSearchParams(''), null, 'en', deps);
        expect(r).toEqual({ storyId: 'train_adventure', sceneId: 'act1', dialogueIndex: 0, locale: 'en' });
    });
    it('persisted with wrong locale is ignored', () => {
        const persisted = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'zh', version: 2 };
        const r = resolveInitialState(new URLSearchParams(''), persisted, 'en', deps);
        expect(r.sceneId).toBe('act1');
    });
});

describe('serializeSessionParams', () => {
    it('produces story/scene/dialogue=N', () => {
        const s = serializeSessionParams({ storyId: 'train_adventure', sceneId: 'act1', dialogueIndex: 2, locale: 'en' });
        expect(s.get('story')).toBe('train_adventure');
        expect(s.get('scene')).toBe('act1');
        expect(s.get('dialogue')).toBe('3');
    });
});

describe('migratePersisted', () => {
    it('passes through valid v2', () => {
        const v2 = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 1, locale: 'en', version: 2 };
        expect(migratePersisted(v2, 'en')).toEqual(v2);
    });
    it('upgrades v1 (no dialogueIndex) to v2 with index 0', () => {
        const v1 = { storyId: 'train_adventure', sceneId: 'act2', locale: 'en' };
        expect(migratePersisted(v1, 'en')).toEqual({ storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'en', version: 2 });
    });
    it('returns null for garbage', () => {
        expect(migratePersisted('nope', 'en')).toBeNull();
        expect(migratePersisted(null, 'en')).toBeNull();
    });
    it('returns null for wrong locale', () => {
        const v2 = { storyId: 'train_adventure', sceneId: 'act2', dialogueIndex: 0, locale: 'zh', version: 2 };
        expect(migratePersisted(v2, 'en')).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter web test src/lib/__tests__/reader-session.test.ts`
Expected: FAIL — module `../reader-session` not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/reader-session.ts`:

```ts
import type {
    Locale,
    DialogueEntry,
    FlowConfig,
} from '@aquila/stories';

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
        flow.nodes.some(
            n => n.kind === 'scene' && n.sceneId === sceneId
        )
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
    if (typeof dialogueIndex !== 'number' || Number.isNaN(dialogueIndex) || dialogueIndex < 0) {
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
export function serializeSessionParams(state: ReaderSessionState): URLSearchParams {
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

    // Tier 2: persisted (only when URL had no valid story).
    if (persisted) {
        const flow = deps.flow(persisted.storyId);
        const validated = validateSessionState(persisted, flow, deps.dialogue(persisted.storyId, persisted.sceneId, locale));
        if (validated) return validated;
    }

    // Tier 3: default.
    return defaultState(deps, locale);
}

/** Migrate a raw localStorage value to PersistedSession v2, or null if unusable. */
export function migratePersisted(raw: unknown, locale: Locale): PersistedSession | null {
    if (!raw || typeof raw !== 'object') return null;
    const s = raw as Record<string, unknown>;
    if (typeof s.storyId !== 'string' || typeof s.sceneId !== 'string') return null;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter web test src/lib/__tests__/reader-session.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/reader-session.ts apps/web/src/lib/__tests__/reader-session.test.ts
git commit -m "feat(reader): add pure reader-session helpers (state, validation, precedence)"
```

---

### Task 2: Add `dialogueIndex` to `readerState`

**Files:**
- Modify: `apps/web/src/lib/reader-state.svelte.ts`
- Test: covered by existing global reset (test-setup.ts `beforeEach`).

**Interfaces:**
- Produces: `readerState.dialogueIndex: number` (`$state(0)`); `readerState.reset()` now also zeroes it.

- [ ] **Step 1: Add the field and update reset + header comment**

Replace the entire contents of `apps/web/src/lib/reader-state.svelte.ts` with:

```ts
// Architecture: readerState is the single canonical reactive owner of reader
// PROGRESSION (storyId, currentSceneId, locale, dialogueIndex) — the only state
// that is serialized to URL/localStorage — plus the runtime SCENE PAYLOAD
// (dialogue, choice, canGoNext) which is derived from the loaded scene and
// never persisted. ReaderManager is a plain-TS orchestrator that owns behavior
// (restore, URL/history, persistence, popstate) and reads/writes this store.
// ReaderShell is the reactive store->props bridge; NovelReader/MobileNovelReader
// are pure controlled components with no store import.
import type { DialogueEntry, ChoiceDefinition, Locale } from '@aquila/stories';

class ReaderState {
    dialogue: DialogueEntry[] = $state([]);
    choice: ChoiceDefinition | null = $state(null);
    currentSceneId: string = $state('');
    storyId: string = $state('');
    canGoNext: boolean = $state(false);
    locale: Locale = $state('en');
    dialogueIndex: number = $state(0);

    reset() {
        this.dialogue = [];
        this.choice = null;
        this.currentSceneId = '';
        this.storyId = '';
        this.canGoNext = false;
        this.locale = 'en';
        this.dialogueIndex = 0;
    }
}

/** Global singleton — intentionally shared across the app for single-reader architecture. */
export const readerState = new ReaderState();
```

- [ ] **Step 2: Run the full unit suite to confirm nothing breaks**

Run: `bun --filter web test`
Expected: PASS (existing tests still green; `dialogueIndex` is additive and reset covers it).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/reader-state.svelte.ts
git commit -m "feat(reader): add dialogueIndex to readerState as canonical active-line owner"
```

---

### Task 3: ReaderManager single-source restore (drop `currentState` mirror)

**Files:**
- Modify: `apps/web/src/lib/reader-manager.ts` (constructor, `loadInitialState`, `saveState`, `initialize`, navigation reads)
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`

**Interfaces:**
- Consumes: Task 1 helpers (`resolveInitialState`, `migratePersisted`, `validateSessionState`, `serializeSessionParams`, `STORAGE_VERSION`, `ResolveDeps`).
- Produces: `ReaderManager` reads story/scene/locale/dialogueIndex from `readerState`; private `currentState` field removed. (Mount still passes old-style props here; the index glue is added in Task 4.)

- [ ] **Step 1: Update the tests for the new restore path first**

In `apps/web/src/lib/__tests__/reader-manager.test.ts`, the `loadInitialState`/`saveState`/`initialize` tests assert on `currentState`/`storageKey` behavior. Replace the private-field access patterns with behavior on `readerState` and the new helper-driven path. Concretely:
- Remove tests that reach into `(manager as any).currentState`. Replace with assertions that after `initialize()`, `readerState.currentSceneId` / `readerState.storyId` / `readerState.dialogueIndex` reflect the resolved state.
- Keep the `getSceneData`, `hasNextScene` tests (they now read from `readerState`).
- Add: `it('uses replaceState on initial restore, not pushState', ...)` asserting `history.replaceState` called and `history.pushState` NOT called during `initialize()`.

Example new test:

```ts
import { readerState } from '../reader-state.svelte';

it('initial restore uses replaceState (no duplicate history entry)', () => {
    Object.defineProperty(window, 'history', {
        value: { pushState: vi.fn(), replaceState: vi.fn() },
        writable: true,
    });
    mockGetStoryContent.mockReturnValue({ dialogue: { act1: [] }, choices: {} });
    const manager = new ReaderManager('en');
    manager.initialize();
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(window.history.pushState).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`
Expected: FAIL (new assertions, `currentState` access removed).

- [ ] **Step 3: Refactor the manager restore path**

In `apps/web/src/lib/reader-manager.ts`:

1. Remove the `SceneState` interface and the `private currentState: SceneState` field and `initialDialogueIndex` field.
2. Add a `ResolveDeps` instance built from `getStoryFlow`/`getStoryContent`:

```ts
import {
    resolveInitialState,
    migratePersisted,
    validateSessionState,
    serializeSessionParams,
    STORAGE_VERSION,
    type ResolveDeps,
    type ReaderSessionState,
} from './reader-session';

// inside the class, as a private getter or const in constructor:
private readonly deps: ResolveDeps = {
    flow: (sid) => getStoryFlow(sid) ?? undefined,
    dialogue: (sid, sceneId, loc) => getStoryContent(sid, loc).dialogue[sceneId] ?? [],
    defaultStoryId: 'train_adventure',
};
```

3. Replace `loadInitialState()` with a method that runs the resolver and writes the result into `readerState`, returning void:

```ts
private resolveAndApply(): ReaderSessionState {
    const params = new URLSearchParams(window.location.search);
    const raw = localStorage.getItem(this.storageKey);
    const persisted = raw ? migratePersisted(JSON.parse(raw), this.initialLocale) : null;
    const state = resolveInitialState(params, persisted, this.initialLocale, this.deps);
    this.applySession(state); // writes readerState + reloads scene payload
    return state;
}

private applySession(state: ReaderSessionState): void {
    readerState.storyId = state.storyId;
    readerState.currentSceneId = state.sceneId;
    readerState.locale = state.locale;
    readerState.dialogueIndex = state.dialogueIndex;
    const { dialogue, choice } = this.getSceneData(state.storyId, state.sceneId, state.locale);
    readerState.dialogue = dialogue;
    readerState.choice = choice;
    readerState.canGoNext = this.hasNextScene(state.sceneId);
}

private get storageKey(): string {
    return `${ReaderManager.STORAGE_KEY_PREFIX}:${this.initialLocale}`;
}
```

4. Replace `saveState` usages: navigation reads come from `readerState`. Add a `persist()` that writes the v2 schema, and a `syncUrl(useReplace)` helper. The initial restore uses `replaceState`:

```ts
private persist(): void {
    const data = {
        storyId: readerState.storyId,
        sceneId: readerState.currentSceneId,
        dialogueIndex: readerState.dialogueIndex,
        locale: readerState.locale,
        version: STORAGE_VERSION,
    };
    localStorage.setItem(this.storageKey, JSON.stringify(data));
}

private syncUrl(useReplace: boolean): void {
    const url = new URL(window.location.href);
    const params = serializeSessionParams({
        storyId: readerState.storyId,
        sceneId: readerState.currentSceneId,
        dialogueIndex: readerState.dialogueIndex,
        locale: readerState.locale,
    });
    url.search = params.toString();
    if (useReplace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
}
```

5. Update `initialize()`:

```ts
initialize(): void {
    this.resolveAndApply();
    this.syncUrl(true);   // first sync uses replaceState (collapse duplicate entry)
    this.persist();
    this.renderReader();
}
```

6. Update `getSceneNode`/`getLinearNextScene`/`hasNextScene`/`getSceneData`/`handleNext`/`handleChoice`/`handleBookmark`/`pushReaderState` to read `readerState.storyId`/`readerState.currentSceneId`/`readerState.locale` instead of `this.currentState.*`. (Note: this task does NOT yet rewire navigation to the new index glue — keep `navigateToScene` calling `applySession` + `syncUrl(false)` + `persist` for now; the throttled index write path lands in Task 4.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `bun --filter web test`
Expected: PASS (readers still work via their `readerState` fallback for non-index fields).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-manager.test.ts
git commit -m "refactor(reader): drop currentState mirror, drive restore via resolveInitialState; initial restore uses replaceState"
```

---

### Task 4: ReaderManager index/history/persistence glue + popstate + pagehide

**Files:**
- Modify: `apps/web/src/lib/reader-manager.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`

**Interfaces:**
- Produces (used by Task 5+): the manager mounts `ReaderShell` and passes an `onIndexChange: (i: number) => void` callback (the orchestrator's write path). `goToScene(sceneId)` is the shared scene-navigation method. A pending `replaceState` is flushed on scene change / pagehide and cancelled on popstate.

- [ ] **Step 1: Write failing tests for the index glue + history policy**

Add to `reader-manager.test.ts` (note: fake timers are global; stub `requestAnimationFrame`):

```ts
describe('index glue and history policy', () => {
    function stubRaf() {
        let cb: FrameRequestCallback | null = null;
        Object.defineProperty(window, 'requestAnimationFrame', {
            value: (fn: FrameRequestCallback) => {
                cb = fn;
                return 1;
            },
            writable: true,
            configurable: true,
        });
        return { flush: () => { const f = cb; cb = null; if (f) f(performance.now()); },
                 pending: () => cb !== null };
    }

    it('onIndexChange writes readerState.dialogueIndex and schedules throttled replaceState', () => {
        const raf = stubRaf();
        Object.defineProperty(window, 'history', { value: { pushState: vi.fn(), replaceState: vi.fn() }, writable: true });
        mockGetStoryContent.mockReturnValue({ dialogue: { act1: [{ dialogue: 'a' }] }, choices: {} });
        const manager = new ReaderManager('en');
        manager.initialize();
        // extract onIndexChange from the mount props
        await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
        const onIndexChange = mockMount.mock.calls.at(-1)![1].props.onIndexChange as (i: number) => void;
        onIndexChange(2);
        expect(readerState.dialogueIndex).toBe(2);
        expect(raf.pending()).toBe(true);
        expect(window.history.replaceState).not.toHaveBeenCalled(); // throttled
        raf.flush();
        expect(window.history.replaceState).toHaveBeenCalled();
    });

    it('goToScene flushes pending replaceState before pushState', () => {
        const raf = stubRaf();
        const pushState = vi.fn(), replaceState = vi.fn();
        Object.defineProperty(window, 'history', { value: { pushState, replaceState }, writable: true });
        mockGetStoryContent.mockReturnValue({ dialogue: { act1: [{ dialogue: 'a' }], act2: [{ dialogue: 'b' }] }, choices: {} });
        const manager = new ReaderManager('en');
        manager.initialize();
        const onIndexChange = mockMount.mock.calls.at(-1)![1].props.onIndexChange as (i: number) => void;
        onIndexChange(1); // schedule a replaceState
        expect(raf.pending()).toBe(true);
        manager.goToScene('act2'); // navigate
        expect(raf.pending()).toBe(false);            // flushed
        expect(replaceState).toHaveBeenCalled();      // the line write happened
        expect(pushState).toHaveBeenCalled();         // then the scene entry
    });

    it('popstate restores validated state and cancels pending replaceState', () => {
        const raf = stubRaf();
        const replaceState = vi.fn();
        Object.defineProperty(window, 'history', { value: { pushState: vi.fn(), replaceState }, writable: true });
        mockGetStoryContent.mockReturnValue({ dialogue: { act1: [{ dialogue: 'a' }, { dialogue: 'b' }] }, choices: {} });
        const manager = new ReaderManager('en');
        manager.initialize();
        const onIndexChange = mockMount.mock.calls.at(-1)![1].props.onIndexChange as (i: number) => void;
        onIndexChange(1);
        expect(raf.pending()).toBe(true);
        // dispatch popstate with a valid URL
        Object.defineProperty(window, 'location', { value: { search: 'story=train_adventure&scene=act1&dialogue=1', href: '' }, writable: true });
        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(raf.pending()).toBe(false);                 // cancelled, not flushed
        expect(readerState.dialogueIndex).toBe(0);         // restored to line 1 -> index 0
    });

    it('invalid popstate soft-rejects: store unchanged, canonical URL replaceStated', () => {
        const replaceState = vi.fn();
        Object.defineProperty(window, 'history', { value: { pushState: vi.fn(), replaceState }, writable: true });
        mockGetStoryContent.mockReturnValue({ dialogue: { act1: [{ dialogue: 'a' }] }, choices: {} });
        const manager = new ReaderManager('en');
        manager.initialize();
        const before = readerState.currentSceneId;
        Object.defineProperty(window, 'location', { value: { search: 'story=bogus&scene=nope', href: '' }, writable: true });
        window.dispatchEvent(new PopStateEvent('popstate'));
        expect(readerState.currentSceneId).toBe(before);   // unchanged
        expect(replaceState).toHaveBeenCalled();            // canonical URL reconverged
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`
Expected: FAIL (`onIndexChange` prop / `goToScene` / popstate listener do not exist yet).

- [ ] **Step 3: Implement the glue**

In `apps/web/src/lib/reader-manager.ts`, add private throttled-write state and methods:

```ts
private rafId: number | null = null;
private persistTimer: ReturnType<typeof setTimeout> | null = null;

private flushPendingReplace(): void {
    if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
        this.syncUrl(true);
    }
}

private cancelPendingReplace(): void {
    if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
    }
}

private scheduleReplace(): void {
    if (this.rafId !== null) return; // coalesce
    const raf =
        typeof window !== 'undefined' && window.requestAnimationFrame
            ? window.requestAnimationFrame.bind(window)
            : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
    this.rafId = raf(() => {
        this.rafId = null;
        this.syncUrl(true);
    });
}

private schedulePersist(): void {
    if (this.persistTimer !== null) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
        this.persistTimer = null;
        this.persist();
    }, 500);
}

/** The orchestrator write path passed to ReaderShell as the onIndexChange prop. */
onIndexChange = (i: number): void => {
    readerState.dialogueIndex = i;
    this.scheduleReplace();
    this.schedulePersist();
};

goToScene = (sceneId: string): void => {
    this.flushPendingReplace();      // preserve accurate line for Back
    readerState.currentSceneId = sceneId;
    readerState.dialogueIndex = 0;
    const { dialogue, choice } = this.getSceneData(readerState.storyId, sceneId, readerState.locale);
    readerState.dialogue = dialogue;
    readerState.choice = choice;
    readerState.canGoNext = this.hasNextScene(sceneId);
    this.syncUrl(false);             // pushState (new history entry)
    this.persist();
};
```

Update `navigateToScene`/`handleChoice`/`handleNext`/`handleBookmark`'s `onNavigate` to call `this.goToScene(...)`. In `renderReader`, pass `onIndexChange: this.onIndexChange` and `onNavigate: this.goToScene` in the mount props (keep other props).

Add popstate + pagehide/visibilitychange listeners (registered in `initialize`, removed on page unload — full-page app, no `destroy()`):

```ts
private onPopState = (): void => {
    this.cancelPendingReplace();     // do NOT flush -> avoid mutating destination entry
    const params = new URLSearchParams(window.location.search);
    const urlStory = params.get('story');
    const flowForUrl = urlStory ? this.deps.flow(urlStory) : undefined;
    if (!urlStory || !flowForUrl) {
        // invalid popstate -> soft-reject: keep store, reconverge URL
        this.syncUrl(true);
        return;
    }
    const persisted = null; // popstate never falls through to persisted
    const state = resolveInitialState(params, persisted, readerState.locale, this.deps);
    if (state.sceneId !== readerState.currentSceneId || state.storyId !== readerState.storyId) {
        this.applySession(state);
    } else {
        readerState.dialogueIndex = state.dialogueIndex;
    }
};

private onPageHide = (): void => {
    this.flushPendingReplace();      // URL correct if tab restored
    if (this.persistTimer !== null) {
        clearTimeout(this.persistTimer);
        this.persistTimer = null;
        this.persist();
    }
};
```

Wire them in `initialize()` after `resolveAndApply()`:

```ts
window.addEventListener('popstate', this.onPopState);
window.addEventListener('pagehide', this.onPageHide);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') this.onPageHide();
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-manager.test.ts
git commit -m "feat(reader): index glue, throttled replaceState, goToScene flush, popstate soft-reject, pagehide flush"
```

---

### Task 5: ReaderShell — full reactive store→props bridge

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: `readerState` (all progressive fields); props `onIndexChange`, `onChoice`, `onBookmark`, `onNext`, `onNavigate`, `backUrl`, `showBookmarkButton` from the orchestrator.
- Produces: passes `dialogueIndex`/`dialogue`/`choice`/`storyId`/`currentSceneId`/`canGoNext`/`locale` + callbacks to `NovelReader`/`MobileNovelReader`. `liveIndex`/`hasSwapped`/`effectiveInitialDialogueIndex`/`initialDialogueIndex` deleted.

- [ ] **Step 1: Update ReaderShell tests to the bridge contract**

In `ReaderShell.test.ts`, the existing tests pass `dialogue`/`choice`/`locale` props and assert desktop/mobile rendering and the breakpoint swap. Update the "preserves index when switching layouts" / "does not re-apply stale bookmark" tests: instead of an `initialDialogueIndex` prop, mutate `readerState.dialogueIndex` before/after and assert both readers render that line. Remove any `initialDialogueIndex` prop usage. Add:

```ts
import { readerState } from '@/lib/reader-state.svelte';

it('forwards store-derived dialogueIndex to whichever reader is mounted', async () => {
    stubMatchMedia(false);
    readerState.dialogueIndex = 1;
    render(ReaderShell, { props: { dialogue: mockDialogue, choice: null, locale: 'en', onIndexChange: () => {} } });
    await vi.runAllTimersAsync();
    expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`
Expected: FAIL (old `initialDialogueIndex`/`liveIndex` contract gone).

- [ ] **Step 3: Rewrite ReaderShell as the bridge**

Replace the entire contents of `apps/web/src/components/ReaderShell.svelte`:

```svelte
<script lang="ts">
  import { readerState } from '@/lib/reader-state.svelte';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';
  import type { DialogueEntry, ChoiceDefinition, Locale } from '@aquila/stories';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    onIndexChange = () => {},
    showBookmarkButton = true,
    backUrl = '/',
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    onIndexChange?: (index: number) => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
  } = $props();

  // Full reactive store->props bridge: every progressive field is derived here.
  let dialogue = $derived(readerState.dialogue);
  let choice = $derived(readerState.choice);
  let storyId = $derived(readerState.storyId);
  let currentSceneId = $derived(readerState.currentSceneId);
  let canGoNext = $derived(readerState.canGoNext);
  let locale = $derived(readerState.locale);
  let dialogueIndex = $derived(readerState.dialogueIndex);

  const MOBILE_QUERY = '(max-width: 1023px)';
  function readMatch(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(MOBILE_QUERY).matches;
  }
  let isMobile = $state(readMatch());
  onMount(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (e: globalThis.MediaQueryListEvent) => (isMobile = e.matches);
    isMobile = mql.matches;
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  });
  import { onMount } from 'svelte';
</script>

{#if isMobile}
  <MobileNovelReader
    {dialogueIndex} {onIndexChange} {dialogue} {choice}
    {storyId} {currentSceneId} {canGoNext} {locale}
    {onChoice} {onBookmark} {onNext} {onNavigate} {backUrl} {showBookmarkButton}
  />
{:else}
  <NovelReader
    {dialogueIndex} {onIndexChange} {dialogue} {choice}
    {storyId} {currentSceneId} {canGoNext} {locale}
    {onChoice} {onBookmark} {onNext} {onNavigate} {backUrl} {showBookmarkButton}
  />
{/if}
```

(Move the `import { onMount } from 'svelte';` to the top of the script block with the other imports in the actual file — shown here inline only for brevity of the diff.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ReaderShell.svelte apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "refactor(reader): ReaderShell is the full reactive store->props bridge (delete liveIndex/hasSwapped)"
```

---

### Task 6: NovelReader — controlled reader (desktop)

**Files:**
- Modify: `apps/web/src/components/NovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/NovelReader.test.ts`

**Interfaces:**
- Consumes: props `dialogueIndex`, `onIndexChange`, `dialogue`, `choice`, `storyId`, `currentSceneId`, `canGoNext`, `locale`, `onChoice`, `onBookmark`, `onNext`, `onNavigate`, `backUrl`, `showBookmarkButton`. **No `readerState` import.**
- Produces: renders completed history `dialogue.slice(0, dialogueIndex)` + active line; emits `onIndexChange` on advance; calls `onBookmark(dialogueIndex + 1)`.

- [ ] **Step 1: Update NovelReader tests to the controlled contract**

Rewrite `NovelReader.test.ts` to render with explicit props (no store) and assert:
- renders the line at the `dialogueIndex` prop;
- `onIndexChange` fires with `newIndex` on Enter/click advance;
- a key/click during typing sets `skipTyping` and does NOT call `onIndexChange`;
- visible history = lines before the index;
- a new scene at `dialogueIndex` 0 still animates the first line (text appears after timers);
- an external `dialogueIndex` prop change (re-render with a different index) snaps to full text without re-animating.

Example:

```ts
it('emits onIndexChange on advance and not during typing', async () => {
    const onIndexChange = vi.fn();
    const { rerender } = render(NovelReader, {
        props: { dialogue: mockDialogue, choice: null, locale: 'en', dialogueIndex: 0, onIndexChange }
    });
    await vi.runAllTimersAsync();
    await fireEvent.keyDown(window, { key: 'Enter' }); // completes typing
    await fireEvent.keyDown(window, { key: 'Enter' }); // advance
    expect(onIndexChange).toHaveBeenCalledWith(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter web test src/components/__tests__/NovelReader.test.ts`
Expected: FAIL (still expects old prop/store contract).

- [ ] **Step 3: Refactor NovelReader to controlled**

In `NovelReader.svelte`:
1. Remove the `import { readerState }` line and all `readerState.*` references. Remove the `dialogueProp !== undefined ? … : readerState.…` fallbacks — every value comes from props.
2. Replace `let currentDialogueIndex = $state(0)` with a prop: `let { dialogueIndex = 0, onIndexChange = () => {}, dialogue = [], choice = null, storyId, currentSceneId, canGoNext = false, locale = 'en', onChoice, onBookmark, onNext, onNavigate, backUrl, showBookmarkButton } = $props();`
3. Delete `displayedDialogues`, `lastDialogueRef`, `hasAppliedInitialIndex`, `hasUserAdvanced`, `initialBookmarkConsumed`, and the two initial-index effects.
4. Derive history from the index:
   ```ts
   let completedDialogues = $derived(dialogue.slice(0, dialogueIndex));
   let currentDialogue = $derived(dialogue[dialogueIndex]);
   let isLastDialogue = $derived(dialogueIndex >= dialogue.length - 1);
   ```
5. Two-signal typewriter algorithm. Keep `isTyping`, `typingText`, `skipTyping`, `sceneVersion`. Add a `selfAdvance` flag. Replace the scene-init and typing effects with:
   ```ts
   let lastDialogueRef: DialogueEntry[] | undefined = undefined;
   // Signal 1: new scene (dialogue reference change) -> always animate first line.
   $effect(() => {
       if (dialogue !== lastDialogueRef) {
           lastDialogueRef = dialogue;
           sceneVersion++;
           isTyping = false; skipTyping = false; typingText = '';
           selfAdvance = false;
           if (dialogue.length > 0) void startTyping(dialogueIndex);
       }
   });
   // Signal 2: index change within same scene.
   let lastIndex = dialogueIndex;
   $effect(() => {
       if (dialogue === lastDialogueRef && dialogueIndex !== lastIndex) {
           if (selfAdvance) { sceneVersion++; void startTyping(dialogueIndex); }
           else { sceneVersion++; isTyping = false; typingText = currentDialogue?.dialogue ?? ''; } // snap
       }
       lastIndex = dialogueIndex;
   });
   ```
   where `startTyping` is the existing typewriter runner keyed on `sceneVersion`, and `selfAdvance` is set `true` immediately before calling `onIndexChange` in the advance handler.
6. Advance handler:
   ```ts
   function handleNext() {
       if (isTyping) { skipTyping = true; return; } // does NOT call onIndexChange
       if (dialogueIndex < dialogue.length - 1) { selfAdvance = true; onIndexChange(dialogueIndex + 1); skipTyping = false; }
       else if (canGoNext && !choice) { onNext(); }
   }
   ```
7. In the template, render `completedDialogues` (each as a finished line) plus the active line (showing `typingText` while `isTyping`, else `currentDialogue.dialogue`). Bookmark button: `onBookmark(dialogueIndex + 1)`. Progress display: `(dialogueIndex + 1) / dialogue.length`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --filter web test src/components/__tests__/NovelReader.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite (desktop path now end-to-end via store)**

Run: `bun --filter web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/NovelReader.svelte apps/web/src/components/__tests__/NovelReader.test.ts
git commit -m "refactor(reader): NovelReader is a controlled reader (history from index, two-signal typewriter, no store import)"
```

---

### Task 7: MobileNovelReader — controlled reader (mobile)

**Files:**
- Modify: `apps/web/src/components/MobileNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Same as Task 6 (mobile variants): props in, `onIndexChange` out, no `readerState` import. `goBack` emits `onIndexChange(dialogueIndex - 1)`.

- [ ] **Step 1: Update MobileNovelReader tests to the controlled contract**

Mirror Task 6's test cases for mobile: render with explicit props; assert `onIndexChange` on `advance()` (tap/Enter) and `goBack()`; tap during typing does not call `onIndexChange`; external `dialogueIndex` change snaps; new scene at index 0 animates first line; `backlogLines` derives from index.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor MobileNovelReader to controlled**

Apply the same transformation as Task 6:
1. Remove `readerState` import + fallbacks; all values from props.
2. Replace local `currentDialogueIndex = $state(0)` with the `dialogueIndex` prop + `onIndexChange`.
3. Remove `initialBookmarkConsumed`; apply the two-signal typewriter algorithm (scene-ref → animate first line; index change → animate if `selfAdvance` else snap).
4. `advance()`: typing → `skipTyping` (no `onIndexChange`); else `selfAdvance = true; onIndexChange(dialogueIndex + 1)`. `goBack()`: `selfAdvance = true; onIndexChange(dialogueIndex - 1)`.
5. `backlogLines` already derives from the index (`dialogue.slice(0, currentDialogueIndex + 1)`) — update to use the `dialogueIndex` prop. Bookmark: `onBookmark(dialogueIndex + 1)`. Progress: `dialogueIndex + 1`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --filter web test src/components/__tests__/MobileNovelReader.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `bun --filter web test`
Expected: PASS (both desktop and mobile paths now end-to-end through the store).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/MobileNovelReader.test.ts
git commit -m "refactor(reader): MobileNovelReader is a controlled reader (two-signal typewriter, no store import)"
```

---

### Task 8: Integration regression + architecture note

**Files:**
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts` (final swap/restore integration)
- Create: `docs/reader-state-architecture.md`

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Add the end-to-end breakpoint-swap + restore integration test**

In `ReaderShell.test.ts`, add a test that drives the full loop: set `readerState.dialogueIndex`, advance via keyboard (desktop) which calls `onIndexChange`, flip `matchMedia` to mobile, and assert the mobile reader resumes at the advanced line — proving the store survives the swap with no `liveIndex` machinery.

```ts
it('preserves the exact line across a desktop->mobile swap via the store', async () => {
    const mm = stubMatchMedia(false);
    const onIndexChange = (i: number) => { readerState.dialogueIndex = i; };
    render(ReaderShell, { props: { dialogue: mockDialogue, choice: null, locale: 'en', onIndexChange } });
    await vi.runAllTimersAsync();
    await fireEvent.keyDown(window, { key: 'Enter' }); await vi.runAllTimersAsync(); // complete typing
    await fireEvent.keyDown(window, { key: 'Enter' }); await vi.runAllTimersAsync(); // advance to index 1
    expect(readerState.dialogueIndex).toBe(1);
    mm.setMatches(true);
    await waitFor(() => expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument());
    expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the architecture note**

Create `docs/reader-state-architecture.md`:

```markdown
# Reader state architecture

- **`readerState` (`src/lib/reader-state.svelte.ts`)** is the single canonical reactive owner of reader PROGRESSION (`storyId`, `currentSceneId`, `locale`, `dialogueIndex`) — the only state serialized to URL/localStorage — plus the runtime SCENE PAYLOAD (`dialogue`, `choice`, `canGoNext`), which is derived from the loaded scene and never persisted.
- **`reader-session.ts`** holds pure serialization/precedence/validation logic (`resolveInitialState`, `validateSessionState`, `serializeSessionParams`, `migratePersisted`). Story accessors are injected, so it is unit-testable without `@aquila/stories`.
- **`ReaderManager`** is a plain-TS orchestrator: restore precedence, URL/history (`initialize`→replaceState, scene→pushState, line→throttled replaceState, popstate→cancel+restore/soft-reject, pagehide→flush), debounced persistence, and the `onIndexChange` write path. It has no `currentState` mirror — it reads `readerState`.
- **`ReaderShell`** is the reactive store→props bridge: it derives every progressive field from `readerState` and forwards it as props.
- **`NovelReader` / `MobileNovelReader`** are pure controlled components: data in via props, `onIndexChange`/actions out, no store import. Visible history derives from the index; the typewriter follows the two-signal algorithm (scene-ref change animates the first line; index change animates only if self-initiated, else snaps).
- **URL contract:** `story` / `scene` / `dialogue=N` (1-based). `locale` is path-owned, never in the URL.
```

- [ ] **Step 4: Run the full unit suite + lint**

Run: `bun --filter web test && bun lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/__tests__/ReaderShell.test.ts docs/reader-state-architecture.md
git commit -m "test(reader): end-to-end breakpoint-swap regression; add reader state architecture note"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Canonical session state + validation helpers → Task 1. ✓
- `readerState.dialogueIndex` ownership + `reset()` → Task 2. ✓
- Refactored `ReaderManager`/`readerState` single source of truth (drop mirror) → Task 3. ✓
- Controlled-reader index contract → Tasks 5–7. ✓
- URL serialization/parsing/precedence/popstate → Tasks 1, 3, 4. ✓
- Legacy migration → Task 1 (`migratePersisted`) + Task 3 (loader). ✓
- Restore-precedence/bounds/mode-swap/browser-nav tests → Tasks 1, 4, 5, 8. ✓
- Bookmark/choice/locale/scene regression → covered by updated `reader-manager.test.ts` + existing suites (kept green each task). ✓
- Architecture note → Task 8 + Task 2 header. ✓
- Full ReaderShell store→props bridge → Task 5. ✓
- Empty-dialogue clamp → Task 1. ✓
- Invalid popstate soft-reject → Task 4. ✓
- Initial restore replaceState → Task 3. ✓
- Two-signal typewriter + new-scene-at-0 animates → Tasks 6, 7. ✓
- Bookmark formula `dialogueIndex + 1` → Tasks 6, 7. ✓
- Fake-timer/rAF-aware throttle tests → Task 4. ✓

**Placeholder scan:** None — every code step shows actual code; no TBD/TODO/"add error handling".

**Type consistency:** `ReaderSessionState` / `PersistedSession` / `ResolveDeps` defined in Task 1 and consumed identically in Tasks 3–4. `onIndexChange`/`goToScene` produced in Task 4 and consumed in Tasks 5–7. `dialogueIndex` prop name consistent across Tasks 5–7.
