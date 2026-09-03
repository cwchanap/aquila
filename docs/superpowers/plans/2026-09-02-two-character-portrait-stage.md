# Two-Character Portrait Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic two-character visual-novel stage where speakers alternate left/right, the previous visible speaker remains on screen, and every visible non-speaker is dimmed.

**Architecture:** Add one pure scene-prefix projector that derives `{ left, right, activeSlot }` from the current scene's `DialogueEntry[]`. `VisualStateController` reconciles those two targets independently using the existing release resolver/cache/generation machinery. `VisualNovelReader.svelte` renders two stable portrait images and owns only active/inactive styling. Delete the old static `Portrait Slot` / `StoryPresentationMetadata` pipeline rather than keeping two competing placement systems.

**Tech Stack:** Bun workspaces, TypeScript, Svelte 5, Astro 5, Vitest, Testing Library, Playwright, existing `@aquila/stories` compiler/runtime assets, existing `DecodedAssetCache` + `VisualStateController`.

**Spec:** `docs/superpowers/specs/2026-09-02-two-character-portrait-stage-design.md`

## Global Constraints

- Keep all design, plan, implementation, and verification in the existing single draft PR #64.
- Stage state is scene-local and derived from `dialogue.slice(0, dialogueIndex + 1)`; never persist it to URL, bookmarks, local storage, or reader session state.
- Exactly two visible slots: `left` and `right`. No 3+ character layout or stage-direction framework.
- First visible character starts left. A second fills right. With both occupied, a new visible character replaces the slot opposite the most recent visible speaker.
- A visible character stays in its slot. A new `portrait` updates only that slot's expression; a line without `portrait` keeps the staged expression.
- An unseen character without `portrait` does not enter the stage and does not become active.
- Narration/no `characterId` preserves visible portraits, sets `activeSlot: null`, and preserves the most recent visible speaker internally for later alternation.
- New scene = empty stage.
- Delete `PortraitSlot`, `StoryPresentationMetadata`, `ParsedCharacter.portraitSlot`, generated `presentation.ts`, `readerState.presentation`, and all presentation props. No compatibility adapter.
- Reuse existing resolver, release validation, decoded cache, object-URL lifecycle, prefetch queue, and generation guards. Do not create an asset/stage manager.
- Background transition logic is out of scope and must remain behaviorally unchanged.
- Inactive presentation is fixed for now: `brightness(0.55)` + `opacity: 0.82`; active is `brightness(1)` + `opacity: 1`.
- Only filter/opacity transitions; no portrait movement/entrance/exit animation.
- Responsive CSS may change portrait sizing, never placement rules.
- Existing local visual fixtures already contain `asakura_yuma/base` and `asakura_mio/base`; do not add/regenerate source assets for this feature.
- Follow RED -> minimum implementation -> focused GREEN for each behavior slice.

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

**Modify: web runtime**
- `apps/web/src/lib/reader-state.svelte.ts`
- `apps/web/src/lib/reader-manager.ts`
- `apps/web/src/lib/__tests__/reader-intent.test.ts`
- `apps/web/src/lib/__tests__/reader-manager.test.ts`
- `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`
- `apps/web/src/components/ReaderShell.svelte`
- `apps/web/src/lib/visual-assets/types.ts`
- `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Modify: browser contract**
- `packages/e2e/tests/utils.ts`
- `packages/e2e/tests/reader-visual.spec.ts`

No dependency, DB, infrastructure, audio, or asset-source changes are expected.

---

## Task 1: Pure Scene-Prefix Portrait Projection

**Files**
- Create `apps/web/src/lib/visual-assets/portrait-stage.ts`
- Create `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts`

**Public contract**

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

- [ ] **1.1 Write RED projector tests**

Create test helpers:

```ts
const line = (characterId?: string, portrait?: string): DialogueEntry => ({
    dialogue: characterId ?? 'narration',
    ...(characterId ? { characterId } : {}),
    ...(portrait ? { portrait } : {}),
});
```

Cover these exact cases:

1. `[]` / narration-only -> both slots null, `activeSlot: null`.
2. `A(base)` -> A left active.
3. `A(base), B(base)` -> A left + B right, right active.
4. `A, B(base), B(angry)` -> B remains right and only expression changes.
5. `A(base), B(base), A(no portrait)` -> A left reactivated with base retained.
6. `A, B, C` -> C replaces A on left because B was the most recent visible speaker.
7. `A, B, A(no portrait), C` -> C replaces B on right.
8. `A, B, narration` -> A/B preserved, `activeSlot: null`; then C replaces A because B remains the last visible speaker.
9. unseen C without portrait -> no stage mutation, `activeSlot: null`.
10. direct `projectPortraitStage(dialogue, N)` equals projection of the same prefix copied into a fresh array.

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
```

