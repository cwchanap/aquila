# Two-Character Portrait Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic two-character visual-novel stage where portrait-bearing speakers alternate left/right, the previous visible speaker remains on screen, inactive portraits are dimmed, and retained failures do not re-fetch on every line.

**Architecture:** Add one pure scene-prefix projector that derives `{ left, right, activeSlot }` from the current scene's `DialogueEntry[]`. Perform the old-presentation deletion and two-slot `VisualStateController` conversion as one atomic contract swap so the branch never commits an intentionally broken all-left runtime. Reuse the existing release resolver/cache/generation machinery, add one slot-local failure memo keyed by release generation, render two stable portrait images, and derive final CSS from PR #65's portrait-behind-dialogue geometry rather than from pre-#65 `main`.

**Tech Stack:** Bun workspaces, TypeScript, Svelte 5, Astro 5, Vitest, Testing Library, Playwright, existing `@aquila/stories` compiler/runtime assets, existing `DecodedAssetCache` + `VisualStateController`.

**Spec:** `docs/superpowers/specs/2026-09-02-two-character-portrait-stage-design.md`

## Global Constraints

- Keep all design, plan, implementation, and verification in existing draft PR #64.
- **PR #65 must land first.** Do not implement #64 from the pre-#65 portrait geometry.
- After #65 merges, rebase #64 onto `origin/main` before production implementation.
- Preserve #65 / `cf62bcf2` portrait `bottom`, full-height sizing, dialogue-box heights, reader grid row, and act-panel `min-height`; #64 may narrow portrait `max-width` and add active/inactive styling only.
- Stage state is scene-local and derived from `dialogue.slice(0, dialogueIndex + 1)`; never persist it to URL, bookmarks, local storage, or reader session state.
- Exactly two visible slots: `left` and `right`. No 3+ character layout or stage-direction framework.
- First portrait-bearing character starts left. A second fills right. With both occupied, a new portrait-bearing character replaces the slot opposite the most recent visible speaker.
- A character stays on its side only while staged. Once replaced, re-entry is a new placement and may switch sides.
- A visible character that speaks again stays in its current slot. A new `portrait` updates only that slot's expression; a line without `portrait` keeps the staged expression.
- An unseen character without `portrait` does not enter and does not become active. This includes generated narrator lines with `characterId: Narrator` and no portrait.
- A line without `characterId` likewise leaves the stage unchanged and sets `activeSlot: null`.
- Delete `PortraitSlot`, `StoryPresentationMetadata`, `ParsedCharacter.portraitSlot`, generated `presentation.ts`, `readerState.presentation`, and all presentation props. No compatibility adapter.
- Keep one parser rejection sentinel for leftover `- **Portrait Slot**: ...` syntax so legacy authoring fails loudly instead of silently no-oping.
- Rewrite all reserved-ID error text/comments to reference only `characterTable`; no deleted `slotsByCharacterId`, `defaultSlot`, or `portraitSlot` terminology may remain in active source/tests.
- Reuse existing resolver, release validation, decoded cache, object-URL lifecycle, prefetch queue, generation guards, and background transition logic. Do not create an asset/stage manager.
- Missing/failed portrait slots are terminal once per `(releaseGeneration, portraitKey)`; a changed key or new release generation permits a new request.
- Inactive presentation is fixed for now: `brightness(0.55)` + `opacity: 0.82`; active is `brightness(1)` + `opacity: 1`.
- Only filter/opacity transitions; no portrait movement/entrance/exit animation.
- Existing local visual fixtures already contain `asakura_yuma/base` and `asakura_mio/base`; do not add/regenerate source assets.
- Delete the shared single `visual.portrait` page-object getter. Use explicit `leftPortrait`, `rightPortrait`, `readyPortraits`, and semantic `activePortrait` locators.
- Follow RED -> minimum implementation -> focused GREEN for each behavior slice.

## Accepted Product Consequence

The current raw metadata pins Mio left and Yuma right, but Seventh Mirror `ch1_act2` has Yuma as the first portrait-bearing speaker. Removing static home sides intentionally inverts the flagship authored sides:

```text
dialogue 6 -> Yuma left active
dialogue 7 -> Yuma left dim, Mio right active
dialogue 8 -> Yuma left active, Mio right dim
```

Do not reintroduce `slotsByCharacterId` to preserve the old Mio/Yuma sides. Permanent home sides are deferred unless later product evidence justifies one new projector rule.

## Risks

### Risk A — CSS reverts PR #65

PR #65 changes the exact portrait/dialogue CSS block #64 also touches. Implementing from old `main` would silently restore the pre-#65 “portrait above dialogue box” layout and could make tests defend the regression.

**Mitigation:** hard prerequisite/rebase gate below; Task 3 starts from #65 CSS and changes only width caps + emphasis styles. Local geometry tests stop asserting “no overlap with dialogue box” because #65 intentionally renders portraits behind it.

### Risk B — retained failed portrait retries every line

The existing `isLayerCurrentForRelease()` accepts only `state === 'ready'`. With retained two-slot portraits, an inactive failed portrait can remain projected for many lines; without a memo it would cycle `failed -> loading -> failed` and re-fetch the same immutable bytes on every `update()`.

**Mitigation:** Task 2 adds per-slot `(releaseGeneration, portraitKey)` failure memoization and pins both unit and corrupt-Mio E2E behavior.

---

