# HPA-228 Visual Novel Reader MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive Text / Visual Novel reader switch with a validated local asset resolver, bounded decoded-image cache, deterministic visual state, and complete `ch1_act2` fixtures without changing canonical story progression.

**Architecture:** `ReaderManager` continues owning loaded story payload and progression while `ReaderShell` owns device-local presentation mode and the retained visual runtime. The visual runtime is split into `WebAssetResolver`, `DecodedAssetCache`, and `VisualStateController`; `VisualNovelReader` is a controlled Svelte view over controller state. HPA-227 contracts remain authoritative for pointer, manifest, path, integrity, cache, timeout, and prefetch behavior.

**Tech Stack:** Bun 1.3.1 workspaces, TypeScript 5.9, Astro 5, Svelte 5 runes, Vitest, Testing Library, Playwright, Web Crypto, `createImageBitmap`, Blob URLs, and `sharp` 0.34.5 for checked-in fixture generation and verification.

## Global Constraints

- Prefix every repository command with `rtk`.
- Text is the default reader mode; persist `text | visual` only under `aquila:reader-mode:v1`.
- Never add reader mode, presentation metadata, or visual state to URL, bookmark, or persisted `ReaderSessionState`.
- HPA-234 remains the sole owner of story, scene, locale, dialogue index, URL, browser history, and bookmark progression.
- HPA-227 remains the sole contract for asset paths, manifests, active pointers, validation errors, portrait slots, timeouts, bounds, and prefetch depth.
- Pointer, manifest, and asset timeouts are exactly 5 seconds, 10 seconds, and 15 seconds.
- Cache bounds are exactly 48 decoded assets and 96 MiB of decoded pixels using `width * height * 4`.
- Store at most two validated releases; use `validatedAt` for the 24-hour stale limit and `lastUsedAt` for LRU eviction.
- Revalidate active pointers after 60 seconds only on approved lifecycle events; do not add a periodic timer.
- Prefetch at most one story-flow edge deep and at most two requests concurrently; never preload a whole scene, chapter, or story.
- Retain the previous decoded background until a replacement succeeds; failed portraits render as no portrait.
- Preserve source aspect ratio for every generated or rendered visual; never stretch width and height independently.
- Keep low-resolution placeholder rendering out of V1 while continuing to expose `placeholderUrl` from the resolver contract.
- Use `textContent` and Svelte interpolation for user-facing content; never use `innerHTML`.
- Add every user-facing string to both `packages/stories/src/translations/en.json` and `zh.json`.
- Do not edit generated story files; `compile:check` must finish with no generated-story drift.
- Keep fixture conversion and hashing narrowly scoped to HPA-228 test fixtures; do not create the production publisher owned by HPA-230.

---

## File Structure

### Reader integration

- Modify `apps/web/src/lib/reader-state.svelte.ts` — add transient presentation metadata.
- Modify `apps/web/src/lib/reader-manager.ts` — atomically assign presentation and expose guarded scene dialogue.
- Modify `apps/web/src/components/ReaderShell.svelte` — own mode preference, runtime lifecycle, and leaf selection.
- Modify `apps/web/src/components/NovelReader.svelte` — consume shared input helpers.
- Modify `apps/web/src/components/MobileNovelReader.svelte` — consume shared input helpers while retaining mobile chrome gates.
- Create `apps/web/src/lib/reader-interaction.ts` — pure advance and interactive-target decisions.
- Create `apps/web/src/lib/reader-mode.ts` — defensive device-local mode persistence.

### Visual runtime

- Create `apps/web/src/lib/visual-assets/types.ts` — release, layer, decoded-image, snapshot, and runtime interfaces.
- Create `apps/web/src/lib/visual-assets/hash.ts` — browser SHA-256 helpers.
- Create `apps/web/src/lib/visual-assets/validated-release-store.ts` — defensive two-record local persistence.
- Create `apps/web/src/lib/visual-assets/web-asset-resolver.ts` — HPA-227 browser resolver implementation.
- Create `apps/web/src/lib/visual-assets/source-factory.ts` — story-to-source and story-to-runtime factory.
- Create `apps/web/src/lib/visual-assets/decoded-asset-cache.ts` — byte verification, decode, Blob URL, deduplication, and eviction.
- Create `apps/web/src/lib/visual-assets/avif-probe.avif` — checked-in 1×1 AVIF capability probe.
- Create `apps/web/src/lib/visual-assets/prefetch-queue.ts` — two-request shared queue.
- Create `apps/web/src/lib/visual-assets/visual-state-controller.ts` — active-line state machines and one-edge lookahead.
- Create `apps/web/src/lib/visual-assets/index.ts` — narrow web-package exports.

### Visual presentation

- Create `apps/web/src/components/VisualNovelReader.svelte` — responsive cinematic controlled reader.
- Create `apps/web/src/components/VisualBacklog.svelte` — current-scene accessible backlog.

### Fixtures and verification

- Modify `apps/web/package.json` and `bun.lock` — direct `sharp` dependency and fixture scripts.
- Create `apps/web/scripts/build-visual-fixtures.ts` — deterministic four-object fixture generator.
- Create `apps/web/scripts/verify-visual-fixtures.ts` — independent bytes, dimensions, release, and coverage verification.
- Create `apps/web/src/lib/visual-assets/__fixtures__/release-plans/the-seventh-mirror.preview.v1.json` — exact four-object preview plan.
- Generate `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json`.
- Generate `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/{releaseId}/runtime-manifest.json`, where `releaseId` is computed by the generator.
- Generate four content-addressed files under `apps/web/public/assets/vn/objects/`.

### Tests

- Create `apps/web/src/lib/__tests__/reader-interaction.test.ts`.
- Modify `apps/web/src/lib/__tests__/reader-manager.test.ts`.
- Create tests under `apps/web/src/lib/visual-assets/__tests__/` for store, resolver, cache, queue, controller, and fixture scripts.
- Create `apps/web/src/components/__tests__/VisualBacklog.test.ts`.
- Create `apps/web/src/components/__tests__/VisualNovelReader.test.ts`.
- Modify `apps/web/src/components/__tests__/NovelReader.test.ts`.
- Modify `apps/web/src/components/__tests__/MobileNovelReader.test.ts`.
- Modify `apps/web/src/components/__tests__/ReaderShell.test.ts`.
- Modify `packages/e2e/playwright.config.ts`.
- Modify `packages/e2e/tests/utils.ts`.
- Create `packages/e2e/tests/reader-visual.spec.ts`.

---

### Task 1: Share Reader Input Decisions Without Changing Existing Behavior

**Files:**
- Create: `apps/web/src/lib/reader-interaction.ts`
- Create: `apps/web/src/lib/__tests__/reader-interaction.test.ts`
- Modify: `apps/web/src/components/NovelReader.svelte:1-255`
- Modify: `apps/web/src/components/MobileNovelReader.svelte:1-285`
- Modify: `apps/web/src/components/__tests__/NovelReader.test.ts`
- Modify: `apps/web/src/components/__tests__/MobileNovelReader.test.ts`

**Interfaces:**
- Produces: `getReaderAdvanceDecision(input): ReaderAdvanceDecision`
- Produces: `isReaderInteractiveTarget(target): boolean`
- Preserves: mobile overlay dismissal and chrome dismissal before shared advancement.

- [ ] **Step 1: Write failing helper tests**

