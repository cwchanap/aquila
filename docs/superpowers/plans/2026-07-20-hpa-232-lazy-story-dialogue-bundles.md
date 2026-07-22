# Lazy-load Aquila Story Dialogue Bundles Implementation Plan

> **Status: archived implementation plan.** This document preserves the original task sequence and unchecked checkboxes as historical planning context; it is not a live execution-status tracker. Completed verification and final evidence are recorded in `docs/performance/2026-07-20-hpa-232-reader-bundles.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Aquila web reader download only its selected story payload while preserving HPA-234 session/history behavior and the synchronous Phaser/desktop story API.

**Architecture:** `@aquila/stories/async` owns an explicit dynamic-import registry, successful-session cache, in-flight deduplication, normalized locale contract, and typed errors; `@aquila/stories/translations` keeps web translation imports away from the eager root barrel. The web reader selects metadata-only intent, mounts its shell and listeners before awaiting content, validates the intent against the loaded flow/dialogue, and atomically applies the payload under a generation guard. Phaser and desktop keep the existing synchronous root API.

**Tech Stack:** Bun 1.3.1, TypeScript 5.9, Astro 5, Vite, Svelte 5 runes, Vitest/happy-dom, Playwright, Phaser 3, Tauri 2.

**Spec:** `docs/superpowers/specs/2026-07-20-hpa-232-lazy-story-dialogue-bundles-design.md`

## Global Constraints

- Preserve HPA-234's canonical `ReaderSessionState`; only story/scene/dialogue index/locale cross URL or localStorage boundaries.
- Keep `getStoryContent()` and `getStoryFlow()` synchronous for Phaser, desktop, and existing shared consumers.
- The web reader runtime graph must contain no value import from the eager `@aquila/stories` root.
- Keep flow, dialogue, and choices in the same per-story dynamic payload.
- Explicit URL/`popstate` unknown stories show `unknown-story`; stale persisted unknown stories fall through to the default.
- Cache successful `(storyId, normalizedLocale)` loads for the document session; deduplicate concurrent loads; do not retain rejected application promises.
- User-visible retry for a failed native module import is `location.reload()` at the preserved URL; do not add versioned/cache-busting imports.
- Register lifecycle listeners and allocate a generation before the first awaited initialization step; `destroy()` invalidates all pending work.
- Initial loading has no active payload. Replacement loading keeps the reader leaf mounted and inert beneath an accessible overlay.
- Locale is route-owned. Normalize `en`/`en-*` to `en` and `zh`/`zh-*` to `zh`; reject other language tags.
- Do not add package-wide `"sideEffects": false`, image loading, R2 work, compiler rewrites, or chapter splitting.
- Use `import type` for types and safe DOM construction (`textContent`, `replaceChildren`); never introduce `innerHTML`.
- Before/after bundle evidence must use the same `bun --filter web build` and gzip measurement method.

---

## File Structure

**Create:**

- `packages/stories/src/story-metadata.ts` — registered story IDs, supported locales, type guards.
- `packages/stories/src/async/errors.ts` — typed loader error.
- `packages/stories/src/async/loader.ts` — injectable cache/dedup loader factory.
- `packages/stories/src/async/registry.ts` — explicit per-story dynamic imports.
- `packages/stories/src/async/index.ts` — public async loader entry.
- `packages/stories/src/async/testing.ts` — test-only singleton cache reset.
- `packages/stories/src/async/__tests__/loader.test.ts` — loader behavior tests.
- `apps/web/src/lib/reader-intent.ts` — metadata-only intent selection and loaded-payload validation.
- `apps/web/src/lib/__tests__/reader-intent.test.ts` — initial/persisted/popstate intent tests.
- `apps/web/scripts/assert-story-chunks.ts` — Vite manifest graph assertion.
- `apps/web/scripts/measure-reader-bundles.ts` — stable raw/gzip bundle report.
- `packages/e2e/tests/reader-lazy-loading.spec.ts` — real request/reload/direct-link coverage.
- `docs/performance/2026-07-20-hpa-232-reader-bundles.md` — reproducible baseline/after report and chapter-split decision.

**Modify:**

- `packages/stories/package.json`, `src/index.ts`, `src/stories/index.ts` — public subpaths and typed sync registry completeness.
- `eslint.config.mjs` — web-wide ban on root value imports with type imports allowed.
- `apps/web/src/lib/utils.ts`, `bookmarks-manager.ts`, reader components/pages, and other web translation consumers — use `@aquila/stories/translations`.
- `apps/web/src/lib/story-types.ts` and tests — registry parity with package IDs.
- `apps/web/src/lib/reader-session.ts` and tests — retain serialization/bounds primitives; remove combined precedence ownership.
- `apps/web/src/lib/reader-state.svelte.ts` — active flow and load state.
- `apps/web/src/lib/reader-manager.ts`, SSR/unit tests, and `pages/[locale]/reader.astro` — asynchronous lifecycle, stale guards, reload retry.
- `apps/web/src/components/ReaderShell.svelte` and tests — standalone initial state versus replacement overlays.
- `apps/web/src/lib/act-navigation.ts`, `ActPanel.svelte`, `MobileActDrawer.svelte`, leaf readers, and tests — thread loaded flow instead of importing it.
- `apps/web/astro.config.mjs`, `apps/web/package.json` — emit manifest and run assertion.
- Existing package/game/desktop tests — compatibility verification only unless an actual break is found.

---

### Task 1: Record the untouched baseline and add stable size measurement

**Files:**

- Create: `apps/web/scripts/measure-reader-bundles.ts`
- Create: `packages/e2e/scripts/measure-reader-runtime.ts`
- Modify: `packages/e2e/package.json`
- Create: `docs/performance/2026-07-20-hpa-232-reader-bundles.md`

**Interfaces:**

- Produces: `bun apps/web/scripts/measure-reader-bundles.ts` JSON containing every client JS file's raw and gzip bytes plus totals.
- Produces: `bun --filter e2e measure:reader` JSON with five cold runs per desktop/mobile profile, selected-story resource duration, and Chrome `ScriptDuration` delta.
- Produces: the immutable before measurement used again in Task 10.

- [ ] **Step 1: Add the measurement script**

```ts
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const assetDir = path.resolve(import.meta.dir, '../dist/client/_astro');
const names = (await readdir(assetDir)).filter(name => name.endsWith('.js')).sort();
const files = await Promise.all(
    names.map(async name => {
        const bytes = await readFile(path.join(assetDir, name));
        return { name, rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength };
    })
);
const totals = files.reduce(
    (sum, file) => ({ rawBytes: sum.rawBytes + file.rawBytes, gzipBytes: sum.gzipBytes + file.gzipBytes }),
    { rawBytes: 0, gzipBytes: 0 }
);
process.stdout.write(`${JSON.stringify({ files, totals }, null, 2)}\n`);
```

- [ ] **Step 2: Reproduce the clean baseline**

Run:

```bash
bun --filter web build
bun apps/web/scripts/measure-reader-bundles.ts
```

Expected: build passes; output contains `index.BMyVFRi0.js` at `9524129` raw bytes and approximately `2045240` gzip bytes (hash/gzip byte count may vary only if the checkout or compressor changed; record any deviation rather than editing source).

- [ ] **Step 3: Add and run the browser measurement harness**

The runtime script launches Chromium, uses a new context per run, enables the CDP `Performance` domain, and records the `ScriptDuration` delta from immediately before navigation until `.novel-reader, .mobile-reader` appears. That selector exists both before and after HPA-232, keeping the method comparable. For the mobile profile, use Playwright's Pixel 5 device, `Emulation.setCPUThrottlingRate({ rate: 4 })`, and `Network.emulateNetworkConditions` with `latency: 150`, `downloadThroughput: 200_000`, and `uploadThroughput: 75_000`. Record five runs, compute medians with a numeric sort, and include every JavaScript response URL and resource duration observed before readiness. Keep the fixed route and profile values as named constants in the script so the before/after command is identical. Add:

```json
"measure:reader": "bun scripts/measure-reader-runtime.ts"
```

Start the server in one terminal with `bun run dev:web`, then run `bun --filter e2e measure:reader` in another. Expected: JSON contains `desktop.runs`, `desktop.medianScriptDurationMs`, `mobile.runs`, `mobile.medianScriptDurationMs`, and story-module resource URLs/durations.

- [ ] **Step 4: Write the baseline report**

Create the report with these headings and values:

```markdown
# HPA-232 Reader Bundle Measurements