Expected: RED because `portrait-stage.ts` does not exist.

- [ ] **1.2 Implement the minimal projector**

Use only local variables:

```ts
let left: StagePortrait | null = null;
let right: StagePortrait | null = null;
let activeSlot: PortraitStageSlot | null = null;
let lastSpeakerSlot: PortraitStageSlot | null = null;
```

Replay indices `0..Math.min(dialogueIndex, dialogue.length - 1)`.

Rules inside the loop:

```ts
if (!entry?.characterId) {
    activeSlot = null;
    continue;
}

const visibleSlot =
    left?.characterId === entry.characterId
        ? 'left'
        : right?.characterId === entry.characterId
          ? 'right'
          : null;

if (visibleSlot) {
    // retain expression when entry.portrait is absent
    // update only this slot when entry.portrait exists
    activeSlot = visibleSlot;
    lastSpeakerSlot = visibleSlot;
    continue;
}

if (!entry.portrait) {
    activeSlot = null;
    continue;
}

const target =
    left === null
        ? 'left'
        : right === null
          ? 'right'
          : lastSpeakerSlot === 'left'
            ? 'right'
            : 'left';
```

Return only `{ left, right, activeSlot }`; `lastSpeakerSlot` must not leak into runtime/persisted state.

- [ ] **1.3 Run GREEN and commit**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk bun --filter web lint
rtk git diff --check
rtk git add apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk git commit -m "feat(reader): project two-character portrait stage"
```

Expected: projector tests + web lint pass.

---

## Task 2: Delete the Static Portrait-Slot / Presentation Pipeline

**Files:** all story/compiler and reader-payload files listed in the File Map; keep the visual snapshot single-portrait until Task 3.

**Final interfaces after this task**

```ts
// packages/stories/src/types.ts
export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    sfx?: string;
    bgm?: string | null;
    background?: string;
    portrait?: string;
};