```ts
// apps/web/src/lib/__tests__/reader-interaction.test.ts
import { describe, expect, it } from 'vitest';
import {
    getReaderAdvanceDecision,
    isReaderInteractiveTarget,
} from '@/lib/reader-interaction';

describe('getReaderAdvanceDecision', () => {
    it.each([
        [{ isTyping: true, index: 0, length: 2, canGoNext: true, hasChoice: false }, 'skip'],
        [{ isTyping: false, index: 0, length: 2, canGoNext: true, hasChoice: false }, 'advance-line'],
        [{ isTyping: false, index: 1, length: 2, canGoNext: true, hasChoice: false }, 'advance-scene'],
        [{ isTyping: false, index: 1, length: 2, canGoNext: true, hasChoice: true }, 'none'],
    ] as const)('returns %s', (input, expected) => {
        expect(getReaderAdvanceDecision(input)).toBe(expected);
    });
});

describe('isReaderInteractiveTarget', () => {
    it('recognizes controls, editable content, and marked descendants', () => {
        const root = document.createElement('div');
        const button = document.createElement('button');
        const buttonChild = document.createElement('span');
        button.append(buttonChild);
        const editor = document.createElement('div');
        editor.contentEditable = 'true';
        const marked = document.createElement('div');
        marked.dataset.readerInteractive = '';
        const markedChild = document.createElement('span');
        marked.append(markedChild);
        root.append(button, editor, marked);
        expect(isReaderInteractiveTarget(buttonChild)).toBe(true);
        expect(isReaderInteractiveTarget(editor)).toBe(true);
        expect(isReaderInteractiveTarget(markedChild)).toBe(true);
        expect(isReaderInteractiveTarget(root)).toBe(false);
    });
});
```

- [ ] **Step 2: Run the helper tests and verify the missing module failure**

Run: `rtk bun --filter web test src/lib/__tests__/reader-interaction.test.ts`

Expected: FAIL because `@/lib/reader-interaction` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```ts
// apps/web/src/lib/reader-interaction.ts
export type ReaderAdvanceDecision =
    | 'skip'
    | 'advance-line'
    | 'advance-scene'
    | 'none';

export type ReaderAdvanceInput = {
    isTyping: boolean;
    index: number;
    length: number;
    canGoNext: boolean;
    hasChoice: boolean;
};

export function getReaderAdvanceDecision(
    input: ReaderAdvanceInput
): ReaderAdvanceDecision {
    if (input.isTyping) return 'skip';
    if (input.index < input.length - 1) return 'advance-line';
    if (input.canGoNext && !input.hasChoice) return 'advance-scene';
    return 'none';
}

export function isReaderInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return (
        target.closest(
            'a,button,input,select,textarea,option,[contenteditable="true"],' +
                '[role="dialog"],[data-reader-interactive]'
        ) !== null
    );
}
```

- [ ] **Step 4: Route both existing readers through the helpers**

Use this decision switch in both readers:

```ts
const decision = getReaderAdvanceDecision({
    isTyping,
    index: dialogueIndex,
    length: dialogue.length,
    canGoNext,
    hasChoice: !!choice,
});
if (decision === 'skip') {
    skipTyping = true;
    return;
}
if (decision === 'advance-line') {
    selfAdvanceTarget = dialogueIndex + 1;
    onIndexChange(dialogueIndex + 1);
    return;
}
if (decision === 'advance-scene') onNext();
```

In `MobileNovelReader.advance()`, keep the existing checks in this order before the switch:

```ts
if (interactionDisabled) return;
if (hasOverlay) {
    if (backlogOpen) backlogOpen = false;
    else drawerOpen = false;
    return;
}
if (chromeVisible) {
    chromeVisible = false;
    return;
}
```

Replace each duplicated keyboard tag-name block with:

```ts
if (isReaderInteractiveTarget(event.target ?? document.activeElement)) return;
```

- [ ] **Step 5: Run focused and existing reader tests**

Run:

```bash
rtk bun --filter web test src/lib/__tests__/reader-interaction.test.ts
rtk bun --filter web test src/components/__tests__/NovelReader.test.ts
rtk bun --filter web test src/components/__tests__/MobileNovelReader.test.ts
```

Expected: PASS, including the existing mobile chrome-dismiss and overlay behavior.

- [ ] **Step 6: Commit the interaction foundation**

```bash
rtk git add apps/web/src/lib/reader-interaction.ts apps/web/src/lib/__tests__/reader-interaction.test.ts apps/web/src/components/NovelReader.svelte apps/web/src/components/MobileNovelReader.svelte apps/web/src/components/__tests__/NovelReader.test.ts apps/web/src/components/__tests__/MobileNovelReader.test.ts
rtk git commit -m "refactor(web): share reader interaction decisions"
```

---

### Task 2: Expose Presentation and Guarded Scene Dialogue

**Files:**
- Modify: `apps/web/src/lib/reader-state.svelte.ts:9-48`
- Modify: `apps/web/src/lib/reader-manager.ts:1-196,390-414,528-560`
- Modify: `apps/web/src/components/ReaderShell.svelte:8-43`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Produces: `readerState.presentation: StoryPresentationMetadata | null`
- Produces: `ReaderManager.getSceneDialogue(storyId, sceneId): readonly DialogueEntry[] | null`
- Supplies: stable `getSceneDialogue` prop to `ReaderShell`.

- [ ] **Step 1: Add failing ReaderManager lifecycle tests**

Add assertions that constructor/reset clear presentation, a successful load assigns it, a replacement failure preserves it, and inherited names are rejected:

```ts
it('assigns presentation with the active payload and guards dialogue lookup', async () => {
    const payload = storyPayload();
    mockLoadStoryContent.mockResolvedValue(payload);
    manager = new ReaderManager('en');
    await manager.initialize();

    expect(readerState.presentation).toBe(payload.presentation);
    expect(manager.getSceneDialogue('the_seventh_mirror', 'constructor')).toBeNull();
    expect(manager.getSceneDialogue('wrong_story', 'act1')).toBeNull();
});

it('clears stale presentation in a new manager constructor', () => {
    readerState.presentation = storyPayload().presentation;
    manager = new ReaderManager('en');
    expect(readerState.presentation).toBeNull();
});
```

Extend the existing replacement-load-failure test:

```ts
const activePresentation = readerState.presentation;
await dispatchReplacementThatRejects();
expect(readerState.presentation).toBe(activePresentation);
```

- [ ] **Step 2: Run the focused test and verify type/property failures**

Run: `rtk bun --filter web test src/lib/__tests__/reader-manager.test.ts`

Expected: FAIL because `readerState.presentation` and `getSceneDialogue` do not exist.

- [ ] **Step 3: Add presentation to the transient store**

```ts
import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
    StoryFlowConfig,
    StoryPresentationMetadata,
} from '@aquila/stories';

class ReaderState {
    presentation: StoryPresentationMetadata | null = $state(null);

    reset() {
        this.presentation = null;
    }
}
```

Keep the existing reset assignments and add `presentation = null` beside `activeFlow = null`.

- [ ] **Step 4: Assign presentation atomically and expose dialogue safely**

Add the constructor assignment:

```ts
readerState.activeFlow = null;
readerState.presentation = null;
```

Add the `applySession()` assignment immediately after `activeFlow`:

```ts
this.activeStory = payload;
readerState.activeFlow = payload.flow;
readerState.presentation = payload.presentation;
```

Add the public stable callback:

```ts
getSceneDialogue = (
    storyId: string,
    sceneId: string
): readonly DialogueEntry[] | null => {
    const story = this.activeStory;
    if (
        !story ||
        storyId !== readerState.storyId ||
        !Object.hasOwn(story.dialogue, sceneId)
    ) {
        return null;
    }
    return story.dialogue[sceneId] ?? null;
};
```

Use it inside `getSceneData()`:

```ts
const dialogue = [...(this.getSceneDialogue(storyId, sceneId) ?? [])];
```

Pass the stable callback when mounting `ReaderShell`:

```ts
getSceneDialogue: this.getSceneDialogue,
```

- [ ] **Step 5: Add the ReaderShell prop and bridge presentation**

Add:

```ts
getSceneDialogue = () => null,
```

with type:

```ts
getSceneDialogue?: (
    storyId: string,
    sceneId: string
) => readonly DialogueEntry[] | null;
```

Import `DialogueEntry`, derive `presentation`, and leave the new values unused until the visual runtime task:

```ts
let presentation = $derived(readerState.presentation);
```

- [ ] **Step 6: Run ReaderManager and ReaderShell tests**

Run:

```bash
rtk bun --filter web test src/lib/__tests__/reader-manager.test.ts
rtk bun --filter web test src/components/__tests__/ReaderShell.test.ts
```

Expected: PASS, including preserved payload behavior after replacement failure.

- [ ] **Step 7: Commit the payload bridge**