## Method

- Checkout: pre-implementation commit `b7d541c`
- Build: `bun --filter web build`
- Size command: `bun apps/web/scripts/measure-reader-bundles.ts`
- Network route: `/en/reader?story=the_seventh_mirror&scene=ch1_act1&dialogue=1`
- Cache: fresh browser context for every cold run
- Desktop: Playwright Desktop Chrome
- Mobile: Playwright Pixel 5 with the documented CPU/network profile

## Before

- Shared `index.BMyVFRi0.js`: 9,524,129 raw bytes; 2,045.24 kB gzip (Vite report)
- Unselected story behavior: all registered story payloads are part of the same eager shared chunk

```

Append the exact JSON emitted by both measurement commands under `## Before raw data`; do not manually transcribe or round those fields.

- [ ] **Step 5: Verify and commit**

Run: `git diff --check`

Expected: no whitespace errors.

```bash
git add apps/web/scripts/measure-reader-bundles.ts packages/e2e/scripts/measure-reader-runtime.ts packages/e2e/package.json docs/performance/2026-07-20-hpa-232-reader-bundles.md
git commit -m "docs(perf): record HPA-232 reader bundle baseline"
```

---

### Task 2: Build the typed async story loader

**Files:**

- Create: `packages/stories/src/story-metadata.ts`
- Create: `packages/stories/src/async/errors.ts`
- Create: `packages/stories/src/async/loader.ts`
- Create: `packages/stories/src/async/registry.ts`
- Create: `packages/stories/src/async/index.ts`
- Create: `packages/stories/src/async/testing.ts`
- Create: `packages/stories/src/async/__tests__/loader.test.ts`
- Modify: `packages/stories/src/stories/index.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**

- Produces: `REGISTERED_STORY_IDS`, `RegisteredStoryId`, `isRegisteredStoryId()`.
- Produces: `StoryLocaleInput = string`, `normalizeStoryLocale(input): Locale`.
- Produces: `StoryLoadError` with code `unknown-story | unsupported-locale | load-failed`.
- Produces: `loadStoryContent(storyId, locale): Promise<AsyncStoryLoaderResult>` where result is `{ dialogue, choices, flow, locale }`.
- Produces: `@aquila/stories/async/testing` → `resetStoryContentCacheForTests()`.

- [ ] **Step 1: Write failing metadata and loader tests**

Create tests covering this exact behavior:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { StoryFlowConfig, StoryLoaderResult } from '../../stories';
import { createStoryContentLoader } from '../loader';
import { StoryLoadError } from '../errors';

const flow = { start: 'act1', nodes: [] } as StoryFlowConfig;
const payload: StoryLoaderResult = { dialogue: { act1: [{ dialogue: 'line' }] }, choices: {} };
const importer = vi.fn(async () => ({ ...payload, flow }));

it('deduplicates concurrent requests and caches success by normalized locale', async () => {
    const loader = createStoryContentLoader({ train_adventure: importer });
    const [a, b] = await Promise.all([
        loader.load('train_adventure', 'EN-us'),
        loader.load('train_adventure', 'en'),
    ]);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.locale).toBe('en');
});

it('removes rejected promises so application state is not poisoned', async () => {
    const retrying = vi.fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ ...payload, flow });
    const loader = createStoryContentLoader({ train_adventure: retrying });
    await expect(loader.load('train_adventure', 'en')).rejects.toMatchObject({ code: 'load-failed' });
    await expect(loader.load('train_adventure', 'en')).resolves.toMatchObject({ locale: 'en' });
    expect(retrying).toHaveBeenCalledTimes(2);
});

it('rejects unknown stories and unsupported locales explicitly', async () => {
    const loader = createStoryContentLoader({ train_adventure: importer });
    await expect(loader.load('missing', 'en')).rejects.toEqual(expect.objectContaining({ code: 'unknown-story' }));
    await expect(loader.load('train_adventure', 'fr')).rejects.toEqual(expect.objectContaining({ code: 'unsupported-locale' }));
    expect(StoryLoadError).toBeDefined();
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `bun --filter @aquila/stories test src/async/__tests__/loader.test.ts`

Expected: FAIL because the async modules do not exist.

- [ ] **Step 3: Implement metadata, errors, and the loader factory**

Use these contracts:

```ts
// story-metadata.ts
import type { Locale } from './translations';
export const REGISTERED_STORY_IDS = ['train_adventure', 'dont_save_me_before_midnight', 'the_seventh_mirror'] as const;
export type RegisteredStoryId = (typeof REGISTERED_STORY_IDS)[number];
export type StoryLocaleInput = string;
export const isRegisteredStoryId = (value: string): value is RegisteredStoryId =>
    (REGISTERED_STORY_IDS as readonly string[]).includes(value);