export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };
// no PortraitSlot / StoryPresentationMetadata
```

```ts
// packages/stories/src/stories/index.ts
export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};
```

- [ ] **2.1 Rewrite metadata-specific tests to RED**

`parse-characters.test.ts`: remove slot validation/acceptance tests and add:

```ts
it('does not expose obsolete Portrait Slot metadata', () => {
    const dir = parseCharacters(`## 1. 甲（A）

- **ID**: \`a\`
- **Portrait Slot**: right
`);
    expect(dir.getById('a')).toEqual({
        id: 'a',
        name: '甲',
        aliases: [],
        portraits: {},
    });
});
```

`emit.test.ts`:

```ts
emitStory(story, dir, mockCharDir);
expect(existsSync(join(dir, 'presentation.ts'))).toBe(false);
```

Remove `portraitSlot` from emitter test fixtures, but retain reserved `Object.prototype` ID rejection; its `characterTable[id]` safety rationale still applies.

`stories.test.ts`:

```ts
expect(getTrainAdventureStory('en')).not.toHaveProperty('presentation');
expect(getStoryContent('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

`async/__tests__/loader.test.ts`: while the current fixture still contains presentation for the RED run:

```ts
expect(await loader.load('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

`reader-manager.test.ts`:

```ts
expect(readerState).not.toHaveProperty('presentation');
```

Run:

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: RED on parsed/emitted/story/async/reader presentation behavior.

- [ ] **2.2 Remove compiler authoring support**

In `parse-characters.ts` remove:

- `PortraitSlot` import;
- `ParsedCharacter.portraitSlot`;
- `PORTRAIT_SLOT_RE`;
- `parsePortraitSlot()`;
- `currentPortraitSlot` state/reset;
- slot parsing in the main loop;
- slot field from `flushCharacter()`.

Keep reserved Object.prototype name validation for `characterTable`; simplify comments to stop mentioning `slotsByCharacterId`.

In `emit.ts` delete `emitPresentation()` and the `writeFileSync(...presentation.ts...)` call. Do not modify character/portrait/background/dialogue/flow/image-asset emission.

Remove only these two authored bullets from Seventh Mirror `characters.md`:

```md
- **Portrait Slot**: left
- **Portrait Slot**: right
```

Do not alter IDs, aliases, bios, or portrait prompts.

- [ ] **2.3 Remove presentation from story loaders**

Delete `PortraitSlot` / `StoryPresentationMetadata` exports from `packages/stories/src/index.ts`.

Change `StoryLoaderResult` to `{ dialogue, choices }`.

For all three story modules:

- remove `StoryPresentationMetadata` import;
- remove generated `storyPresentation` import;
- return only `dialogue` and `choices`.

Update `stories.test.ts` and `async/__tests__/loader.test.ts` fixtures accordingly. `AsyncStoryLoaderResult` remains `StoryLoaderResult + flow + locale`; no new loader branch/type is needed.

- [ ] **2.4 Remove presentation from web reader plumbing**

`reader-state.svelte.ts`: remove type import, `presentation` field, and reset assignment.

`reader-manager.ts`: remove both the constructor/reset clearing and `payload.presentation` assignment.

`ReaderShell.svelte`: remove the derived `presentation` value and stop passing it to `VisualNovelReader`.

`VisualNovelReader.svelte`: remove presentation type/prop/destructure and remove it from `controller.update(...)`.

`visual-state-controller.ts`: remove presentation type/input and delete `portraitSlot()`. Until Task 3 replaces the single portrait layer, pass `'left'` at the existing single-portrait helper sites so the code remains compile-safe without preserving any author contract.

Remove presentation fields from:

- `reader-intent.test.ts` `StoryPayload` fixture;
- both reader-manager test fixtures;
- `VisualNovelReader.test.ts` props;
- `visual-state-controller.test.ts` input fixtures.

Replace the old manager test “assigns presentation…” with a payload test that asserts `readerState.activeFlow` is assigned and the existing guarded `getSceneDialogue()` checks still hold.

- [ ] **2.5 Regenerate and prove the deletion is bounded**

```bash
rtk bun compile:stories
rtk git diff --name-status -- packages/stories/src/generated packages/stories/src/stories
```

Expected generated deletions:

```text
D packages/stories/src/generated/trainAdventure/presentation.ts
D packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts
D packages/stories/src/generated/theSeventhMirror/presentation.ts
```

Expected loader edits: three `packages/stories/src/stories/*/index.ts` modules drop presentation import/return only. Dialogue/flow/portrait/background generated content must not churn from this contract deletion.

- [ ] **2.6 Run GREEN, dead-contract scan, drift check, commit**

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src packages/stories/raw apps/web/src
rtk git diff --check
rtk git add packages/stories/src packages/stories/raw/theSeventhMirror/docs/characters.md apps/web/src/lib/reader-state.svelte.ts apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-intent.test.ts apps/web/src/lib/__tests__/reader-manager.test.ts apps/web/src/lib/__tests__/reader-manager-coverage.test.ts apps/web/src/components/ReaderShell.svelte apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts
rtk bun compile:check
rtk git commit -m "refactor(reader): remove static portrait slots"
```

Expected: tests/typecheck pass; dead-contract scan returns no active source/raw matches; `compile:check` creates no unstaged drift. Historical design docs are intentionally excluded from the scan.

---

## Task 3: Make `VisualStateController` Reconcile Two Projected Slots

**Files**
- `apps/web/src/lib/visual-assets/types.ts`
- `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Final snapshot contract**

```ts
import type { PortraitStageSlot } from './portrait-stage';

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

- [ ] **3.1 Add controller RED cases**

Convert initial snapshot assertion to two omitted portraits + null active slot.

Add these tests:

```ts
it('loads both projected slots for a direct jump', async () => {
    const dialogue = [
        { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
        { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
    ];
    controller.update(input(dialogue, { dialogueIndex: 1 }));
    await flushAsyncWork();
    expect(latest().portraits.left.identity).toBe('portrait:a/base');
    expect(latest().portraits.right.identity).toBe('portrait:b/base');
    expect(latest().activePortraitSlot).toBe('right');
});
```

```ts
it('reactivates a staged speaker when the current line omits portrait', async () => {
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
});
```

Also pin:

- narration keeps both ready layers and sets `activePortraitSlot: null`;
- third character replaces only the projected slot;
- expression change reloads only that character's slot;
- while one replacement is `loading`, the opposite ready portrait remains mounted;
- both ready portrait cache keys are protected;
- either slot can independently become missing/failed while the other remains ready;
- `detachObjectUrl()` checks both portrait slots;
- soft release revalidation refreshes both desired slots;
- a late decode cannot write into a slot whose projected target changed.

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: RED because snapshot/controller are still single-portrait.

- [ ] **3.2 Replace single portrait type/state with slot records**

Replace controller fields:

```ts
private readonly portraitCacheKeys: Record<PortraitStageSlot, string | null> = {
    left: null,
    right: null,
};
private readonly portraitReleaseIds: Record<PortraitStageSlot, string | null> = {
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

Add one immutable helper:

```ts
private portraitLayersWith(
    slot: PortraitStageSlot,
    layer: VisualPortraitLayer
): VisualSnapshot['portraits'] {
    return Object.freeze({ ...this.snapshot.portraits, [slot]: layer });
}
```

Clear both slot-local cache/release values on dispose.

- [ ] **3.3 Reconcile both projected targets in `prepareLoadingLayers()`**

Derive once:

```ts
const stage = projectPortraitStage(input.dialogue, input.dialogueIndex);
```

For each `slot of ['left', 'right'] as const`:

- `stage[slot] === null` -> clear that slot tracking and publish omitted;
- desired portrait already ready under current release -> retain current layer;
- changed/stale desired portrait -> clear only that slot tracking and publish loading with `portrait:<key>` identity.

Publish `activePortraitSlot: stage.activeSlot` with the two reconciled layers. Leave active/staging background decisions unchanged.

- [ ] **3.4 Load/fail stage targets, not only `entry.portrait`**

In `prepareCurrentInput()` derive the same stage. A resolver-less direct jump to narration may still require retained staged portraits, so compute keyed visuals from current background + both projected portrait keys.

Use:

```ts
private async loadPortrait(
    input: VisualControllerInput,
    generation: number,
    slot: PortraitStageSlot,
    portraitKey: string
): Promise<void>;
```

Load each desired slot independently if it is not ready under the active release. On ready/fallback/failure publish only that slot through `portraitLayersWith`.

`failKeyedLayers()` must fail each currently projected portrait target independently and preserve `activePortraitSlot` from the projection.

- [ ] **3.5 Split async freshness guards by visual kind**

Keep background validity current-line-based:

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

Portrait validity must use the projected slot target:

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

Do not reuse the old `entry?.portrait === identity.key` check for retained/inactive portraits.

- [ ] **3.6 Extend lifecycle/status bookkeeping**

`detachObjectUrl()` checks active background, staging background, left portrait, right portrait; clear every matching slot's cache/release tracking.

`publish()` protects both `portraitCacheKeys.left` and `.right` in addition to background keys.

`statusFor()` returns fallback if either portrait slot is missing/failed.

Keep `warmWithinScene()` and edge prefetch line-based; do not project future stage layouts.

- [ ] **3.7 Render two stable portrait elements so the new snapshot is consumable**

`VisualNovelReader.emptySnapshot` becomes two omitted layers + null active slot.

Replace the old image with exactly:

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

Keep the existing left/right anchors for this task. Update component fixtures/assertions so there are four images total: two backgrounds + two portraits.

- [ ] **3.8 Run GREEN and commit**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk rg -n "snapshot\.portrait\b|latest\(\)\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)" apps/web/src
rtk git diff --check
rtk git add apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts
rtk git commit -m "feat(reader): retain two portrait slots"
```

Expected: tests/lint pass; single-portrait snapshot/test selector scan returns no active web matches.

---

## Task 4: Add Inactive-Speaker Dimming and Two-Portrait Responsive Sizing

**Files**
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- `packages/e2e/tests/utils.ts`
- `packages/e2e/tests/reader-visual.spec.ts`

- [ ] **4.1 Pin active-slot DOM behavior in component tests**

Use a snapshot with Yuma left, Mio right, `activePortraitSlot: 'right'` and assert:

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

Emit the same portrait layers with `activePortraitSlot: null`; assert both become false **without changing either `src`**.

- [ ] **4.2 Add Playwright accessors and a computed-style RED test**

Replace the old page-object getter with:

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
```

Add a focused Chromium test using direct dialogue 7 (projection contains Yuma left + Mio right, Mio active):

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

Run before CSS changes:

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium -g "dims the inactive portrait"
```

Expected: RED because Task 3 renders the active attribute but both images still have the old single-portrait filter/opacity.

- [ ] **4.3 Implement exact active/inactive styling**

Change base portrait CSS to:

```css
.visual-portrait {
  position: absolute;
  bottom: calc(
    var(--dialogue-box-height) +
    max(1rem, env(safe-area-inset-bottom)) +
    0.75rem
  );
  z-index: -1;
  display: block;
  width: auto;
  max-width: min(42vw, 36rem);
  height: auto;
  max-height: calc(
    100dvh - var(--dialogue-box-height) - 3.5rem -
      env(safe-area-inset-top) - env(safe-area-inset-bottom)
  );
  object-fit: contain;
  object-position: bottom;
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

Keep left/right anchors unchanged.

Mobile portrait breakpoint becomes:

```css
.visual-portrait {
  max-width: 54vw;
}
```

instead of `82vw`. Keep compact landscape at `42vw`.

Extend reduced motion:

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

No transforms or movement animations.

- [ ] **4.4 Run styling GREEN and commit**

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium -g "dims the inactive portrait"
rtk git diff --check
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): dim inactive portrait speakers"
```

Expected: component tests/lint and computed-style browser test pass.

---

## Task 5: Prove Alternation, Direct Reconstruction, Responsive Geometry, and Full Regression Gate

**Files**
- `packages/e2e/tests/reader-visual.spec.ts`
- Verify all files from Tasks 1-4

The existing Seventh Mirror `ch1_act2` sequence is the production fixture:

```text
dialogue=6 -> Yuma base
dialogue=7 -> Mio base
dialogue=8 -> Yuma base
dialogue=9 -> narration
```

No production story line should be added solely for testing.

- [ ] **5.1 Add the flagship Yuma -> Mio -> Yuma browser regression**

Use line 6 to prove first-visible-left, then sequentially line 7 and 8:

```ts
test('alternates Yuma and Mio while retaining the inactive speaker', async ({
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
    expect(await visual.leftPortrait.getAttribute('src')).toBe(yumaSrc);
});
```

This is a regression gate on behavior already driven RED/GREEN by Tasks 1, 3, and 4; it should pass immediately if those slices are correct.

- [ ] **5.2 Pin direct reconstruction and narration**

Add a focused direct `goto(7)` assertion that both portraits are immediately ready with Yuma-left inactive and Mio-right active without first visiting line 6.

Then direct `goto(9)` and assert both portraits stay ready while both `data-portrait-active` values are false. This proves narration is reconstructed from the prefix rather than from mutable prior navigation history.

- [ ] **5.3 Update responsive/control geometry checks for both ready portraits**

Rename the helper to `expectEssentialControlsNotToOverlapPortraits` and iterate `visual.readyPortraits`.

For every ready portrait:

```ts
const portraitBox = await visual.readyPortraits.nth(index).boundingBox();
expect(portraitBox).not.toBeNull();
if (portraitBox) {
    expect(portraitBox.y + portraitBox.height).toBeLessThanOrEqual(
        dialogueBox.y - 12 + 1
    );
}
```

Run the existing desktop `1280x800`, mobile portrait `390x844`, and compact landscape `844x390` geometry cases. Essential settings/history/continue controls must not overlap either ready portrait.

- [ ] **5.4 Run the complete visual-reader spec across all configured projects**

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
```

Expected: Chromium, mobile Chrome, and mobile Safari visual-reader cases pass, including existing background crossfade, mode swaps, history, release/fallback, and responsive tests.

- [ ] **5.5 Run focused story/web gates and dead-contract scans**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test
rtk bun --filter web lint
rtk bun compile:check
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src packages/stories/raw apps/web/src
rtk rg -n "getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests
rtk git diff --check
```

Expected: test/typecheck/lint/compile/diff checks pass; both `rg` scans intentionally return no matches (ripgrep exit status `1` means the negative scan succeeded).

- [ ] **5.6 Run repository-wide verification**

```bash
rtk bun lint
rtk bun build
rtk bun run test
```

Expected: Turbo lint/build/test gates pass. If a browser/environment-only command is blocked, record the exact command and failure; do not remove or weaken the assertion.

- [ ] **5.7 Review final diff for scope creep**

```bash
rtk git status --short
rtk git diff main...HEAD --stat
rtk git diff main...HEAD -- packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/components/VisualNovelReader.svelte packages/e2e/tests/reader-visual.spec.ts
```

Final implementation must contain only:

1. approved design + this plan;
2. pure two-slot projection;
3. deletion of static portrait placement metadata/plumbing;
4. two-slot controller/cache/release reconciliation;
5. two portrait DOM layers with dim/active/responsive styling;
6. focused unit/component/E2E updates.

Reject accidental stage directives, 3+ portraits, persisted stage state, new dependencies, asset generation, or unrelated reader refactors.

- [ ] **5.8 Commit final E2E regression coverage**

```bash
rtk git add packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "test(reader): cover alternating portrait stage"
```

Keep PR #64 as the only PR for this task. Keep it draft until the implementation diff and CI have been reviewed.

## Plan Self-Review

- No `TODO`, `TBD`, or placeholder implementation decisions remain.
- Every approved design behavior maps to a concrete RED/GREEN or regression step.
- The old static slot contract is deleted before two-slot runtime work; there is no long-lived dual-placement system.
- Portrait async guards are explicitly slot/projector-based, which covers retained portraits on narration/direct jumps.
- Browser dimming is driven RED using computed CSS before the styling implementation.
- All commands use scripts already present in the repository; no undeclared `astro check` dependency is assumed.
- The task remains one PR (#64) with small reviewable commits inside that PR.