```bash
rtk git add apps/web/src/lib/reader-state.svelte.ts apps/web/src/lib/reader-manager.ts apps/web/src/components/ReaderShell.svelte apps/web/src/lib/__tests__/reader-manager.test.ts apps/web/src/components/__tests__/ReaderShell.test.ts
rtk git commit -m "feat(web): expose reader presentation metadata"
```

---

### Task 3: Build and Independently Verify the Local Visual Fixtures

**Files:**
- Modify: `apps/web/package.json`
- Modify: `bun.lock`
- Create: `apps/web/scripts/build-visual-fixtures.ts`
- Create: `apps/web/scripts/verify-visual-fixtures.ts`
- Create: `apps/web/src/lib/visual-assets/avif-probe.avif`
- Create: `apps/web/src/lib/visual-assets/__fixtures__/release-plans/the-seventh-mirror.preview.v1.json`
- Generate: `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json`
- Generate: `apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/{releaseId}/runtime-manifest.json`
- Generate: `apps/web/public/assets/vn/objects/{sha256}.webp` for four objects
- Test: `apps/web/src/lib/visual-assets/__tests__/visual-fixtures.test.ts`

**Interfaces:**
- Produces: `bun run build:visual-fixtures`
- Produces: `bun run verify:visual-fixtures`
- Produces: a valid preview release containing exactly two `ch1_act2` backgrounds and Mio/Yuma base portraits.

- [ ] **Step 1: Add the direct image-tool dependency and scripts**

Run:

```bash
rtk bun add --cwd apps/web --dev sharp@0.34.5
```

Add scripts:

```json
{
  "build:visual-fixtures": "bun scripts/build-visual-fixtures.ts",
  "verify:visual-fixtures": "bun scripts/verify-visual-fixtures.ts"
}
```

- [ ] **Step 2: Check in the exact preview release plan**

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "channel": "preview",
  "entries": [
    {
      "identity": { "type": "background", "key": "chapter_1/ch1_act2_s0" },
      "disposition": "included",
      "sourcePath": "the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png",
      "section": "chapter_1"
    },
    {
      "identity": { "type": "background", "key": "chapter_1/ch1_act2_s1" },
      "disposition": "included",
      "sourcePath": "the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png",
      "section": "chapter_1"
    },
    {
      "identity": { "type": "portrait", "key": "asakura_mio/base" },
      "disposition": "included",
      "sourcePath": "the_seventh_mirror/characters/asakura_mio/base.png",
      "section": "chapter_1"
    },
    {
      "identity": { "type": "portrait", "key": "asakura_yuma/base" },
      "disposition": "included",
      "sourcePath": "the_seventh_mirror/characters/asakura_yuma/base.png",
      "section": "chapter_1"
    }
  ]
}
```

- [ ] **Step 3: Implement the deterministic fixture builder**

Use fixed definitions and options:

```ts
const FIXTURES = [
    {
        type: 'background',
        key: 'chapter_1/ch1_act2_s0',
        sourcePath:
            'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        resize: { width: 960, height: 540, fit: 'inside' as const },
    },
    {
        type: 'background',
        key: 'chapter_1/ch1_act2_s1',
        sourcePath:
            'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
        resize: { width: 960, height: 540, fit: 'inside' as const },
    },
    {
        type: 'portrait',
        key: 'asakura_mio/base',
        sourcePath: 'the_seventh_mirror/characters/asakura_mio/base.png',
        resize: { width: 450, height: 600, fit: 'inside' as const },
    },
    {
        type: 'portrait',
        key: 'asakura_yuma/base',
        sourcePath: 'the_seventh_mirror/characters/asakura_yuma/base.png',
        resize: { width: 450, height: 600, fit: 'inside' as const },
    },
] as const;
```

For each item, read from `packages/assets/media`, then:

```ts
const bytes = await sharp(source)
    .resize({ ...fixture.resize, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6, smartSubsample: true })
    .toBuffer();
const sha256 = createHash('sha256').update(bytes).digest('hex');
const metadata = await sharp(bytes).metadata();
```

Build the runtime manifest with actual byte length and dimensions, derive
`releaseId` from `sha256(canonicalReleaseContent(manifest))`, serialize with two
spaces plus a trailing newline, hash those exact bytes for `manifestSha256`,
and write a pointer with fixed `publishedAt: "2026-07-26T00:00:00.000Z"`.

Generate the AVIF probe with:

```ts
await sharp({
    create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
})
    .avif({ quality: 1, effort: 0 })
    .toFile('src/lib/visual-assets/avif-probe.avif');
```

- [ ] **Step 4: Implement independent fixture verification**

The verifier must:

```ts
const authoringCatalog = {
    storyId: imageAssets.storyId,
    assets: [
        ...imageAssets.backgrounds.map(entry => ({
            identity: { type: 'background' as const, key: entry.key },
            sourcePath: entry.path,
        })),
        ...imageAssets.portraits.map(entry => ({
            identity: { type: 'portrait' as const, key: entry.key },
            sourcePath: entry.path,
        })),
    ],
};

validateReleaseCoverage(authoringCatalog, plan, availableSourcePaths);
validateRuntimeManifestCoverage(manifest, plan);
```

It must separately recompute:

```ts
const manifestSha256 = createHash('sha256')
    .update(manifestText, 'utf8')
    .digest('hex');
const releaseContentSha256 = createHash('sha256')
    .update(canonicalReleaseContent(manifest), 'utf8')
    .digest('hex');
```

For every object, read its bytes, recompute SHA-256 and byte length, decode with
`sharp(bytes).metadata()`, and compare intrinsic width/height with the manifest.
Throw one aggregated error containing every mismatch.

Export `verifyVisualFixtures()` for Vitest, and guard the CLI entry point so an
import does not execute verification twice:

```ts
export async function verifyVisualFixtures(): Promise<void> {
    // Run the checks above and throw the aggregated error, if any.
}

if (import.meta.main) {
    await verifyVisualFixtures();
}
```

- [ ] **Step 5: Generate fixtures and verify them**

Run:

```bash
rtk bun --filter web build:visual-fixtures
rtk bun --filter web verify:visual-fixtures
```

Expected: both commands exit 0; the manifest contains exactly four assets and
the pointer references the generated release directory.

- [ ] **Step 6: Add a Vitest wrapper and run it**

```ts
// apps/web/src/lib/visual-assets/__tests__/visual-fixtures.test.ts
import { describe, expect, it } from 'vitest';
import { verifyVisualFixtures } from '../../../../scripts/verify-visual-fixtures';

describe('checked-in visual fixtures', () => {
    it('match source coverage and every content address', async () => {
        await expect(verifyVisualFixtures()).resolves.toBeUndefined();
    });
});
```

Run: `rtk bun --filter web test src/lib/visual-assets/__tests__/visual-fixtures.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit fixture tooling and generated assets**

```bash
rtk git add apps/web/package.json bun.lock apps/web/scripts/build-visual-fixtures.ts apps/web/scripts/verify-visual-fixtures.ts apps/web/src/lib/visual-assets/avif-probe.avif apps/web/src/lib/visual-assets/__fixtures__ apps/web/src/lib/visual-assets/__tests__/visual-fixtures.test.ts apps/web/public/assets/vn
rtk git commit -m "test(web): add HPA-228 visual asset fixtures"
```

---

### Task 4: Add Visual Types, Browser Hashing, and Defensive Release Persistence

**Files:**
- Create: `apps/web/src/lib/visual-assets/types.ts`
- Create: `apps/web/src/lib/visual-assets/hash.ts`
- Create: `apps/web/src/lib/visual-assets/validated-release-store.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/hash.test.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/validated-release-store.test.ts`

**Interfaces:**
- Produces: `VisualReleaseState`, `VisualLayerState`, `DecodedAsset`, `VisualSnapshot`
- Produces: `sha256Hex(bytes): Promise<string>`
- Produces: `ValidatedReleaseStore.loadRaw()`, `replace()`, and `clear()`

- [ ] **Step 1: Write failing hash and storage tests**