export function normalizeStoryLocale(value: StoryLocaleInput): Locale | null {
    const normalized = value.toLowerCase();
    if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh';
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
    return null;
}
```

```ts
// async/errors.ts
export type StoryLoadErrorCode = 'unknown-story' | 'unsupported-locale' | 'load-failed';
export class StoryLoadError extends Error {
    constructor(public readonly code: StoryLoadErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'StoryLoadError';
    }
}
```

`createStoryContentLoader()` keeps separate `Map<string, Promise<...>>` and successful result maps, deletes the in-flight entry in `finally`, wraps importer failures as `load-failed`, and exposes `{ load, reset }`. Importer keys use `satisfies Partial<Record<RegisteredStoryId, StoryPayloadImporter>>`; the production registry uses the complete `Record`.

- [ ] **Step 4: Implement explicit production imports**

`registry.ts` must spell out all imports so Vite sees three boundaries:

```ts
export const storyImporters = {
    train_adventure: async (locale) => {
        const module = await import('../stories/trainAdventure');
        return { ...module.getTrainAdventureStory(locale), flow: module.trainAdventureFlow };
    },
    dont_save_me_before_midnight: async (locale) => {
        const module = await import('../stories/dontSaveMeBeforeMidnight');
        return { ...module.getDontSaveMeBeforeMidnightStory(locale), flow: module.dontSaveMeBeforeMidnightFlow };
    },
    the_seventh_mirror: async (locale) => {
        const module = await import('../stories/theSeventhMirror');
        return { ...module.getTheSeventhMirrorStory(locale), flow: module.theSeventhMirrorFlow };
    },
} satisfies Record<RegisteredStoryId, StoryPayloadImporter>;
```

Create one singleton from the factory; export `loadStoryContent` publicly and only its `reset` through `async/testing.ts`.

- [ ] **Step 5: Type the synchronous registries against the same IDs**

Change `storyLoaders` and `storyFlows` to `satisfies Record<RegisteredStoryId, ...>` without changing synchronous fallback behavior.

- [ ] **Step 6: Export package subpaths**

Add these exact entries:

```json
"./async": "./src/async/index.ts",
"./async/testing": "./src/async/testing.ts",
"./translations": "./src/translations/index.ts"
```

- [ ] **Step 7: Verify and commit**

Run:

```bash
bun --filter @aquila/stories test src/async/__tests__/loader.test.ts
bun --filter @aquila/stories typecheck
```

Expected: loader tests and typecheck PASS.

```bash
git add packages/stories/src/story-metadata.ts packages/stories/src/async packages/stories/src/stories/index.ts packages/stories/package.json
git commit -m "feat(stories): add cached async story loader"
```

---

### Task 3: Enforce lightweight web imports and registry parity

**Files:**

- Modify: `eslint.config.mjs`
- Modify: `apps/web/src/lib/utils.ts`, `bookmarks-manager.ts`, `reader-manager.ts`, `act-navigation.ts`
- Modify: `apps/web/src/components/NovelReader.svelte`, `MobileNovelReader.svelte`, `MobileBacklogSheet.svelte`, `ActPanel.svelte`, `BulkActionBar.svelte`, `MainMenu.svelte`, `MobileActDrawer.svelte`
- Modify: `apps/web/src/pages/[locale]/reader.astro`, `characters.astro`, `apps/web/src/pages/api/character-setup.ts`
- Modify: `apps/web/src/lib/story-types.ts`
- Test: `apps/web/src/lib/__tests__/story-types.test.ts`
- Test: existing translation/component/manager tests affected by mocks.

**Interfaces:**

- Consumes: `@aquila/stories/translations`, `@aquila/stories/async`, and type-only root imports.
- Produces: zero web value imports from the eager root; parity assertion between web `StoryId` and `REGISTERED_STORY_IDS`.

- [ ] **Step 1: Add a failing registry parity test**

```ts
import { REGISTERED_STORY_IDS } from '@aquila/stories/async';
expect([...REGISTERED_STORY_IDS].sort()).toEqual(Object.values(StoryId).sort());
```

Expected before exports/import changes: test resolution fails.

- [ ] **Step 2: Migrate all web translation value imports**

Run `rg -n "from ['\"]@aquila/stories['\"]" apps/web/src`, then apply this split everywhere:

```ts
import { getTranslations } from '@aquila/stories/translations';
import type { Locale, DialogueEntry, ChoiceDefinition } from '@aquila/stories';
```

`utils.ts` imports `translations` from the translation subpath. `reader-manager.ts` imports `loadStoryContent` and loader types/errors from the async subpath. Remove `getStoryContent` and `getStoryFlow` from all web runtime imports.

- [ ] **Step 3: Add the lint boundary**

Add an ESLint flat-config block for `apps/web/src/**/*.{ts,svelte,astro}`:

```js
rules: {
  '@typescript-eslint/no-restricted-imports': ['error', {
    paths: [{
      name: '@aquila/stories',
      message: 'Use @aquila/stories/async or /translations for runtime values; root imports must be type-only.',
      allowTypeImports: true,
    }],
  }],
}
```

- [ ] **Step 4: Verify the boundary and tests**

Run:

```bash
bun --filter web test src/lib/__tests__/story-types.test.ts src/lib/__tests__/utils.test.ts src/lib/__tests__/bookmarks-manager.test.ts
bun --filter web lint
rg -n "import (?!type).*from ['\"]@aquila/stories['\"]" apps/web/src --pcre2
```

Expected: tests/lint PASS; final search prints no matches.

- [ ] **Step 5: Commit**

```bash
git add eslint.config.mjs apps/web/src
git commit -m "refactor(web): isolate lightweight story imports"
```

---

### Task 4: Split metadata-only intent selection from loaded validation

**Files:**

- Create: `apps/web/src/lib/reader-intent.ts`
- Create: `apps/web/src/lib/__tests__/reader-intent.test.ts`
- Modify: `apps/web/src/lib/reader-session.ts`
- Modify: `apps/web/src/lib/__tests__/reader-session.test.ts`

**Interfaces:**

- Produces: `ReaderIntent`, `selectReaderIntent()`, `validateLoadedIntent()`.
- Produces result unions `IntentSelection` (`load | unknown-story`) and `LoadedIntentResult` (`apply | soft-reject | fallback-default`).
- Preserves: `parseDialogueParam`, `clampIndex`, `sceneExists`, persistence migration and URL serialization in `reader-session.ts`.

- [ ] **Step 1: Write failing intent tests**

Use a two-scene flow and assert:

```ts
expect(selectReaderIntent(new URLSearchParams('story=missing'), null, 'en', deps))
    .toEqual({ kind: 'unknown-story', storyId: 'missing', locale: 'en' });