## Pre-flight: Land PR #65 and Rebase #64

Do this before Task 1 production work.

- [ ] **P.1 Verify PR #65 is merged into `origin/main`**

```bash
rtk git fetch origin
rtk git merge-base --is-ancestor cf62bcf2ee1ef84c8043dd37c6c848b292915447 origin/main
```

Expected: exit `0`. If it is not an ancestor, stop #64 implementation; do not copy #65 CSS manually into #64.

- [ ] **P.2 Rebase the #64 branch on updated main**

```bash
rtk git rebase origin/main
```

Expected: design/plan commits replay cleanly. Resolve only documentation conflicts if main changed those documents; production code should still match #65.

- [ ] **P.3 Pin the #65 geometry baseline before editing**

```bash
rtk rg -n -- "--dialogue-box-height: 14\.4rem|bottom: max\(1rem, env\(safe-area-inset-bottom\)\)|max-width: 94vw|grid-template-rows: minmax\(0, 1fr\)|min-height: 0" apps/web/src/components/VisualNovelReader.svelte
```

Expected: matches for the #65 dialogue height, portrait bottom, mobile width baseline, grid row, and act-panel shrink fix. Do not proceed if the component still shows the old `18rem` / portrait-above-dialogue geometry.

---

## File Map

**Create**
- `apps/web/src/lib/visual-assets/portrait-stage.ts`
- `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts`

**Modify: story/compiler contract**
- `packages/stories/src/types.ts`
- `packages/stories/src/index.ts`
- `packages/stories/src/compiler/parse-characters.ts`
- `packages/stories/src/compiler/emit.ts`
- `packages/stories/src/compiler/__tests__/parse-characters.test.ts`
- `packages/stories/src/compiler/__tests__/emit.test.ts`
- `packages/stories/src/__tests__/stories.test.ts`
- `packages/stories/src/async/__tests__/loader.test.ts`
- `packages/stories/src/stories/index.ts`
- `packages/stories/src/stories/trainAdventure/index.ts`
- `packages/stories/src/stories/dontSaveMeBeforeMidnight/index.ts`
- `packages/stories/src/stories/theSeventhMirror/index.ts`
- `packages/stories/raw/theSeventhMirror/docs/characters.md`

**Delete via `bun compile:stories`**
- `packages/stories/src/generated/trainAdventure/presentation.ts`
- `packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts`
- `packages/stories/src/generated/theSeventhMirror/presentation.ts`

**Modify: web runtime/tests**
- `apps/web/src/lib/reader-state.svelte.ts`
- `apps/web/src/lib/reader-manager.ts`
- `apps/web/src/lib/__tests__/reader-intent.test.ts`
- `apps/web/src/lib/__tests__/reader-manager.test.ts`
- `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`
- `apps/web/src/components/ReaderShell.svelte`
- `apps/web/src/lib/visual-assets/types.ts`
- `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Modify: browser/release-gate contract**
- `packages/e2e/tests/utils.ts`
- `packages/e2e/tests/reader-visual.spec.ts`
- `packages/e2e/tests/visual-novel-deployed.spec.ts`

No dependency, DB, infrastructure, audio, or asset-source changes are expected.

---

## Task 1: Pure Scene-Prefix Portrait Projection

**Files**
- Create `apps/web/src/lib/visual-assets/portrait-stage.ts`
- Create `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts`

**Produces**

```ts
export type PortraitStageSlot = 'left' | 'right';

export type StagePortrait = {
    characterId: string;
    portrait: string;
};

export type PortraitStage = {
    left: StagePortrait | null;
    right: StagePortrait | null;
    activeSlot: PortraitStageSlot | null;
};

export function projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage;
```

- [ ] **1.1 Write RED projector tests with production-shaped entries**

```ts
const portraitLine = (
    characterId: string,
    expression = 'base'
): DialogueEntry => ({
    characterId,
    dialogue: characterId,
    portrait: `${characterId}/${expression}`,
});

const spokenLine = (characterId: string): DialogueEntry => ({
    characterId,
    dialogue: characterId,
});

const narratorLine: DialogueEntry = {
    characterId: 'narrator',
    dialogue: 'Narration',
};

const systemLine: DialogueEntry = { dialogue: 'System text' };
```

Pin these results:

```ts
expect(projectPortraitStage([], 0)).toEqual({
    left: null,
    right: null,
    activeSlot: null,
});

expect(projectPortraitStage([narratorLine], 0)).toEqual({
    left: null,
    right: null,
    activeSlot: null,
});

expect(projectPortraitStage([portraitLine('a')], 0)).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: null,
    activeSlot: 'left',
});

expect(
    projectPortraitStage([portraitLine('a'), portraitLine('b')], 1)
).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: 'right',
});

expect(
    projectPortraitStage(
        [portraitLine('a'), portraitLine('b'), portraitLine('b', 'angry')],
        2
    )
).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: { characterId: 'b', portrait: 'b/angry' },
    activeSlot: 'right',
});