```ts
it('hashes exact UTF-8 bytes', async () => {
    expect(await sha256Hex(new TextEncoder().encode('aquila'))).toBe(
        '982f367a2aeea5dcf50985a9d2e907fe521f04653d00bfb6c021599b989e0ba8'
    );
});

it('degrades to memory-only when localStorage throws', () => {
    const storage = {
        getItem: () => {
            throw new DOMException('blocked', 'SecurityError');
        },
        setItem: () => {
            throw new DOMException('full', 'QuotaExceededError');
        },
        removeItem: () => {
            throw new DOMException('blocked', 'SecurityError');
        },
    } as unknown as Storage;
    const store = new ValidatedReleaseStore(storage);
    expect(store.loadRaw()).toEqual([]);
    expect(store.replace([])).toBe(false);
    expect(() => store.clear()).not.toThrow();
});
```

- [ ] **Step 2: Run tests and verify missing modules**

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/hash.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/validated-release-store.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Define shared visual state types**

```ts
export type VisualReleaseState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'stale-but-usable'
    | 'unavailable'
    | 'invalid';

export type VisualLayerState =
    | 'omitted'
    | 'loading'
    | 'ready'
    | 'missing'
    | 'failed';

export type DecodedAsset = {
    cacheKey: string;
    objectUrl: string;
    width: number;
    height: number;
    decodedBytes: number;
};

export type VisualImageLayer = {
    state: VisualLayerState;
    identity: string | null;
    objectUrl: string | null;
    width: number | null;
    height: number | null;
};

export type VisualPortraitLayer = VisualImageLayer & {
    slot: 'left' | 'center' | 'right';
};

export type VisualSnapshot = {
    release: VisualReleaseState;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portrait: VisualPortraitLayer;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

- [ ] **Step 4: Implement browser SHA-256**

```ts
export async function sha256Hex(bytes: BufferSource): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

export function utf8Bytes(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}
```

- [ ] **Step 5: Implement defensive storage**

```ts
export const VALIDATED_RELEASES_KEY =
    'aquila:visual-assets:validated-releases:v1';

export class ValidatedReleaseStore {
    constructor(private readonly storage: Storage | null) {}