expect(selectReaderIntent(new URLSearchParams(), staleUnknownPersisted, 'en', deps))
    .toMatchObject({ kind: 'load', intent: { source: 'default', storyId: 'train_adventure' } });

expect(validateLoadedIntent(urlIntentWithMissingScene, payload, 'initial'))
    .toMatchObject({ kind: 'apply', state: { sceneId: 'act1', dialogueIndex: 0 } });

expect(validateLoadedIntent(urlIntentWithMissingScene, payload, 'popstate'))
    .toEqual({ kind: 'soft-reject' });

expect(validateLoadedIntent(invalidPersistedIntent, payload, 'initial'))
    .toEqual({ kind: 'fallback-default' });
```

Also cover malformed dialogue: initial → index 0/application; popstate → soft reject.

- [ ] **Step 2: Run RED**

Run: `bun --filter web test src/lib/__tests__/reader-intent.test.ts`

Expected: FAIL because `reader-intent.ts` does not exist.

- [ ] **Step 3: Implement explicit intent/result types**

```ts
export type ReaderIntentSource = 'url' | 'persisted' | 'default';
export interface ReaderIntent {
    source: ReaderIntentSource;
    storyId: string;
    requestedSceneId: string | null;
    requestedDialogueIndex: number | null;
    malformedDialogue: boolean;
    locale: Locale;
}
export type IntentSelection =
    | { kind: 'load'; intent: ReaderIntent }
    | { kind: 'unknown-story'; storyId: string; locale: Locale };