expect(
    projectPortraitStage(
        [portraitLine('a'), portraitLine('b'), spokenLine('a')],
        2
    )
).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: 'left',
});
```

Pin replacement + re-entry:

```ts
const abc = [portraitLine('a'), portraitLine('b'), portraitLine('c')];
expect(projectPortraitStage(abc, 2)).toEqual({
    left: { characterId: 'c', portrait: 'c/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: 'left',
});

expect(projectPortraitStage([...abc, portraitLine('a')], 3)).toEqual({
    left: { characterId: 'c', portrait: 'c/base' },
    right: { characterId: 'a', portrait: 'a/base' },
    activeSlot: 'right',
});
```

Pin generated-narrator behavior:

```ts
const narrated = [portraitLine('a'), portraitLine('b'), narratorLine];
expect(projectPortraitStage(narrated, 2)).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: null,
});
expect(projectPortraitStage([...narrated, portraitLine('c')], 3)).toEqual({
    left: { characterId: 'c', portrait: 'c/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: 'left',
});
```

Also assert `systemLine` preserves staged portraits, unseen `spokenLine('c')` does not enter, and direct projection equals projecting a fresh copied prefix.

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
```

Expected: RED because `portrait-stage.ts` does not exist.

- [ ] **1.2 Implement the minimal pure projector**

Use only local variables:

```ts
let left: StagePortrait | null = null;
let right: StagePortrait | null = null;
let activeSlot: PortraitStageSlot | null = null;
let lastSpeakerSlot: PortraitStageSlot | null = null;
```

Replay `0..Math.min(dialogueIndex, dialogue.length - 1)` and use this decision structure:

```ts
if (!entry?.characterId) {
    activeSlot = null;
    continue;
}

const visibleSlot: PortraitStageSlot | null =
    left?.characterId === entry.characterId
        ? 'left'
        : right?.characterId === entry.characterId
          ? 'right'
          : null;

if (visibleSlot) {
    const existing = visibleSlot === 'left' ? left! : right!;
    const next = entry.portrait
        ? { characterId: entry.characterId, portrait: entry.portrait }
        : existing;
    if (visibleSlot === 'left') left = next;
    else right = next;
    activeSlot = visibleSlot;
    lastSpeakerSlot = visibleSlot;
    continue;
}

if (!entry.portrait) {
    activeSlot = null;
    continue;
}

const target: PortraitStageSlot =
    left === null
        ? 'left'
        : right === null
          ? 'right'
          : lastSpeakerSlot === 'left'
            ? 'right'
            : 'left';

const next = { characterId: entry.characterId, portrait: entry.portrait };
if (target === 'left') left = next;
else right = next;
activeSlot = target;
lastSpeakerSlot = target;
```

Return only `{ left, right, activeSlot }`.

- [ ] **1.3 Run GREEN and commit**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk bun --filter web lint
rtk git diff --check
rtk git add apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk git commit -m "feat(reader): project two-character portrait stage"
```

Expected: projection tests and web lint pass.

---

## Task 2: Atomic Placement-Contract Swap

This is intentionally one task and one commit. Do not commit after metadata deletion but before two-slot runtime/E2E conversion; that intermediate tree would render every portrait left and leave the existing local visual E2E contract red.

**Files:** all story/compiler, web runtime, component, local E2E, and page-object files from the File Map except `visual-novel-deployed.spec.ts` (Task 4).

**Produces**

```ts
// story loader: no presentation payload
export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};
```

```ts
export type VisualPortraitLayer = VisualImageLayer;
export type VisualPortraitLayers = Readonly<
    Record<PortraitStageSlot, VisualPortraitLayer>
>;