    loadRaw(): unknown[] {
        try {
            const raw = this.storage?.getItem(VALIDATED_RELEASES_KEY);
            if (!raw) return [];
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    replace(records: readonly unknown[]): boolean {
        try {
            this.storage?.setItem(
                VALIDATED_RELEASES_KEY,
                JSON.stringify(records)
            );
            return this.storage !== null;
        } catch {
            return false;
        }
    }

    clear(): void {
        try {
            this.storage?.removeItem(VALIDATED_RELEASES_KEY);
        } catch {
            return;
        }
    }
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/hash.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/validated-release-store.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit runtime primitives**

```bash
rtk git add apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/hash.ts apps/web/src/lib/visual-assets/validated-release-store.ts apps/web/src/lib/visual-assets/__tests__/hash.test.ts apps/web/src/lib/visual-assets/__tests__/validated-release-store.test.ts
rtk git commit -m "feat(web): add visual asset runtime primitives"
```

---

### Task 5: Implement the HPA-227 Web Asset Resolver

**Files:**
- Create: `apps/web/src/lib/visual-assets/web-asset-resolver.ts`
- Create: `apps/web/src/lib/visual-assets/source-factory.ts`
- Create: `apps/web/src/lib/visual-assets/index.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/web-asset-resolver.test.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`

**Interfaces:**
- Consumes: HPA-227 `AssetResolver`, validation, path, canonical, policy, and error exports.
- Consumes: `sha256Hex`, `utf8Bytes`, and `ValidatedReleaseStore`.
- Produces: `WebAssetResolver implements AssetResolver`
- Produces: `getAssetResolverSource(storyId, origin): AssetResolverSource | null`

- [ ] **Step 1: Write resolver contract tests**

Cover the real fixture and explicit failure classes:

```ts
it('loads the exact pointer and manifest and resolves a CJK key safely', async () => {
    const resolver = createResolverWithFetch(validPointerAndManifestFetch);
    const release = await resolver.loadActiveRelease();
    expect(release.source).toBe('network');
    expect(resolver.resolve({ type: 'background', key: '第一章/鏡 房/夜' }))
        .toMatchObject({ status: 'resolved' });
});

it('uses no-cache and rejects an older publishedAt pointer', async () => {
    const fetchSpy = vi.fn(validPointerAndManifestFetch);
    const resolver = createResolverWithFetch(fetchSpy);
    await resolver.loadActiveRelease();
    installOlderPointer(fetchSpy);
    await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
        code: 'stale-pointer',
    });
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ cache: 'no-cache' });
});

it('continues a revalidated stored release when network loading fails', async () => {
    const resolver = createResolverWithStoredReleaseAndFailedFetch();
    await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
        source: 'last-validated-release',
    });
});
```

Also test unsafe paths before fetch, 5/10-second timeout classification, exact
manifest-byte checksum, story mismatch, release mismatch, canonical release ID,
24-hour expiry, tampered storage, two-release LRU, and write failure continuing
with the in-memory release.

- [ ] **Step 2: Run resolver tests and verify missing implementation**

Run: `rtk bun --filter web test src/lib/visual-assets/__tests__/web-asset-resolver.test.ts`

Expected: FAIL because `WebAssetResolver` does not exist.

- [ ] **Step 3: Implement timeout and fallback mapping**

```ts
async function fetchWithTimeout(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    init: RequestInit,
    parentSignal?: AbortSignal
): Promise<Response> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort();
    parentSignal?.addEventListener('abort', abort, { once: true });
    try {
        return await fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
        globalThis.clearTimeout(timeout);
        parentSignal?.removeEventListener('abort', abort);
    }
}
```

Map `AssetResolverError.code` to HPA-227's four `AssetFallbackReason` values;
never expose an unchecked URL.

- [ ] **Step 4: Implement active-release validation and storage revalidation**

`loadActiveRelease()` must execute this exact order:

```ts
const pointerUrl = resolveAssetUrl(
    this.source.baseUrl,
    getCurrentPointerPath(this.source.storyId, this.source.target)
);
const pointerResponse = await fetchWithTimeout(
    this.fetchImpl,
    pointerUrl,
    RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer,
    { cache: 'no-cache' },
    options?.signal
);
const pointerText = await pointerResponse.text();
const pointer = parseActiveReleasePointer(JSON.parse(pointerText));
this.assertNotOlder(pointer);
const manifestUrl = resolveAssetUrl(this.source.baseUrl, pointer.manifestPath);
const manifestResponse = await fetchWithTimeout(
    this.fetchImpl,
    manifestUrl,
    RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
    { cache: 'force-cache' },
    options?.signal
);
const manifestText = await manifestResponse.text();
const manifestDigest = await sha256Hex(utf8Bytes(manifestText));
if (manifestDigest !== pointer.manifestSha256) {
    throw new AssetResolverError('integrity', 'Manifest checksum mismatch');
}
const manifest = parseRuntimeAssetManifest(JSON.parse(manifestText));
validatePointerManifestPair(pointer, manifest);
const canonicalDigest = assertSha256<'release-content'>(
    await sha256Hex(utf8Bytes(canonicalReleaseContent(manifest)))
);
assertReleaseIdMatchesContentSha256(manifest, canonicalDigest);
```

Only after all checks pass, replace the active release, rebuild the qualified
identity index, and persist the exact manifest text.

Treat `ValidatedReleaseStore.loadRaw()` as untrusted input. A stored record is
eligible only when all of these checks pass: object shape, finite
`validatedAt`/`lastUsedAt`, matching story and target, age no greater than
`RUNTIME_ASSET_CACHE_POLICY.validatedReleaseTtlMs`, parseable pointer and
manifest text, exact manifest-byte checksum, pointer/manifest pairing, and
canonical release ID. Invalid and expired records are evicted before fallback.
On successful network validation or stored-release reuse, update `lastUsedAt`,
sort descending, and persist no more than the two most recently used valid
records:

```ts
const validRecords = (
    await Promise.all(
        this.store
            .loadRaw()
            .map(record => this.revalidateStoredRecord(record, now))
    )
).filter((record): record is ValidatedReleaseRecord => record !== null);

const nextRecords = upsertByReleaseId(validRecords, acceptedRecord)
    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
    .slice(0, 2);
this.store.replace(nextRecords);
```

`validatedAt` controls 24-hour eligibility; `lastUsedAt` controls only the
global two-record LRU. A storage write failure must not invalidate the accepted
in-memory release.

- [ ] **Step 5: Implement synchronous resolve and resolver-stage prefetch**

```ts
resolve(identity: LogicalAssetIdentity): AssetResolutionResult {
    const key = qualifyAssetIdentity(identity);
    const memoized = this.resolutionCache.get(key);
    if (memoized) return memoized;
    const entry = this.assetIndex.get(key);
    if (!entry) return this.memoFallback(identity, 'not-found');
    const result: ResolvedAsset = {
        status: 'resolved',
        asset: entry,
        webpUrl: resolveAssetUrl(this.source.baseUrl, entry.variants.webp.path),
        avifUrl: entry.variants.avif
            ? resolveAssetUrl(this.source.baseUrl, entry.variants.avif.path)
            : undefined,
        placeholderUrl: entry.placeholder
            ? resolveAssetUrl(this.source.baseUrl, entry.placeholder.path)
            : undefined,
    };
    this.resolutionCache.set(key, result);
    return result;
}
```

`prefetchNextEdge()` resolves every supplied identity, counts memoized
successes, and returns only resolver-stage fallbacks. `clear()` aborts in-flight
loads and clears active indices and memoized results.

- [ ] **Step 6: Implement the story source factory**

```ts
export function getAssetResolverSource(
    storyId: string,
    origin: string
): AssetResolverSource | null {
    if (storyId !== 'the_seventh_mirror') return null;
    return {
        environment: 'local',
        storyId,
        baseUrl: new URL('/assets/', origin).href,
        target: { kind: 'preview', previewId: 'hpa-228-local' },
    };
}
```

- [ ] **Step 7: Run resolver and source tests**

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/web-asset-resolver.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/source-factory.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the resolver**

```bash
rtk git add apps/web/src/lib/visual-assets/web-asset-resolver.ts apps/web/src/lib/visual-assets/source-factory.ts apps/web/src/lib/visual-assets/index.ts apps/web/src/lib/visual-assets/__tests__/web-asset-resolver.test.ts apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts
rtk git commit -m "feat(web): implement visual asset resolver"
```

---

### Task 6: Implement Verified Decoding and the Bounded Cache

**Files:**
- Create: `apps/web/src/lib/visual-assets/decoded-asset-cache.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts`
- Modify: `apps/web/src/lib/visual-assets/index.ts`

**Interfaces:**
- Consumes: HPA-227 `ResolvedAsset` and cache/timeout policy.
- Produces: `DecodedAssetCache.load()`, `prefetch()`, `setProtectedKeys()`,
  `setBeforeRevoke()`, and async `clear()`.
- Produces: verified `DecodedAsset` Blob URLs only after byte, hash, length, and dimensions pass.

- [ ] **Step 1: Write failing cache tests**

```ts
it('deduplicates the same immutable object and verifies it once', async () => {
    const cache = createCache();
    const [first, second] = await Promise.all([
        cache.load(resolvedAsset),
        cache.load(resolvedAsset),
    ]);
    expect(first).toBe(second);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(decodeSpy).toHaveBeenCalledOnce();
});

it('rejects hash, byte-length, dimensions, timeout, and decode mismatches', async () => {
    await expect(cache.load(assetWithWrongHash)).rejects.toMatchObject({
        code: 'integrity',
    });
    await expect(cache.load(assetWithWrongDimensions)).rejects.toMatchObject({
        code: 'integrity',
    });
});

it('evicts LRU entries at 48 objects or 96 MiB without evicting protected keys', async () => {
    cache.setProtectedKeys(new Set([activeKey, stagingKey, previousKey]));
    await fillPastBothBounds(cache);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(activeUrl);
    expect(cache.size).toBeLessThanOrEqual(48);
    expect(cache.decodedBytes).toBeLessThanOrEqual(96 * 1024 * 1024);
});
```

- [ ] **Step 2: Run the cache tests and verify the missing class**

Run: `rtk bun --filter web test src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts`

Expected: FAIL because `DecodedAssetCache` does not exist.

- [ ] **Step 3: Implement injectable fetch/decode dependencies and AVIF probe**

```ts
type DecodeResult = { width: number; height: number; close: () => void };
type DecodeImage = (blob: Blob) => Promise<DecodeResult>;

const defaultDecodeImage: DecodeImage = async blob => {
    const bitmap = await createImageBitmap(blob);
    return {
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
    };
};

let avifSupportPromise: Promise<boolean> | null = null;
function supportsAvif(decodeImage: DecodeImage): Promise<boolean> {
    avifSupportPromise ??= fetch(
        new URL('./avif-probe.avif', import.meta.url)
    )
        .then(response => response.blob())
        .then(decodeImage)
        .then(image => {
            image.close();
            return true;
        })
        .catch(() => false);
    return avifSupportPromise;
}
```

Probe only when a manifest entry actually has an AVIF variant. If AVIF is
unsupported or fails, retry the required WebP variant.

- [ ] **Step 4: Implement immutable-object loading and verification**

Use `releaseId + format + sha256` as the cache key. Fetch with the 15-second
timeout, then:

```ts
const bytes = new Uint8Array(await response.arrayBuffer());
if (bytes.byteLength !== variant.byteLength) {
    throw new AssetResolverError('integrity', 'Asset byte length mismatch');
}
if ((await sha256Hex(bytes)) !== variant.sha256) {
    throw new AssetResolverError('integrity', 'Asset checksum mismatch');
}
const blob = new Blob([bytes], { type: `image/${variant.format}` });
const decoded = await this.decodeImage(blob);
if (decoded.width !== asset.width || decoded.height !== asset.height) {
    decoded.close();
    throw new AssetResolverError('integrity', 'Asset dimensions mismatch');
}
decoded.close();
const objectUrl = URL.createObjectURL(blob);
```

Store no entry and no failed promise after an exception.

- [ ] **Step 5: Implement LRU bounds and safe revocation**

Expose:

```ts
setProtectedKeys(keys: ReadonlySet<string>): void;
setBeforeRevoke(hook: (objectUrl: string) => Promise<void>): void;
prefetch(asset: ResolvedAsset, options?: { signal?: AbortSignal }): Promise<void>;
clear(): Promise<void>;
```

Evict least-recently-used unprotected entries until both bounds pass. Before
every revoke, await the current `beforeRevoke(objectUrl)` hook, which removes
the URL from controller snapshots and waits through the next animation frame;
only then call `URL.revokeObjectURL(objectUrl)`. `clear()` aborts in-flight
loads, waits for detachment, and revokes every completed Blob URL.

- [ ] **Step 6: Run cache tests**

Run: `rtk bun --filter web test src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts`

Expected: PASS, including one-time AVIF probe, WebP fallback, deduplication,
bound enforcement, and revocation ordering.

- [ ] **Step 7: Commit the decoded cache**

```bash
rtk git add apps/web/src/lib/visual-assets/decoded-asset-cache.ts apps/web/src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts apps/web/src/lib/visual-assets/index.ts
rtk git commit -m "feat(web): add verified decoded image cache"
```

---

### Task 7: Implement Visual State, Crossfade Layers, and One-Edge Prefetch

**Files:**
- Create: `apps/web/src/lib/visual-assets/prefetch-queue.ts`
- Create: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/prefetch-queue.test.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- Modify: `apps/web/src/lib/visual-assets/index.ts`

**Interfaces:**
- Consumes: `AssetResolver`, `DecodedAssetCache`, `StoryFlowConfig`, presentation metadata, and guarded `getSceneDialogue`.
- Produces: `VisualStateController.subscribe()`, `update()`,
  `commitBackgroundTransition()`, `detachObjectUrl()`, `softRevalidate()`, and
  `dispose()`.
- Produces: immutable `VisualSnapshot` updates for the Svelte view.

- [ ] **Step 1: Write failing queue and controller tests**

```ts
it('runs at most two queued requests concurrently', async () => {
    const queue = new PrefetchQueue(2);
    const peak = await measurePeakConcurrency([
        queue.run(first),
        queue.run(second),
        queue.run(third),
    ]);
    expect(peak).toBe(2);
});

it('retains the active background when staging fails', async () => {
    controller.update(lineWithFirstBackground);
    await flushSuccessfulDecode();
    const first = latest().activeBackground.objectUrl;
    controller.update(lineWithBrokenBackground);
    await flushFailedDecode();
    expect(latest().activeBackground.objectUrl).toBe(first);
    expect(latest().stagingBackground.state).toBe('failed');
});

it('keeps the old active background until the view commits the transition', async () => {
    controller.update(lineWithFirstBackground);
    await flushSuccessfulDecode();
    const first = latest().activeBackground.objectUrl;
    controller.update(lineWithSecondBackground);
    await flushSuccessfulDecode();
    expect(latest().activeBackground.objectUrl).toBe(first);
    expect(latest().stagingBackground.state).toBe('ready');
    controller.commitBackgroundTransition();
    expect(latest().activeBackground.identity).toBe(secondBackgroundIdentity);
    expect(latest().stagingBackground.state).toBe('omitted');
});

it('prefetches every immediate choice edge once but never a second edge', async () => {
    controller.update(choiceFinalLine);
    await flushPrefetch();
    expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(2);
    expect(resolver.prefetchNextEdge).toHaveBeenCalledWith(
        expect.objectContaining({ fromSceneId: 'choice_scene', toSceneId: 'branch_a' })
    );
    expect(getSceneDialogue).not.toHaveBeenCalledWith(storyId, 'branch_a_next');
});
```

Also test omitted/missing/failed mapping, stale release plus ready layer,
generation races, neutral initial background, portrait removal before decode,
left/right/default-center slots, within-scene warming through
`resolve()+cache.prefetch()`, and linear-edge prefetch.

- [ ] **Step 2: Run tests and verify missing implementations**

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/prefetch-queue.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: FAIL because the queue and controller do not exist.

- [ ] **Step 3: Implement the two-request queue**

```ts
export class PrefetchQueue {
    private active = 0;
    private readonly pending: Array<() => void> = [];

    constructor(private readonly limit = 2) {}

    async run<T>(work: () => Promise<T>): Promise<T> {
        if (this.active >= this.limit) {
            await new Promise<void>(resolve => this.pending.push(resolve));
        }
        this.active += 1;
        try {
            return await work();
        } finally {
            this.active -= 1;
            this.pending.shift()?.();
        }
    }
}
```

- [ ] **Step 4: Implement controller inputs and subscription**

```ts
export type VisualControllerInput = {
    storyId: string;
    sceneId: string;
    dialogue: readonly DialogueEntry[];
    dialogueIndex: number;
    flow: StoryFlowConfig;
    presentation: StoryPresentationMetadata | null;
};

export class VisualStateController {
    subscribe(listener: (snapshot: VisualSnapshot) => void): () => void;
    update(input: VisualControllerInput): void;
    commitBackgroundTransition(): void;
    detachObjectUrl(objectUrl: string): Promise<void>;
    softRevalidate(): Promise<void>;
    dispose(): void;
}
```

Every `update()` increments a request generation. Apply async completion only
when story, scene, dialogue index, identity, and generation still match.
`softRevalidate()` owns the 60-second age check and is a no-op when the current
pointer was checked more recently.

- [ ] **Step 5: Implement background and portrait state machines**

For background:

```ts
if (!entry?.background) {
    this.setStaging(layer('omitted'));
} else {
    this.setStaging(layer('loading', backgroundIdentity));
    const decoded = await this.loadIdentity(backgroundIdentity, generation);
    if (!this.isCurrent(generation, backgroundIdentity)) return;
    this.setStaging(readyLayer(backgroundIdentity, decoded));
}
```

When no active background exists, promote the first ready staging layer
immediately. Otherwise, keep the former active layer protected while staging
is ready. The view calls `commitBackgroundTransition()` from the staging
image's `transitionend`; reduced motion calls it immediately. Failure updates
only staging and never clears active.

`detachObjectUrl(url)` removes the URL from every snapshot layer, notifies
subscribers, and resolves after the next animation frame. The runtime wires it
to `cache.setBeforeRevoke(...)`, which guarantees DOM detachment before cache
revocation.

For portrait, clear the prior portrait before starting a new identity. Resolve
slot with:

```ts
const slot =
    (characterId
        ? input.presentation?.portrait.slotsByCharacterId[characterId]
        : undefined) ??
    input.presentation?.portrait.defaultSlot ??
    'center';
```

- [ ] **Step 6: Implement release mapping and prefetch**

Map resolver/cache outcomes to the two state axes from the design. Set
`snapshot.status` to `stale`, `fallback`, or `unavailable` when the release is
stale/unavailable/invalid or a keyed current layer is missing/failed; otherwise
set it to `null`.

For within-scene warming, find the next distinct visual state and call:

```ts
const resolved = this.resolver.resolve(identity);
if (resolved.status === 'resolved') {
    void this.queue.run(() => this.cache.prefetch(resolved));
}
```

For each immediate flow edge:

```ts
await this.queue.run(async () => {
    const result = await this.resolver.prefetchNextEdge({
        fromSceneId: input.sceneId,
        toSceneId,
        assets: firstVisualIdentities,
        signal: this.abortController.signal,
    });
    if (result.failed.length > 0) return;
    await Promise.all(
        firstVisualIdentities.map(identity => {
            const resolved = this.resolver.resolve(identity);
            return resolved.status === 'resolved'
                ? this.cache.prefetch(resolved)
                : Promise.resolve();
        })
    );
});
```

Do not inspect edges after `toSceneId`.

- [ ] **Step 7: Run queue and controller tests**

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/prefetch-queue.test.ts
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: PASS with peak concurrency 2 and no recursive prefetch.

- [ ] **Step 8: Commit controller behavior**

```bash
rtk git add apps/web/src/lib/visual-assets/prefetch-queue.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/prefetch-queue.test.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts apps/web/src/lib/visual-assets/index.ts
rtk git commit -m "feat(web): add visual reader state controller"
```

---

### Task 8: Build the Responsive Visual Reader and Backlog

**Files:**
- Create: `apps/web/src/components/VisualBacklog.svelte`
- Create: `apps/web/src/components/VisualNovelReader.svelte`
- Create: `apps/web/src/components/__tests__/VisualBacklog.test.ts`
- Create: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Interfaces:**
- Consumes: controlled reader props, `VisualStateController`, `getReaderAdvanceDecision`, `isReaderInteractiveTarget`, and `typeText`.
- Produces: stable visual test hooks and all existing progression callbacks.
- Preserves: exact dialogue index across remounts and external index changes.

- [ ] **Step 1: Write failing backlog component tests**

```ts
it('shows current-scene dialogue through the active line', () => {
    render(VisualBacklog, {
        dialogue: threeLines,
        dialogueIndex: 1,
        locale: 'en',
        onClose: vi.fn(),
    });
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.queryByText('Third')).not.toBeInTheDocument();
});

it('moves focus inside on open and returns focus to the trigger on close', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    render(VisualBacklog, { dialogue: threeLines, dialogueIndex: 0, trigger });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement);
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(trigger).toHaveFocus();
});
```

- [ ] **Step 2: Implement `VisualBacklog`**

Render `dialogue.slice(0, dialogueIndex + 1)` inside a `role="dialog"` panel.
Use `data-reader-interactive`, close on Escape, focus the close button after
mount, restore the supplied trigger on close, and reuse translated
`historyTitle`, `closeHistory`, and character-name resolution.

- [ ] **Step 3: Write failing visual reader tests**

Cover:

```ts
expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
    'data-visual-release-state',
    'ready'
);
expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
    'data-reader-mode',
    'visual'
);
expect(screen.getByTestId('visual-portrait')).toHaveAttribute(
    'data-portrait-slot',
    'right'
);
```

Also test first action skips typing, second action advances, choice callbacks,
backlog inert/focus behavior, interactive controls do not advance, failed
visuals leave dialogue usable, reduced motion removes crossfade, and external
index changes snap to full text.

- [ ] **Step 4: Implement the controlled visual reader**

Props must match:

```ts
type Props = {
    controller: VisualStateController | null;
    flow: StoryFlowConfig;
    dialogue: DialogueEntry[];
    dialogueIndex: number;
    storyId: string;
    currentSceneId: string;
    canGoNext: boolean;
    choice: ChoiceDefinition | null;
    locale: Locale;
    presentation: StoryPresentationMetadata | null;
    onChoice: (nextScene: string) => void;
    onBookmark: (dialogueNumber: number) => void;
    onNext: () => void;
    onNavigate: (sceneId: string) => void;
    onIndexChange: (index: number) => void;
    showBookmarkButton: boolean;
    backUrl: string;
    isInitialMount: boolean;
    interactionDisabled: boolean;
};
```

Subscribe to the controller on mount, call `controller.update()` in an effect,
and unsubscribe without disposing the retained runtime.

The root markup must expose:

```svelte
<main
  data-testid="visual-novel-reader"
  data-reader-mode="visual"
  data-visual-release-state={snapshot.release}
>
  <img
    data-bg-layer="active"
    data-bg-state={snapshot.activeBackground.state}
    src={snapshot.activeBackground.objectUrl ?? undefined}
    alt=""
  />
  <img
    data-bg-layer="staging"
    data-bg-state={snapshot.stagingBackground.state}
    src={snapshot.stagingBackground.objectUrl ?? undefined}
    ontransitionend={() => controller?.commitBackgroundTransition()}
    alt=""
  />
  <img
    data-testid="visual-portrait"
    data-portrait-state={snapshot.portrait.state}
    data-portrait-slot={snapshot.portrait.slot}
    src={snapshot.portrait.objectUrl ?? undefined}
    alt=""
  />
</main>
```

Keep all three image elements stable and clear `src` when no verified object
URL is ready. Use `object-fit: cover` for backgrounds and
intrinsic-ratio-preserving max dimensions for portraits. When reduced motion
is active, skip the CSS transition and call
`controller.commitBackgroundTransition()` as soon as staging becomes ready.

Render a nonblocking `role="status" aria-live="polite"` message only when
`snapshot.status` is non-null, with this exact translation mapping:

```ts
const visualStatusText =
    snapshot.status === 'stale'
        ? t.reader.visualStaleRelease
        : snapshot.status === 'fallback'
          ? t.reader.visualAssetFallback
          : snapshot.status === 'unavailable'
            ? t.reader.visualUnavailable
            : null;
```

- [ ] **Step 5: Implement input, choices, controls, and responsive layout**

Use the Task 1 decision helper for Enter, Space, primary pointer, and touch.
Render choices only on the final line. Render backlog, bookmark, back, and next
controls with `data-reader-interactive`. Apply safe-area styles using all four
`env(safe-area-inset-*)` values. Put the cinematic dialogue box at the bottom
and constrain portrait height above it for desktop, portrait mobile, and
landscape mobile.

- [ ] **Step 6: Run visual component tests**

Run:

```bash
rtk bun --filter web test src/components/__tests__/VisualBacklog.test.ts
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the visual presentation**

```bash
rtk git add apps/web/src/components/VisualBacklog.svelte apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualBacklog.test.ts apps/web/src/components/__tests__/VisualNovelReader.test.ts
rtk git commit -m "feat(web): add responsive visual novel reader"
```

---

### Task 9: Integrate Mode Persistence and Retained Runtime into ReaderShell

**Files:**
- Create: `apps/web/src/lib/reader-mode.ts`
- Create: `apps/web/src/lib/__tests__/reader-mode.test.ts`
- Modify: `apps/web/src/lib/visual-assets/source-factory.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`
- Modify: `packages/stories/src/translations/en.json`
- Modify: `packages/stories/src/translations/zh.json`
- Modify: `packages/stories/src/__tests__/translations.test.ts`

**Interfaces:**
- Produces: `readReaderMode()`, `writeReaderMode()`
- Produces: `createVisualRuntime(storyId, origin, getSceneDialogue): VisualReaderRuntime`
- Integrates: one always-visible z-80 mode control and one retained runtime per active sourced story.

- [ ] **Step 1: Write failing preference tests**

```ts
it('defaults malformed or unavailable storage to text', () => {
    localStorage.setItem('aquila:reader-mode:v1', 'cinema');
    expect(readReaderMode()).toBe('text');
});

it('writes only explicit valid mode toggles', () => {
    writeReaderMode('visual');
    expect(localStorage.getItem('aquila:reader-mode:v1')).toBe('visual');
});
```

Run: `rtk bun --filter web test src/lib/__tests__/reader-mode.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement defensive mode persistence**

```ts
export type ReaderMode = 'text' | 'visual';
export const READER_MODE_KEY = 'aquila:reader-mode:v1';

export function getBrowserStorage(): Storage | null {
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
}

export function readReaderMode(
    storage: Storage | null = getBrowserStorage()
): ReaderMode {
    try {
        return storage?.getItem(READER_MODE_KEY) === 'visual' ? 'visual' : 'text';
    } catch {
        return 'text';
    }
}

export function writeReaderMode(
    mode: ReaderMode,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(READER_MODE_KEY, mode);
    } catch {
        return;
    }
}
```

- [ ] **Step 3: Add translations and mocked translation fields**

Add these English values:

```json
{
  "readerMode": "Reader mode",
  "textMode": "Text",
  "visualNovelMode": "Visual Novel",
  "visualStaleRelease": "Using previously validated visuals",
  "visualAssetFallback": "Some visuals are unavailable",
  "visualUnavailable": "Visuals are unavailable"
}
```

Add these Chinese values:

```json
{
  "readerMode": "閱讀模式",
  "textMode": "文字",
  "visualNovelMode": "視覺小說",
  "visualStaleRelease": "正在使用先前驗證的視覺素材",
  "visualAssetFallback": "部分視覺素材無法使用",
  "visualUnavailable": "視覺素材無法使用"
}
```

Update every reader-component translation mock to include the six keys.

- [ ] **Step 4: Create the retained runtime factory**

```ts
export type VisualReaderRuntime = {
    controller: VisualStateController;
    softRevalidate: () => Promise<void>;
    dispose: () => Promise<void>;
};

export function createVisualRuntime(
    storyId: string,
    origin: string,
    getSceneDialogue: (
        storyId: string,
        sceneId: string
    ) => readonly DialogueEntry[] | null
): VisualReaderRuntime {
    const source = getAssetResolverSource(storyId, origin);
    const store = new ValidatedReleaseStore(getBrowserStorage());
    const resolver = source ? new WebAssetResolver(source, { store }) : null;
    const cache = new DecodedAssetCache();
    const controller = new VisualStateController({
        resolver,
        cache,
        getSceneDialogue,
    });
    cache.setBeforeRevoke(objectUrl =>
        controller.detachObjectUrl(objectUrl)
    );
    return {
        controller,
        softRevalidate: () => controller.softRevalidate(),
        dispose: async () => {
            controller.dispose();
            try {
                await cache.clear();
            } finally {
                resolver?.clear();
            }
        },
    };
}
```

- [ ] **Step 5: Write ReaderShell integration tests**

Add tests for:

- Text default and persisted visual mode without a Text leaf flash.
- Mode control in payload, initial-loading, and replacement-error states.
- Exact nonzero index across Text → Visual → Text and breakpoint changes.
- Runtime created once, retained across mode toggles, disposed on story change
  and shell destroy.
- Revalidation only after 60 seconds on Visual reentry, active-line change, or
  document visibility.
- Null source creates no pointer/manifest/image requests.

Use an injected runtime factory prop in tests:

```ts
createVisualRuntime = mockCreateVisualRuntime,
```

- [ ] **Step 6: Integrate the mode control and leaf selection**

Initialize synchronously:

```ts
let readerMode = $state(readReaderMode());
function setReaderMode(mode: ReaderMode): void {
    if (readerMode === mode) return;
    readerMode = mode;
    writeReaderMode(mode);
}
```

Render the mode control as a sibling before payload branching:

```svelte
<div
  class="fixed z-[80]"
  style="top: calc(0.75rem + env(safe-area-inset-top)); right: calc(0.75rem + env(safe-area-inset-right));"
  data-reader-mode={readerMode}
  aria-label={t.reader.readerMode}
  data-reader-interactive
>
  <button type="button" onclick={() => setReaderMode('text')}>
    {t.reader.textMode}
  </button>
  <button type="button" onclick={() => setReaderMode('visual')}>
    {t.reader.visualNovelMode}
  </button>
</div>
```

Inside `reader-ready`, select:

```svelte
{#if readerMode === 'visual'}
  <VisualNovelReader controller={visualRuntime?.controller ?? null} />
{:else if isMobile}
  <MobileNovelReader />
{:else}
  <NovelReader />
{/if}
```

Pass the full existing controlled prop set plus `presentation` to the visual
leaf.

- [ ] **Step 7: Implement runtime lifecycle**

Create lazily on first visual selection for an active payload. Retain it on
Visual → Text. When `storyId` changes, dispose the old runtime before creating
the new sourced runtime. On Text → Visual and approved lifecycle events, call
`softRevalidate()`; the method itself performs the pointer-age check and is a
no-op below 60 seconds. Use `onDestroy` to invoke `void runtime.dispose()` and
remove the visibility listener. Do not add a timer.

- [ ] **Step 8: Run integration and translation tests**

Run:

```bash
rtk bun --filter web test src/lib/__tests__/reader-mode.test.ts
rtk bun --filter web test src/components/__tests__/ReaderShell.test.ts
rtk bun --filter @aquila/stories test src/__tests__/translations.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit ReaderShell integration**

```bash
rtk git add apps/web/src/lib/reader-mode.ts apps/web/src/lib/__tests__/reader-mode.test.ts apps/web/src/lib/visual-assets/source-factory.ts apps/web/src/components/ReaderShell.svelte apps/web/src/components/__tests__/ReaderShell.test.ts packages/stories/src/translations/en.json packages/stories/src/translations/zh.json packages/stories/src/__tests__/translations.test.ts
rtk git commit -m "feat(web): integrate visual reader mode"
```

---

### Task 10: Add Real-Browser Visual Flows and Complete Verification

**Files:**
- Modify: `packages/e2e/playwright.config.ts`
- Modify: `packages/e2e/tests/utils.ts`
- Create: `packages/e2e/tests/reader-visual.spec.ts`
- Modify: implementation files only if a test exposes an HPA-228 regression

**Interfaces:**
- Produces: `VisualReaderPage` page object.
- Proves: fixture loading, mode continuity, crossfade state, slots, fallback,
  direct URL/history, backlog, desktop/mobile, and explicit landscape viewport.

- [ ] **Step 1: Add the visual page object**

```ts
export class VisualReaderPage {
    constructor(private readonly page: Page) {}

    get root() {
        return this.page.getByTestId('visual-novel-reader');
    }
    get modeControl() {
        return this.page.locator('[data-reader-mode]');
    }
    get activeBackground() {
        return this.root.locator('[data-bg-layer="active"]');
    }
    get stagingBackground() {
        return this.root.locator('[data-bg-layer="staging"]');
    }
    get portrait() {
        return this.root.getByTestId('visual-portrait');
    }

    async goto(dialogue = 6) {
        await this.page.addInitScript(() => {
            localStorage.setItem('aquila:reader-mode:v1', 'visual');
        });
        await this.page.goto(
            `/en/reader?story=the_seventh_mirror&scene=ch1_act2&dialogue=${dialogue}`
        );
        await expect(this.root).toBeVisible();
    }
}
```

- [ ] **Step 2: Include the visual spec in desktop and mobile projects**

Keep the existing mobile reader coverage and change the mobile `testMatch` to:

```ts
testMatch: /reader-(mobile|visual)\.spec\.ts/,
```

The desktop Chromium project already runs `reader-visual.spec.ts` because it
ignores only `reader-mobile.spec.ts`.

- [ ] **Step 3: Add exact flagship and mode-continuity tests**

```ts
test('renders Yuma right, advances to Mio left, and preserves the URL line', async ({ page }) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(6);
    await expect(visual.portrait).toHaveAttribute('data-portrait-slot', 'right');
    await visual.root.click();
    await expect(page).toHaveURL(/dialogue=7/);
    await expect(visual.portrait).toHaveAttribute('data-portrait-slot', 'left');
});

test('crossfades line 10 to line 11 without clearing active', async ({ page }) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(10);
    const previousUrl = await visual.activeBackground.getAttribute('src');
    await visual.root.click();
    await expect(visual.stagingBackground).toHaveAttribute('data-bg-state', /loading|ready/);
    expect(await visual.activeBackground.getAttribute('src')).toBe(previousUrl);
    await expect(visual.activeBackground).toHaveAttribute('data-bg-state', 'ready');
});
```

Add Text → Visual → Text at `dialogue=7`, direct-link restoration, and
back/forward history tests that assert the canonical line never changes during
mode swaps.

- [ ] **Step 4: Add fallback, choice, backlog, and reduced-motion tests**

Intercept one object URL with 404 and another with invalid bytes. Assert the
dialogue and controls remain usable, the status is polite/nonblocking, and the
prior background remains. Open and close backlog with focus restoration.

Load Train Adventure in visual mode at an existing choice scene; assert the
neutral background, no portrait, and existing choice navigation still work.
Use a reduced-motion context and assert staging has no nonzero transition
duration.

- [ ] **Step 5: Add an honest landscape test**

```ts
test('keeps essential controls unobscured in mobile landscape', async ({
    page,
}, testInfo) => {
    test.skip(testInfo.project.name === 'chromium');
    await page.setViewportSize({ width: 844, height: 390 });
    const visual = new VisualReaderPage(page);
    await visual.goto(6);
    await expect(visual.modeControl).toBeVisible();
    await expect(visual.modeControl).toBeEnabled();
    await visual.root.click();
    await openAndCloseVisualBacklog(page);
    await expectEssentialControlsNotToOverlapPortrait(page);
});
```

Do not assert nonzero notch inset values; the component test owns literal
`env(safe-area-inset-*)` coverage.

- [ ] **Step 6: Run targeted Playwright flows**

Run:

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=mobile-chrome
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=mobile-safari
```

Expected: PASS on desktop, mobile portrait, and the explicit landscape test
(passes on the mobile projects and is intentionally skipped for desktop
Chromium, matching the skip condition in the landscape test).

- [ ] **Step 7: Run the complete verification matrix**

Run:

```bash
rtk bun --filter web verify:visual-fixtures
rtk bun --filter web test
rtk bun --filter web lint
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter @aquila/stories lint
rtk bun run compile:check
rtk bun run build
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
```

Expected: every command exits 0 and `compile:check` leaves generated story
outputs unchanged.

- [ ] **Step 8: Review implementation against the live issue**

Re-fetch HPA-228 and its current comments. Check every acceptance criterion
against source, unit tests, fixture verifier output, and Playwright output.
Record any remaining gap before claiming completion.

- [ ] **Step 9: Commit the browser proof**

```bash
rtk git add packages/e2e/playwright.config.ts packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "test(e2e): cover visual novel reader flows"
```

---

## Final Review Checklist

- [ ] Every HPA-228 acceptance criterion maps to a completed task and passing test.
- [ ] Text mode remains the default and existing desktop/mobile text-reader tests pass.
- [ ] The exact canonical dialogue line survives mode, breakpoint, direct-link, bookmark, and history transitions.
- [ ] `ch1_act2` lines 6, 7, 10, and 11 prove both portrait slots and the background transition.
- [ ] Resolver validation rejects unsafe, stale, malformed, mismatched, and tampered inputs before UI use.
- [ ] Storage failure degrades to memory-only behavior without changing a ready release to failed.
- [ ] Decode cache stays within 48 objects and 96 MiB, deduplicates, and revokes safely.
- [ ] Prefetch reaches every immediate choice branch but no second edge and never exceeds two concurrent requests.
- [ ] Missing, omitted, invalid, slow, and undecodable visuals never block dialogue or choices.
- [ ] Reduced-motion, focus, input filtering, safe-area CSS, mobile portrait, and mobile landscape are covered.
- [ ] Fixture verification recomputes exact bytes, hashes, dimensions, release identity, and both coverage validators.
- [ ] No HPA-230 production publisher, Cloudflare hosting, placeholder rendering, or generated-story edits were introduced.