export type LoadedIntentResult =
    | { kind: 'apply'; state: ReaderSessionState }
    | { kind: 'soft-reject' }
    | { kind: 'fallback-default' };
```

`selectReaderIntent()` checks explicit URL IDs first, filters persisted locale/registered ID without reading a flow, and otherwise returns the default. `validateLoadedIntent()` owns `flow.start`, `sceneExists`, dialogue lookup, and index clamping.

- [ ] **Step 4: Remove combined precedence from `resolveInitialState`**

Delete or stop exporting `resolveInitialState`; keep its reusable pure primitives. Update old tests to target the new selector/validator instead of maintaining two precedence implementations.

- [ ] **Step 5: Verify and commit**

Run:

```bash
bun --filter web test src/lib/__tests__/reader-session.test.ts src/lib/__tests__/reader-intent.test.ts
```

Expected: both suites PASS.

```bash
git add apps/web/src/lib/reader-intent.ts apps/web/src/lib/reader-session.ts apps/web/src/lib/__tests__/reader-intent.test.ts apps/web/src/lib/__tests__/reader-session.test.ts
git commit -m "refactor(reader): split intent selection from loaded validation"
```

---

### Task 5: Thread the loaded flow through act navigation

**Files:**

- Modify: `apps/web/src/lib/act-navigation.ts`
- Modify: `apps/web/src/components/ActPanel.svelte`
- Modify: `apps/web/src/components/MobileActDrawer.svelte`
- Modify: `apps/web/src/components/NovelReader.svelte`
- Modify: `apps/web/src/components/MobileNovelReader.svelte`
- Test: `apps/web/src/lib/__tests__/act-navigation.test.ts`
- Test: `apps/web/src/components/__tests__/ActPanel.test.ts`
- Test: `apps/web/src/components/__tests__/MobileActDrawer.test.ts`
- Test: `apps/web/src/components/__tests__/NovelReader.test.ts`
- Test: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**

- Changes: `buildChapterData(flow, sceneId, translations)`; removes `storyId` lookup.
- Adds: `flow: StoryFlowConfig` reader/act-panel prop.

- [ ] **Step 1: Update tests first**

Replace `getStoryFlow` mocks with direct fixtures:

```ts
const data = buildChapterData(branchFlow, 'b1a_act1', t);
render(ActPanel, { props: { flow: chaptersFlow, storyId: 's', currentSceneId: 'ch1_act1', ...callbacks } });
render(MobileActDrawer, { props: { flow: branchFlow, storyId: 's', currentSceneId: 'act1', ...callbacks } });
```

- [ ] **Step 2: Run RED**

Run:

```bash
bun --filter web test src/lib/__tests__/act-navigation.test.ts src/components/__tests__/ActPanel.test.ts src/components/__tests__/MobileActDrawer.test.ts
```

Expected: FAIL because current APIs still accept `storyId` and import `getStoryFlow`.

- [ ] **Step 3: Change implementation and props**

Implement:

```ts
export function buildChapterData(flow: Pick<StoryFlowConfig, 'nodes'>, sceneId: string, t: Translations): PanelData {
    return flow.nodes.some(node => node.kind === 'scene' && /^ch\d+_/.test(node.sceneId))
        ? buildChapters(flow, t)
        : buildBranches(flow, sceneId, t);
}
```

Forward the same `activeFlow` from `ReaderShell` into both leaf readers and then their act panels/drawers. Remove the `getStoryFlow` value import everywhere in this path.

- [ ] **Step 4: Verify and commit**

Run the three focused suites plus `NovelReader.test.ts` and `MobileNovelReader.test.ts`; expect PASS.

```bash
git add apps/web/src/lib/act-navigation.ts apps/web/src/components apps/web/src/lib/__tests__/act-navigation.test.ts
git commit -m "refactor(reader): use loaded flow for act navigation"
```

---

### Task 6: Add reactive load state and non-unmounting overlays

**Files:**

- Modify: `apps/web/src/lib/reader-state.svelte.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`
- Test: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**

- Produces: `loadStatus`, `loadError`, `hasActivePayload`, `activeFlow` on `readerState`.
- Reuses `reader.retry`; adds `loadingStory`, `storyLoadFailed`, `unknownStory`, `unsupportedLocale`, `backToStories`.

- [ ] **Step 1: Write failing ReaderShell tests**

Add cases that assert:

```ts
readerState.loadStatus = 'loading';
readerState.hasActivePayload = false;
expect(screen.getByRole('status')).toHaveTextContent('Loading story');
expect(screen.queryByTestId('reader-ready')).not.toBeInTheDocument();