export type VisualSnapshot = {
    release: VisualReleaseState;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portraits: VisualPortraitLayers;
    activePortraitSlot: PortraitStageSlot | null;
    releaseIdentity: VisualReleaseIdentity | null;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

### 2A — RED: delete old author/runtime contract and pin the new controller contract

- [ ] **2.1 Replace Portrait Slot acceptance with a removed-directive RED test**

```ts
it('rejects removed Portrait Slot metadata instead of ignoring it', () => {
    const markdown = `## 1. 甲（A）

- **ID**: \`a\`
- **Portrait Slot**: right
`;

    expect(() => parseCharacters(markdown)).toThrow(
        /Portrait Slot.*removed.*automatic/i
    );
});
```

Keep a normal parse case without the bullet:

```ts
expect(parseCharacters(`## 1. 甲（A）

- **ID**: \`a\`
`).getById('a')).toEqual({
    id: 'a',
    name: '甲',
    aliases: [],
    portraits: {},
});
```

- [ ] **2.2 Pin emitted/loader/reader deletion RED cases**

`emit.test.ts`:

```ts
emitStory(story, dir, mockCharDir);
expect(existsSync(join(dir, 'presentation.ts'))).toBe(false);
```

`stories.test.ts`:

```ts
expect(getTrainAdventureStory('en')).not.toHaveProperty('presentation');
expect(getStoryContent('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

`async/__tests__/loader.test.ts`:

```ts
expect(await loader.load('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

`reader-manager.test.ts`:

```ts
expect(readerState).not.toHaveProperty('presentation');
```

- [ ] **2.3 Delete the old metadata-only controller test explicitly**

Delete the entire existing `it.each` in `visual-state-controller.test.ts` whose title is:

```text
places character %s in its deterministic portrait slot
```

Do not “update the fixture” for this test. Its subject is `portraitSlot()` / `presentation` resolution, which no longer exists.

- [ ] **2.4 Update the failed-replacement manager test explicitly**

In `keeps active A and its persistence when popstate B fails`, replace:

```ts
const activePresentation = readerState.presentation;
...
expect(readerState.presentation).toBe(activePresentation);
```

with the still-relevant payload invariant:

```ts
const activeFlow = readerState.activeFlow;
...
expect(readerState.activeFlow).toBe(activeFlow);
```

Keep the existing active dialogue, story/scene, pending intent, URL, persistence, and mount assertions.

- [ ] **2.5 Add two-slot controller RED cases**

Initial state:

```ts
expect(latest()).toMatchObject({
    portraits: {
        left: { state: 'omitted', identity: null, objectUrl: null },
        right: { state: 'omitted', identity: null, objectUrl: null },
    },
    activePortraitSlot: null,
});
```

Direct jump:

```ts
const dialogue = [
    { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
    { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
];
controller.update(input(dialogue, { dialogueIndex: 1 }));
await flushAsyncWork();
expect(latest().portraits.left.identity).toBe('portrait:a/base');
expect(latest().portraits.right.identity).toBe('portrait:b/base');
expect(latest().activePortraitSlot).toBe('right');
```

Retained expression/reactivation:

```ts
const dialogue = [
    { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
    { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
    { dialogue: 'A again', characterId: 'a' },
];
controller.update(input(dialogue, { dialogueIndex: 2 }));
await flushAsyncWork();
expect(latest().portraits.left.identity).toBe('portrait:a/base');
expect(latest().portraits.right.identity).toBe('portrait:b/base');
expect(latest().activePortraitSlot).toBe('left');
```

Add explicit tests for third-character replacement, narrator-with-characterId retaining both layers with `activePortraitSlot: null`, expression reload affecting one slot, one slow replacement leaving the other slot ready, both cache keys protected, both slots checked by `detachObjectUrl()`, and slot-local fallback/status.

- [ ] **2.6 Add failure-memo RED cases**

Use a counting `loadAsset` stub that rejects `b/base`:

```ts
it('does not re-request a retained failed portrait on the next line', async () => {
    const loadAsset = vi.fn(async asset => {
        if (asset.asset.identity.key === 'b/base') {
            throw new Error('broken portrait');
        }
        return decoded(asset.asset.identity.key);
    });
    const { controller, latest } = createHarness({ loadAsset });
    const dialogue = [
        { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
        { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
        { dialogue: 'Narration', characterId: 'narrator' },
    ];

    controller.update(input(dialogue, { dialogueIndex: 1 }));
    await flushAsyncWork();
    expect(latest().portraits.right.state).toBe('failed');
    const callsAfterFailure = loadAsset.mock.calls.filter(
        ([asset]) => asset.asset.identity.key === 'b/base'
    ).length;
    expect(callsAfterFailure).toBe(1);

    controller.update(input(dialogue, { dialogueIndex: 2 }));
    await flushAsyncWork();
    expect(latest().portraits.right.state).toBe('failed');
    expect(
        loadAsset.mock.calls.filter(
            ([asset]) => asset.asset.identity.key === 'b/base'
        )
    ).toHaveLength(1);
});
```

Add a second test that changes the right slot to `c/base` and proves it requests once, plus a revalidation test that returns a different release ID and proves the previously failed still-projected key is eligible for one new request.

Run the RED set:

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/lib/visual-assets/__tests__/source-factory.test.ts src/lib/visual-assets/__tests__/portrait-stage.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/components/__tests__/VisualNovelReader.test.ts
```

Expected: RED on the deleted contract/two-slot/failure-memo expectations while Task 1 projector remains GREEN.

### 2B — GREEN: remove static placement contract

- [ ] **2.7 Remove placement fields/types but retain one parser rejection sentinel**

In `parse-characters.ts`:

- remove the `PortraitSlot` import and `ParsedCharacter.portraitSlot`;
- remove `parsePortraitSlot()` and current-slot state;
- keep only a syntax detector:

```ts
const REMOVED_PORTRAIT_SLOT_RE = /^-\s+\*\*Portrait Slot\*\*:/;
```

In the character parse loop, before unrelated bullet handling:

```ts
if (REMOVED_PORTRAIT_SLOT_RE.test(line)) {
    throw new Error(
        '[story-compiler] **Portrait Slot** metadata was removed; portrait placement is automatic, so delete this bullet'
    );
}
```

Rewrite the top reserved-ID comment and reserved-ID error to mention only `characterTable`:

```ts
// Character IDs become raw-string keys in the generated characterTable.
// Reserved Object.prototype names can make characterTable[id] resolve an
// inherited property instead of CharacterInfo | undefined, so reject them.
```

```ts
throw new Error(
    `[story-compiler] character ID "${currentId}" is reserved (inherited from Object.prototype); using it as an object key breaks lookup contracts in the generated characterTable`
);
```

- [ ] **2.8 Remove presentation emission and clean stale comments/tests**

Delete `emitPresentation()` and its `writeFileSync(...presentation.ts...)` call.

Rewrite `emit.ts`'s reserved-ID comment to reference only `characterTable`; remove all `slotsByCharacterId`/`portraitSlot` reasoning.

In `emit.test.ts`, remove `portraitSlot` from mock characters and rewrite the reserved-ID test comments so they discuss only inherited `characterTable` lookups. Do not leave text such as:

```text
WITHOUT a portraitSlot
slotsByCharacterId['__proto__'] ?? defaultSlot
```

Remove the two Seventh Mirror raw bullets:

```md
- **Portrait Slot**: left
- **Portrait Slot**: right
```

- [ ] **2.9 Remove presentation from loaders/reader plumbing and all fixtures**

Remove `PortraitSlot` / `StoryPresentationMetadata` exports and change `StoryLoaderResult` to `{ dialogue, choices }`.

For all three story modules remove generated presentation imports/return fields.

Remove `readerState.presentation`, manager assignments/clears, ReaderShell derivation/prop, VisualNovelReader prop, and `VisualControllerInput.presentation`.

Remove presentation fixtures from:

- `packages/stories/src/async/__tests__/loader.test.ts`;
- `packages/stories/src/__tests__/stories.test.ts`;
- `apps/web/src/lib/__tests__/reader-intent.test.ts`;
- `apps/web/src/lib/__tests__/reader-manager.test.ts`;
- `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`;
- `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts` (`presentation: null`);
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`;
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`.

### 2C — GREEN: convert existing controller to two projected slots

- [ ] **2.10 Replace single portrait snapshot/cache fields**

In `types.ts`:

```ts
import type { PortraitStageSlot } from './portrait-stage';

export type VisualPortraitLayer = VisualImageLayer;
export type VisualPortraitLayers = Readonly<
    Record<PortraitStageSlot, VisualPortraitLayer>
>;
```

Replace controller fields with:

```ts
private readonly portraitCacheKeys: Record<PortraitStageSlot, string | null> = {
    left: null,
    right: null,
};
private readonly portraitReleaseIds: Record<PortraitStageSlot, string | null> = {
    left: null,
    right: null,
};
type PortraitFailureMemo = {
    releaseGeneration: number;
    portraitKey: string;
} | null;
private readonly portraitFailures: Record<
    PortraitStageSlot,
    PortraitFailureMemo
> = {
    left: null,
    right: null,
};
```

Initial snapshot:

```ts
portraits: Object.freeze({
    left: imageLayer('omitted'),
    right: imageLayer('omitted'),
}),
activePortraitSlot: null,
```

Add:

```ts
private portraitLayersWith(
    slot: PortraitStageSlot,
    layer: VisualPortraitLayer
): VisualSnapshot['portraits'] {
    return Object.freeze({ ...this.snapshot.portraits, [slot]: layer });
}

private hasCurrentPortraitFailure(
    slot: PortraitStageSlot,
    portraitKey: string
): boolean {
    const failure = this.portraitFailures[slot];
    return (
        failure?.releaseGeneration === this.releaseGeneration &&
        failure.portraitKey === portraitKey
    );
}
```

Clear both cache/release/failure records on dispose.

- [ ] **2.11 Reconcile projected slots without reloading known failures**

At the beginning of portrait reconciliation:

```ts
const stage = projectPortraitStage(input.dialogue, input.dialogueIndex);
```

For each slot:

1. `desired === null`: clear cache/release/failure tracking; publish omitted.
2. desired ready under active release: retain ready layer; clear failure memo.
3. `hasCurrentPortraitFailure(slot, desired.portrait)` and current layer is `missing|failed` with matching identity: retain terminal layer; do not publish loading.
4. otherwise clear stale tracking/failure and publish loading.

Publish `activePortraitSlot: stage.activeSlot` together with both portrait layers. Do not change active/staging background decisions.

- [ ] **2.12 Load projected slot targets and memoize terminal results**

Use:

```ts
private async loadPortrait(
    input: VisualControllerInput,
    generation: number,
    slot: PortraitStageSlot,
    portraitKey: string
): Promise<void>;
```

Before enqueueing a slot load in `prepareCurrentInput()`, skip it when `hasCurrentPortraitFailure(slot, portraitKey)` is true.

On ready:

```ts
this.portraitFailures[slot] = null;
```

On `missing` or `failed`:

```ts
this.portraitFailures[slot] = {
    releaseGeneration,
    portraitKey,
};
```

Then publish only that slot. A new release generation automatically makes the old memo non-matching.

`failKeyedLayers()` should project the stage and fail each desired portrait slot independently.

- [ ] **2.13 Split background/portrait freshness checks**

```ts
private isBackgroundLoadCurrent(
    input: VisualControllerInput,
    generation: number,
    releaseGeneration: number,
    key: string
): boolean {
    return (
        this.isInputCurrent(input, generation) &&
        releaseGeneration === this.releaseGeneration &&
        input.dialogue[input.dialogueIndex]?.background === key
    );
}
```

```ts
private isPortraitLoadCurrent(
    input: VisualControllerInput,
    generation: number,
    releaseGeneration: number,
    slot: PortraitStageSlot,
    key: string
): boolean {
    if (!this.isInputCurrent(input, generation)) return false;
    if (releaseGeneration !== this.releaseGeneration) return false;
    return (
        projectPortraitStage(input.dialogue, input.dialogueIndex)[slot]
            ?.portrait === key
    );
}
```

Never restore a single `isCurrent(... identity)` branch that compares portrait completion to only `entry?.portrait`.

- [ ] **2.14 Extend status/cache/detachment to both slots**

`detachObjectUrl()` checks left and right portraits and clears matching slot cache/release tracking.

`publish()` protects:

```ts
[
    this.activeBackgroundCacheKey,
    this.stagingBackgroundCacheKey,
    this.portraitCacheKeys.left,
    this.portraitCacheKeys.right,
]
```

`statusFor()` reports fallback if either portrait layer is missing/failed.

Keep `warmWithinScene()` / edge prefetch line-based.

### 2D — GREEN: render two images and rewrite existing local E2E in place

- [ ] **2.15 Render exactly two stable portrait elements**

```svelte
<img
  data-testid="visual-portrait-left"
  class="visual-portrait"
  data-portrait-state={snapshot.portraits.left.state}
  data-portrait-slot="left"
  data-portrait-active={snapshot.activePortraitSlot === 'left'}
  src={snapshot.portraits.left.objectUrl ?? undefined}
  alt=""
/>
<img
  data-testid="visual-portrait-right"
  class="visual-portrait"
  data-portrait-state={snapshot.portraits.right.state}
  data-portrait-slot="right"
  data-portrait-active={snapshot.activePortraitSlot === 'right'}
  src={snapshot.portraits.right.objectUrl ?? undefined}
  alt=""
/>
```

Do not change #65 geometry CSS yet. Component tests now expect four image elements total: two backgrounds + two portraits.

- [ ] **2.16 Replace the shared page-object single portrait getter**

```ts
get leftPortrait() {
    return this.root.getByTestId('visual-portrait-left');
}

get rightPortrait() {
    return this.root.getByTestId('visual-portrait-right');
}

get readyPortraits() {
    return this.root.locator('.visual-portrait[data-portrait-state="ready"]');
}

get activePortrait() {
    return this.root.locator('.visual-portrait[data-portrait-active="true"]');
}
```

Delete `get portrait()`; do not leave an alias.

- [ ] **2.17 Rewrite the existing flagship local test instead of adding a contradictory sibling**

Replace the old “Yuma right -> Mio left” test with:

```ts
test('alternates Yuma left, Mio right, then reactivates Yuma left', async ({
    page,
}) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(6);

    await expect(visual.leftPortrait).toHaveAttribute(
        'data-portrait-state',
        'ready'
    );
    await expect(visual.leftPortrait).toHaveAttribute(
        'data-portrait-active',
        'true'
    );
    await expect(visual.rightPortrait).toHaveAttribute(
        'data-portrait-state',
        'omitted'
    );
    const yumaSrc = await visual.leftPortrait.getAttribute('src');
    expect(yumaSrc).not.toBeNull();

    await visual.root.click();
    await expectCanonicalVisualLine(page, 7);
    await expect(visual.leftPortrait).toHaveAttribute(
        'data-portrait-active',
        'false'
    );
    await expect(visual.rightPortrait).toHaveAttribute(
        'data-portrait-state',
        'ready'
    );
    await expect(visual.rightPortrait).toHaveAttribute(
        'data-portrait-active',
        'true'
    );
    expect(await visual.leftPortrait.getAttribute('src')).toBe(yumaSrc);

    const cursor = page.getByTestId('visual-typewriter-cursor');
    if (await cursor.isVisible()) {
        await visual.root.click();
        await expect(cursor).not.toBeAttached();
    }
    await visual.root.click();
    await expectCanonicalVisualLine(page, 8);
    await expect(visual.leftPortrait).toHaveAttribute(
        'data-portrait-active',
        'true'
    );
    await expect(visual.rightPortrait).toHaveAttribute(
        'data-portrait-active',
        'false'
    );
});
```

Add direct `goto(7)` (two ready, Mio right active) and direct `goto(9)` (both ready, neither active) reconstruction checks.

- [ ] **2.18 Rewrite corrupt-Mio E2E to prove slot-local failure + no retry**

Count Mio route hits:

```ts
let mioRequests = 0;
await page.route(MIO_OBJECT, route => {
    mioRequests += 1;
    return route.fulfill({
        status: 200,
        contentType: 'image/webp',
        body: 'not-a-valid-webp',
    });
});
```

At line 6 capture Yuma-left source. Advance to 7 and assert:

```ts
await expect(visual.leftPortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
await expect(visual.rightPortrait).toHaveAttribute(
    'data-portrait-state',
    'failed'
);
expect(await visual.leftPortrait.getAttribute('src')).toBe(yumaSrc);
expect(mioRequests).toBe(1);
```

Advance to line 8 and assert right remains failed, left becomes active, and `mioRequests` is still exactly `1`.

- [ ] **2.19 Rewrite #65-conflicting geometry assertions before treating local E2E as GREEN**

Delete `expectEssentialControlsNotToOverlapPortrait` / “portrait must sit above dialogue box” assertions. #65 intentionally places the portrait behind that box.

Add:

```ts
async function expectReadyPortraitsInsideViewport(page: Page): Promise<void> {
    const visual = new VisualReaderPage(page);
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (!viewport) return;

    const count = await visual.readyPortraits.count();
    for (let index = 0; index < count; index += 1) {
        const box = await visual.readyPortraits.nth(index).boundingBox();
        expect(box).not.toBeNull();
        if (!box) continue;
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.y).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
}
```

Keep dialogue/control visibility/enabled assertions, but do not reject geometric intersection between portraits and dialogue/control boxes.

Update fixed dialogue-height expectations to #65 values:

```ts
const viewports = [
    { width: 1280, height: 800, expectedHeight: 14.4 * 16 },
    { width: 390, height: 844, expectedHeight: 0.32 * 844 },
    { width: 844, height: 390, expectedHeight: 7.6 * 16 },
] as const;
```

Call `expectReadyPortraitsInsideViewport(page)` at each viewport after portrait readiness.

### 2E — Regenerate, scan, verify, commit the entire contract swap

- [ ] **2.20 Regenerate stories and prove bounded deletion**

```bash
rtk bun compile:stories
rtk git diff --name-status -- packages/stories/src/generated packages/stories/src/stories
```

Expected presentation deletions:

```text
D packages/stories/src/generated/trainAdventure/presentation.ts
D packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts
D packages/stories/src/generated/theSeventhMirror/presentation.ts
```

The three loader modules drop presentation imports/returns. Dialogue/flow/portrait/background generated content must not churn because of placement deletion.

- [ ] **2.21 Run dead-contract scans that can actually return no matches**

```bash
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/utils.ts
```

Expected: all three scans return no matches (`rg` exit status `1`). The parser rejection uses `REMOVED_PORTRAIT_SLOT_RE` and an error string with a space, so it is intentionally not matched by the deleted-type scan; historical docs are outside the scan.

- [ ] **2.22 Run full focused GREEN including local visual E2E**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk bun compile:check
rtk git diff --check
```

Expected: stories/web tests, lint, compile drift, and Chromium/mobile Chrome/mobile Safari visual-reader tests pass on the same tree. There is no intentionally red intermediate contract commit.

- [ ] **2.23 Commit the atomic contract swap**

```bash
rtk git add packages/stories/src packages/stories/raw/theSeventhMirror/docs/characters.md apps/web/src packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): replace static slots with two-character stage"
```

Expected: one reviewable commit contains deletion of the old placement contract, two-slot runtime, failure memo, two portrait DOM nodes, and rewritten local E2E contract.

---

## Task 3: Add Dimming and Two-Portrait Widths on Top of PR #65 Geometry

**Files**
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- `packages/e2e/tests/reader-visual.spec.ts`

**Consumes:** Task 2 two-slot DOM + #65 geometry.

- [ ] **3.1 Pin active/inactive DOM state in component tests**

With Yuma-left / Mio-right and `activePortraitSlot: 'right'`:

```ts
expect(screen.getByTestId('visual-portrait-left')).toHaveAttribute(
    'data-portrait-active',
    'false'
);
expect(screen.getByTestId('visual-portrait-right')).toHaveAttribute(
    'data-portrait-active',
    'true'
);
```

Emit the same URLs with `activePortraitSlot: null`; assert both become false and both `src` values remain unchanged.

- [ ] **3.2 Add computed-style browser RED before changing CSS**

```ts
test('dims the inactive portrait and emphasizes the active portrait', async ({
    page,
}) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(7);

    await expect(visual.leftPortrait).toHaveAttribute(
        'data-portrait-active',
        'false'
    );
    await expect(visual.rightPortrait).toHaveAttribute(
        'data-portrait-active',
        'true'
    );

    expect(
        await visual.leftPortrait.evaluate(el => getComputedStyle(el).filter)
    ).toContain('brightness(0.55)');
    expect(
        await visual.rightPortrait.evaluate(el => getComputedStyle(el).filter)
    ).toContain('brightness(1)');
    await expect(visual.leftPortrait).toHaveCSS('opacity', '0.82');
    await expect(visual.rightPortrait).toHaveCSS('opacity', '1');
});
```

Run:

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium -g "dims the inactive portrait"
```

Expected: RED because Task 2 has active attributes but no dim CSS.

- [ ] **3.3 Preserve #65 geometry and change only width/emphasis properties**

Start from #65's base block. Keep these lines unchanged:

```css
bottom: max(1rem, env(safe-area-inset-bottom));
height: calc(
  100dvh - max(1rem, env(safe-area-inset-bottom)) -
    env(safe-area-inset-top)
);
```

Keep #65's `--dialogue-box-height: 14.4rem`, mobile `32dvh`, compact `7.6rem`, `grid-template-rows: minmax(0, 1fr)`, and `.act-panel { min-height: 0; }` unchanged.

Change/add only:

```css
.visual-portrait {
  /* retain #65 position/height declarations */
  max-width: min(42vw, 36rem);
  opacity: 0.82;
  filter: brightness(0.55) drop-shadow(0 1rem 2rem rgb(0 0 0 / 0.45));
  transition: filter 180ms ease, opacity 180ms ease;
}

.visual-portrait[data-portrait-active='true'] {
  z-index: 0;
  opacity: 1;
  filter: brightness(1) drop-shadow(0 1rem 2rem rgb(0 0 0 / 0.45));
}
```

Mobile portrait width becomes `54vw`. Compact landscape remains `42vw` unless the next browser gate demonstrates a concrete viewport overflow.

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  .typewriter-cursor {
    animation: none;
  }

  .visual-portrait {
    transition: none;
  }
}
```

The dialogue box remains `z-index: 10`, so active portrait `z-index: 0` is still behind it.

- [ ] **3.4 Run CSS regression checks against #65 invariants**

```bash
rtk rg -n -- "--dialogue-box-height: 14\.4rem|bottom: max\(1rem, env\(safe-area-inset-bottom\)\)|height: calc\(|grid-template-rows: minmax\(0, 1fr\)|min-height: 0" apps/web/src/components/VisualNovelReader.svelte
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk git diff --check
```

Expected: #65 geometry markers remain; component + all configured local visual-reader projects pass, including computed dim styles and viewport containment.

- [ ] **3.5 Commit styling slice**

```bash
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): dim inactive portrait speakers"
```

---

## Task 4: Update Deployed Release Gate and Run Full Verification

**Files**
- `packages/e2e/tests/visual-novel-deployed.spec.ts`
- Verify all Task 1-3 files

- [ ] **4.1 Preserve the deployed gate's strong portrait-change assertion with a semantic active locator**

Keep `findSceneAnchors()` and `requireCovered(manifest, 'portrait', portraitAfter, ...)` unchanged.

Before advancing, wait for the current projected active portrait to be ready:

```ts
await expect(visual.activePortrait).toHaveCount(1);
await expect(visual.activePortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
const portraitSrcBefore = await visual.activePortrait.getAttribute('src');
expect(portraitSrcBefore).not.toBeNull();
```

Advance:

```ts
await advanceTo(page, visual, anchors.startPage, anchors.portraitPage);
```

Then unconditionally require the newly projected active portrait to be ready and prove its source changed:

```ts
await expect(visual.activePortrait).toHaveCount(1);
await expect(visual.activePortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
const portraitSrcAfter = await visual.activePortrait.getAttribute('src');
expect(portraitSrcAfter).not.toBeNull();
expect(portraitSrcAfter).not.toBe(portraitSrcBefore);
```

This preserves the old gate's “portrait change really became ready” property while allowing the active DOM node to move from left to right. Do not use a non-waiting `evaluateAll()` baseline and do not reintroduce a single `visual.portrait` alias.

- [ ] **4.2 Typecheck the complete E2E tree, including normally ignored deployed spec**

Normal `playwright.config.ts` excludes `visual-novel-deployed.spec.ts`, but `packages/e2e/tsconfig.json` includes `tests/**/*.ts`.

```bash
rtk bunx tsc --noEmit -p packages/e2e/tsconfig.json
```

Expected: PASS; page-object changes compile in both local and remote gate specs.

- [ ] **4.3 Run release-gate config tests**

```bash
rtk bun --filter e2e test:release-gate-config
```

Expected: PASS. The remote deployed browser gate itself still requires its normal `BASE_URL` / pinned release credentials; do not invent local replacements for that evidence.

- [ ] **4.4 Run final dead-contract/single-portrait scans**

```bash
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests
rtk git diff --check
```

Expected: no matches in all three scans. Historical docs remain outside the deleted-contract scan.

- [ ] **4.5 Run repository-wide verification**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk bun compile:check
rtk bun lint
rtk bun build
rtk bun run test
```

Expected: all available local gates pass. If the remote release gate is unavailable due missing deployment credentials, record that external prerequisite; do not weaken the local assertions.

- [ ] **4.6 Review final diff for scope creep**

```bash
rtk git status --short
rtk git diff origin/main...HEAD --stat
rtk git diff origin/main...HEAD -- packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/components/VisualNovelReader.svelte packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/visual-novel-deployed.spec.ts
```

Final implementation must contain only:

1. approved design + this plan;
2. pure scene-prefix stage projection;
3. atomic removal of static placement metadata plus two-slot runtime conversion;
4. loud legacy-directive validation;
5. slot/projector async freshness + per-release failure memoization;
6. two stable portrait DOM layers and explicit page-object locators;
7. dim/active styling and narrower widths while retaining #65 geometry;
8. rewritten local and deployed visual tests.

Reject permanent home sides, stage directives, 3+ portraits, persisted stage state, new dependencies, asset generation, #65 geometry rollback, or unrelated reader refactors.

- [ ] **4.7 Commit deployed gate update**

```bash
rtk git add packages/e2e/tests/visual-novel-deployed.spec.ts
rtk git commit -m "test(reader): update deployed portrait stage gate"
```

Keep PR #64 draft until implementation diff and CI are reviewed.

## Plan Self-Review

- PR #65 is an explicit prerequisite; #64 cannot accidentally restore pre-#65 portrait geometry.
- Projector fixtures use explicit portraits for stage entry and generated narrator shape separately.
- `A -> B -> C -> A` pins side change after replacement/re-entry.
- Seventh Mirror Yuma-left/Mio-right inversion is an explicit accepted product consequence.
- Legacy `Portrait Slot` fails loudly while all placement data/types are deleted.
- Reserved-ID error/comment cleanup is named in `parse-characters.ts`, `emit.ts`, and `emit.test.ts`, so the dead-contract scan can actually return zero matches.
- The metadata-only `portraitSlot()` controller `it.each` is explicitly deleted, not mechanically edited.
- The failed-popstate manager test explicitly replaces its presentation invariant with `activeFlow` preservation.
- Metadata deletion and two-slot runtime/local E2E conversion are one atomic task/commit; no intentional E2E-red all-left commit exists.
- Portrait async freshness is slot/projector-based, not current-line portrait-based.
- Retained `missing|failed` portrait keys are memoized once per release generation, preventing `failed -> loading -> failed` loops.
- Corrupt-Mio browser coverage verifies both opposite-slot survival and exactly one request across the next line.
- #65-conflicting “portrait above/no-overlap” E2E assertions are removed and replaced by viewport + control-usability checks.
- Dimming is driven RED with browser-computed CSS before styling changes.
- `visual-novel-deployed.spec.ts` waits for active portrait readiness before and after the anchor and proves source change; it is not weakened to a non-waiting set comparison.
- `source-factory.test.ts` and every current local/deployed single-portrait call site are in the file map.
- The two highest risks—CSS merge/revert and retained failure retries—have explicit mitigations and regression gates.