readerState.hasActivePayload = true;
readerState.activeFlow = flow;
// rerender/reactive tick
expect(screen.getByTestId('reader-ready')).toBeInTheDocument();
expect(screen.getByRole('status')).toBeInTheDocument();
expect(screen.getByTestId('reader-ready')).toHaveAttribute('inert');

readerState.loadStatus = 'error';
readerState.loadError = new StoryLoadError('load-failed', 'failed');
expect(screen.getByRole('alert')).toBeInTheDocument();
```

- [ ] **Step 2: Run RED**

Run: `bun --filter web test src/components/__tests__/ReaderShell.test.ts`

Expected: FAIL because load state and surfaces do not exist.

- [ ] **Step 3: Extend and reset the store**

```ts
loadStatus: ReaderLoadStatus = $state('idle');
loadError: StoryLoadError | null = $state(null);
hasActivePayload = $state(false);
activeFlow: StoryFlowConfig | null = $state(null);
```

`reset()` restores all four values. Import runtime translations only from the translation subpath and loader types with `import type`.

- [ ] **Step 4: Implement two-axis rendering**

Render the leaf inside a stable `data-testid="reader-ready"` wrapper whenever `hasActivePayload`; apply `inert` and `aria-hidden` while replacement loading/error is blocking it. Render an absolute overlay for loading/error without changing the leaf branch. When no payload exists, render only the standalone loading/error surface.

Retry callback is a prop from `ReaderManager`; back-to-stories uses `/${locale}/stories`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
bun --filter web test src/components/__tests__/ReaderShell.test.ts
bun --filter @aquila/stories test src/__tests__/translations.test.ts
```

Expected: PASS.

```bash
git add apps/web/src/lib/reader-state.svelte.ts apps/web/src/components/ReaderShell.svelte apps/web/src/components/__tests__/ReaderShell.test.ts packages/stories/src/translations
git commit -m "feat(reader): render accessible story load states"
```

---

### Task 7: Convert `ReaderManager` initialization to guarded async loading

**Files:**

- Modify: `apps/web/src/lib/reader-manager.ts`
- Modify: `apps/web/src/pages/[locale]/reader.astro`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager-ssr.test.ts`

**Interfaces:**

- `initialize(): Promise<void>` mounts/listens/allocates before awaiting.
- Constructor accepts optional injected loader/metadata dependencies for tests.
- Private `activeStory`, `pendingIntent`, `loadGeneration`, `destroyed`, and memoized `readerMountPromise` own runtime orchestration.

- [ ] **Step 1: Replace eager mocks with an injected deferred loader**

Add a helper:

```ts
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}
```

Write tests proving: shell mount and listeners happen before loader resolution; the store is empty/loading; resolving applies exact deep-link index; stale persisted unknown loads only default; pagehide before ready does not persist; `destroy()` before resolution prevents application.

- [ ] **Step 2: Run focused RED tests**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-ssr.test.ts`

Expected: new async lifecycle tests FAIL against the synchronous manager.

- [ ] **Step 3: Implement initialization order**

Use this order exactly:

```ts
async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    this.destroyed = false;
    this.addLifecycleListeners();
    const generation = ++this.loadGeneration;
    await this.renderReader();
    if (!this.isCurrent(generation)) return;
    await this.loadIntent(this.selectInitialIntent(), 'initial', generation);
}
```

`renderReader()` memoizes its dynamic import promise so initial `popstate` and initialization await the same mount. Expected loader failures are converted to `readerState.loadStatus = 'error'`; unexpected boundary failures are caught in `reader.astro`:

```ts
void manager.initialize().catch(error => console.error('Reader initialization failed', error));
```

- [ ] **Step 4: Implement payload application and fallback**

On success, set `activeStory`, then atomically set `readerState.activeFlow`, story/scene/index/locale, current scene dialogue/choice, `canGoNext`, `hasActivePayload=true`, `loadStatus='ready'`, and `loadError=null`. Only afterward sync URL and persist.

If persisted validation returns `fallback-default`, start a guarded default load. Do not persist initial empty state.

- [ ] **Step 5: Implement destruction guards**

`destroy()` sets `destroyed=true`, increments `loadGeneration`, removes listeners/timers, and unmounts any shell that eventually mounted. `isCurrent(generation)` checks both generation equality and `!destroyed`.

- [ ] **Step 6: Verify and commit**

Run focused tests and `bun --filter web test src/lib/__tests__/reader-session.test.ts`; expect PASS.

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/pages/'[locale]'/reader.astro apps/web/src/lib/__tests__/reader-manager*.test.ts
git commit -m "feat(reader): load initial story asynchronously"
```

---

### Task 8: Make navigation, `popstate`, races, and retry deterministic

**Files:**

- Modify: `apps/web/src/lib/reader-manager.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`

**Interfaces:**

- Produces: one `loadIntent(intent, mode, generation?)` generation-guarded path for initial, story navigation, and popstate.
- Retry callback performs `window.location.reload()`.
- Same-story scene navigation remains synchronous over `activeStory`.

- [ ] **Step 1: Add failing race/recovery tests**

Cover these exact sequences:

1. Start A, dispatch `popstate` to B before A resolves, resolve A then B → only B applies.
2. Ready B, `popstate` to cached A → A applies without a second importer call.
3. Ready A, `popstate` to B rejects → URL stays B, A remains mounted/inert, error is `load-failed`, persistence remains A.
4. Clicking Retry calls `location.reload()` exactly once.
5. While failed at B, another `popstate` to A supersedes B and clears its overlay.
6. Unknown explicit `popstate` shows `unknown-story`; malformed/stale known-story popstate soft-rejects and reconverges to A.
7. Breakpoint/presentation remount and same-story scene navigation do not call the loader.

- [ ] **Step 2: Run RED**

Run: `bun --filter web test src/lib/__tests__/reader-manager.test.ts`

Expected: race/replacement tests FAIL.

- [ ] **Step 3: Implement generation-guarded navigation**

When no generation is supplied by initialization, every async intent begins with:

```ts
const generation = ++this.loadGeneration;
this.pendingIntent = intent;
readerState.loadStatus = 'loading';
readerState.loadError = null;
const payload = await this.deps.loadStoryContent(intent.storyId, intent.locale);
if (!this.isCurrent(generation)) return;
```

Apply or soft-reject only after validation. On expected failure, keep `pendingIntent`, set error status, and never touch active payload/persistence. `onPopState` must call the async handler with `void` after immediately cancelling pending URL writes.

- [ ] **Step 4: Keep ready-state helpers synchronous**

`getSceneNode`, `getSceneData`, `getLinearNextScene`, `goToScene`, choices, bookmarks, and next-scene behavior read only `activeStory`. Guard them when no active payload exists.

- [ ] **Step 5: Verify and commit**

Run the ReaderManager, ReaderShell, NovelReader, and MobileNovelReader suites; expect PASS.

```bash
git add apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-manager.test.ts
git commit -m "feat(reader): guard async story navigation races"
```

---

### Task 9: Enforce production chunk boundaries from the Vite manifest

**Files:**

- Create: `apps/web/scripts/assert-story-chunks.ts`
- Modify: `apps/web/astro.config.mjs`
- Modify: `apps/web/package.json`
- Test: build itself is the test.

**Interfaces:**

- Produces: `dist/client/.vite/manifest.json`.
- Produces: a post-build assertion that traverses static imports by manifest key and fails on eager/cross-story dialogue edges.

- [ ] **Step 1: Enable manifest output and wire the assertion**

Add under `vite`:

```js
build: { manifest: true },
```

Append `&& bun scripts/assert-story-chunks.ts` to the existing web `build` script after `astro build`.

- [ ] **Step 2: Implement the assertion script**

Parse `dist/client/.vite/manifest.json`. Locate the reader client entry by source/key containing `pages/[locale]/reader.astro`. Traverse each entry's `imports` recursively. Assert the reader static closure contains neither `/src/stories/index.ts` nor `/src/generated/` dialogue modules.

For these sources:

```ts
const stories = [
  'stories/trainAdventure/index.ts',
  'stories/dontSaveMeBeforeMidnight/index.ts',
  'stories/theSeventhMirror/index.ts',
];
```

assert each appears as a dynamic entry reachable from the async registry and each static closure excludes the other two story sources. Print a concise mapping of story source → emitted file on success. Throw with the offending import chain on failure.

- [ ] **Step 3: Run the production proof**

Run: `bun --filter web build`

Expected: build PASS; assertion prints three distinct story dynamic entries, and the former 9.52 MB eager shared chunk is absent from the reader static graph.

- [ ] **Step 4: Commit**

```bash
git add apps/web/astro.config.mjs apps/web/package.json apps/web/scripts/assert-story-chunks.ts
git commit -m "test(build): enforce lazy story chunk boundaries"
```

---

### Task 10: Add real-browser network, retry, and direct-link coverage

**Files:**

- Create: `packages/e2e/tests/reader-lazy-loading.spec.ts`
- Modify: `packages/e2e/tests/utils.ts` only for reusable reader-ready/load-error locators.

**Interfaces:**

- Verifies Vite dev requests select only one story module.
- Verifies aborted dynamic import → reload Retry → exact URL/session restoration.

- [ ] **Step 1: Add selected/unselected request coverage**

Record script/module request URLs before navigation, open The Seventh Mirror direct link, wait for `[data-testid="reader-ready"]`, and assert URLs contain `theSeventhMirror` but not `trainAdventure` or `dontSaveMeBeforeMidnight` story-module paths.

- [ ] **Step 2: Add direct-link restoration**

Open `?story=the_seventh_mirror&scene=ch1_act1&dialogue=3`; assert canonical URL remains on that story/scene/dialogue and the active reader progress exposes line 3. Use a test ID/accessible progress label rather than story prose.

- [ ] **Step 3: Add one-shot failure and reload retry**

```ts
let aborted = false;
await page.route(/theSeventhMirror/, async route => {
    if (!aborted) { aborted = true; await route.abort(); }
    else await route.continue();
});
await page.goto('/en/reader?story=the_seventh_mirror&scene=ch1_act1&dialogue=3');
await expect(page.getByRole('alert')).toBeVisible();
await page.getByRole('button', { name: 'Retry' }).click();
await expect(page.getByTestId('reader-ready')).toBeVisible();
await expect(page).toHaveURL(/story=the_seventh_mirror.*scene=ch1_act1.*dialogue=3/);
```

- [ ] **Step 4: Add same-story no-redownload and rapid-popstate coverage**

Count The Seventh Mirror module requests, navigate acts within the loaded story, and assert the count remains one. Push/dispatch A→B→A history events quickly and assert the final ready story matches the latest URL.

- [ ] **Step 5: Run and commit**

Run:

```bash
bun --filter e2e test:e2e tests/reader-lazy-loading.spec.ts --project=chromium
```

Expected: all new tests PASS.

```bash
git add packages/e2e/tests/reader-lazy-loading.spec.ts packages/e2e/tests/utils.ts
git commit -m "test(e2e): cover lazy story loading and retry"
```

---

### Task 11: Compatibility verification, after measurements, and chapter decision

**Files:**

- Modify: `docs/performance/2026-07-20-hpa-232-reader-bundles.md`
- Conditional external action: create one Linear follow-up only when the measured threshold is exceeded.

**Interfaces:**

- Produces: final before/after evidence and explicit chapter-splitting decision.
- Preserves: synchronous game/desktop behavior.

- [ ] **Step 1: Run focused and compatibility verification**

```bash
bun compile:check
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter web test
bun --filter @aquila/game test
bun --filter @aquila/game typecheck
bun --filter desktop test
bun --filter desktop check
bun --filter web lint
bun --filter web build
bun --filter e2e test:e2e tests/reader-lazy-loading.spec.ts --project=chromium
git diff --check
```

Expected: every command PASS; compile check produces no generated-story drift.

- [ ] **Step 2: Repeat size measurement**

Run: `bun apps/web/scripts/measure-reader-bundles.ts`

Record initial reader static bytes, shared bytes, and each selected story chunk raw/gzip bytes in the report. Include the manifest mapping printed by Task 9.

- [ ] **Step 3: Capture desktop/mobile cold-load evidence**

Use fresh browser contexts for repeated The Seventh Mirror direct loads. Record request list, load duration, and scripting/parse measurements for Desktop Chrome and Pixel 5 throttling. Record the median and number of runs. Separately measure the invalid-persisted-session two-load recovery without mixing it into the normal median.

- [ ] **Step 4: Apply the chapter-split gate**

If The Seventh Mirror exceeds either 500 kB gzip or 200 ms median mobile scripting/parse time, create a Linear follow-up under HPA-216 containing the report link, emitted chunk evidence, timings, and proposed chapter boundaries. Otherwise write: “Chapter-level splitting is unnecessary under the HPA-232 thresholds.”

- [ ] **Step 5: Update HPA-232 evidence and commit**

Add the final command outputs, before/after table, request proof, and decision to the report. Add a Linear comment to HPA-232 summarizing the same evidence and linking any follow-up.

```bash
git add docs/performance/2026-07-20-hpa-232-reader-bundles.md
git commit -m "docs(perf): report lazy story bundle results"
```

---

## Final Review Gate

- [ ] Compare every HPA-232 acceptance criterion with a passing test, manifest assertion, or report row.
- [ ] Run `git status --short` and confirm only intentional committed changes remain.
- [ ] Request a whole-branch code review against `main`.
- [ ] Fix only verified findings, rerun the affected focused tests, then repeat the full verification commands above.
