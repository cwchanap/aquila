# Two-Character Portrait Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic two-character visual-novel stage where portrait-bearing speakers alternate left/right, the previous visible speaker remains on screen, inactive portraits are dimmed, and retained failures are not re-fetched on every line.

**Architecture:** Add one pure scene-prefix projector. Replace the static `Portrait Slot` / `StoryPresentationMetadata` pipeline and single-portrait controller state in one atomic contract-swap commit. Extend the existing `VisualStateController` to reconcile `left` and `right` targets independently, including slot-specific async freshness and one per-slot failure memo keyed by release generation. Render two stable portrait images, then add dimming/width changes on top of PR #65's portrait-behind-dialogue geometry.

**Tech Stack:** Bun workspaces, TypeScript, Svelte 5, Astro 5, Vitest, Testing Library, Playwright, existing `@aquila/stories` compiler/runtime assets, existing `DecodedAssetCache` + `VisualStateController`.

**Spec:** `docs/superpowers/specs/2026-09-02-two-character-portrait-stage-design.md`

## Global Constraints

- Use existing draft PR #64 only.
- PR #65 (`fix/vn-reader-portrait-sidebar`, commit `cf62bcf2`) must land first; rebase #64 on `origin/main` before production work.
- Preserve #65's `bottom`, full-height portrait sizing, reduced dialogue-box heights, reader grid row, and act-panel `min-height`. #64 may narrow portrait `max-width` and add active/inactive styling.
- Stage state is scene-local and derived from `dialogue.slice(0, dialogueIndex + 1)`; never persist it.
- Exactly two visible slots: `left` and `right`.
- First portrait-bearing character starts left. With both slots occupied, a new portrait-bearing character replaces the slot opposite the most recent visible speaker.
- A character keeps its side only while staged; after replacement, re-entry may switch sides.
- A visible speaker without a new `portrait` retains its staged expression.
- An unseen character with no `portrait` does not enter or become active, including generated narrator lines with `characterId: Narrator`.
- Delete `PortraitSlot`, `StoryPresentationMetadata`, parsed `portraitSlot`, generated `presentation.ts`, `readerState.presentation`, and presentation props. No compatibility adapter.
- Keep one parser sentinel that rejects any leftover `- **Portrait Slot**: ...` directive.
- Rewrite active source/test comments/errors so deleted `slotsByCharacterId`, `defaultSlot`, and `portraitSlot` terminology does not remain.
- Reuse current resolver, release validation, decoded cache, prefetch, background transition, generation guards, and object-URL lifecycle.
- A `missing`/`failed` portrait is terminal once per `(releaseGeneration, portraitKey)`; a different key or release generation may retry.
- Inactive styling is fixed: `brightness(0.55)` + `opacity: 0.82`; active is `brightness(1)` + `opacity: 1`.
- No movement/entrance animation, stage manager, permanent home-side metadata, new dependency, asset generation, or persisted schema change.

## Accepted Flagship Consequence

Seventh Mirror currently authors Mio-left / Yuma-right, but Yuma is the first portrait-bearing speaker in `ch1_act2`. Removing authored home sides intentionally produces:

```text
dialogue 6 -> Yuma left active
dialogue 7 -> Yuma left dim, Mio right active
dialogue 8 -> Yuma left active, Mio right dim
```

Do not restore `slotsByCharacterId` to preserve the old sides.

## Risks

### CSS merge/revert

PR #65 changes the exact CSS block #64 also touches. Implementing from pre-#65 `main` would silently restore the old portrait-above-dialogue layout.

**Mitigation:** #65 first, rebase, then preserve its geometry and rewrite old E2E “portrait sits above / does not overlap dialogue” assertions before treating local E2E as GREEN.

### Retained failure loop

Current `isLayerCurrentForRelease()` only accepts `ready`. A retained failed slot would otherwise cycle `failed -> loading -> failed` and fetch the same immutable object on every line.

**Mitigation:** per-slot `(releaseGeneration, portraitKey)` failure memo plus unit and corrupt-Mio browser coverage.

---

## Pre-flight: PR #65 Must Be in Main

- [ ] **P1 Verify #65 landed**

```bash
rtk git fetch origin
rtk git merge-base --is-ancestor cf62bcf2ee1ef84c8043dd37c6c848b292915447 origin/main
```

Expected: exit `0`. Otherwise stop #64 implementation.

- [ ] **P2 Rebase #64**

```bash
rtk git rebase origin/main
```

Expected: documentation commits replay cleanly.

- [ ] **P3 Verify #65 geometry is the implementation baseline**

```bash
rtk rg -n -- "--dialogue-box-height: 14\.4rem|bottom: max\(1rem, env\(safe-area-inset-bottom\)\)|max-width: 94vw|grid-template-rows: minmax\(0, 1fr\)|min-height: 0" apps/web/src/components/VisualNovelReader.svelte
```

Expected: all five #65 markers are present.

---

## File Map

**Create**
- `apps/web/src/lib/visual-assets/portrait-stage.ts`
- `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts`

**Story/compiler**
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
- delete generated `presentation.ts` in all three generated stories through compiler regeneration

**Web runtime/tests**
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

**Browser/release gate**
- `packages/e2e/tests/utils.ts`
- `packages/e2e/tests/reader-visual.spec.ts`
- `packages/e2e/tests/visual-novel-deployed.spec.ts`

---

## Task 1: Pure Scene-Prefix Projector

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

- [ ] **1.1 Write RED tests with production-shaped fixtures**

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
```

Pin these cases:

```ts
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
        [portraitLine('a'), portraitLine('b'), spokenLine('a')],
        2
    )
).toEqual({
    left: { characterId: 'a', portrait: 'a/base' },
    right: { characterId: 'b', portrait: 'b/base' },
    activeSlot: 'left',
});
```

Pin replacement/re-entry:

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

Pin generated narration:

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

Also cover empty/system lines, expression replacement, unseen no-portrait speaker, and direct-prefix reconstruction.

- [ ] **1.2 Verify RED**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
```

Expected: module missing.

- [ ] **1.3 Implement minimal projector**

Use local `left`, `right`, `activeSlot`, and `lastSpeakerSlot` variables. For each entry:

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
```

Place the new `{ characterId, portrait }`, set `activeSlot` and `lastSpeakerSlot`, and return only `{ left, right, activeSlot }`.

- [ ] **1.4 Verify GREEN and commit**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk bun --filter web lint
rtk git diff --check
rtk git add apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk git commit -m "feat(reader): project two-character portrait stage"
```

---

## Task 2: Atomic Static-to-Two-Slot Contract Swap

Do not commit between static metadata deletion and two-slot runtime/local E2E conversion. That intermediate tree would intentionally render all portraits left and break the old visual E2E contract.

### 2A — Write RED tests and delete obsolete tests

- [ ] **2.1 Replace Portrait Slot acceptance with a loud-removal RED case**

```ts
it('rejects removed Portrait Slot metadata', () => {
    expect(() =>
        parseCharacters(`## 1. 甲（A）

- **ID**: \`a\`
- **Portrait Slot**: right
`)
    ).toThrow(/Portrait Slot.*removed.*automatic/i);
});
```

Normal character parsing without that bullet must still produce only `{ id, name, aliases, portraits }`.

- [ ] **2.2 Pin presentation deletion RED cases**

```ts
emitStory(story, dir, mockCharDir);
expect(existsSync(join(dir, 'presentation.ts'))).toBe(false);
```

```ts
expect(getStoryContent('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

```ts
expect(await loader.load('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

- [ ] **2.3 Delete the old controller metadata-only test explicitly**

Delete the entire `visual-state-controller.test.ts` `it.each` titled:

```text
places character %s in its deterministic portrait slot
```

Its subject (`portraitSlot()` / `presentation`) is gone; do not translate it into a two-slot test.

- [ ] **2.4 Replace failed-popstate presentation preservation with flow preservation**

In `keeps active A and its persistence when popstate B fails`, replace:

```ts
const activePresentation = readerState.presentation;
expect(readerState.presentation).toBe(activePresentation);
```

with:

```ts
const activeFlow = readerState.activeFlow;
expect(readerState.activeFlow).toBe(activeFlow);
```

Keep the existing active dialogue/story/scene/pending-intent/URL/persistence assertions.

- [ ] **2.5 Add two-slot controller RED cases**

Direct jump:

```ts
controller.update(
    input(
        [
            { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
            { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
        ],
        { dialogueIndex: 1 }
    )
);
await flushAsyncWork();
expect(latest().portraits.left.identity).toBe('portrait:a/base');
expect(latest().portraits.right.identity).toBe('portrait:b/base');
expect(latest().activePortraitSlot).toBe('right');
```

Add explicit cases for narrator retention, expression update, reactivation with no new portrait, third-character replacement, slow replacement preserving opposite slot, both cache keys protected, both slots detached, and slot-local fallback/status.

- [ ] **2.6 Add failure-memo RED case**

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

Add one case proving a changed portrait key requests again and one case proving a different release ID permits one retry.

- [ ] **2.7 Run RED set**

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/lib/visual-assets/__tests__/source-factory.test.ts src/lib/visual-assets/__tests__/portrait-stage.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/components/__tests__/VisualNovelReader.test.ts
```

Expected: new contract assertions fail; Task 1 projector stays green.

### 2B — Remove static placement contract

- [ ] **2.8 Remove placement data but retain one syntax sentinel**

In `parse-characters.ts` remove `PortraitSlot`, `ParsedCharacter.portraitSlot`, `parsePortraitSlot`, and slot state. Keep:

```ts
const REMOVED_PORTRAIT_SLOT_RE = /^-\s+\*\*Portrait Slot\*\*:/;
```

and throw:

```ts
throw new Error(
    '[story-compiler] **Portrait Slot** metadata was removed; portrait placement is automatic, so delete this bullet'
);
```

Rewrite reserved-ID comments/error to reference only `characterTable`.

- [ ] **2.9 Remove presentation emission and stale explanatory text**

Delete `emitPresentation()` and the `presentation.ts` write.

Rewrite `emit.ts` and `emit.test.ts` reserved-ID comments so they discuss only inherited `characterTable` lookups. Remove all comments mentioning “no portraitSlot”, `slotsByCharacterId`, or `?? defaultSlot`.

Remove Mio/Yuma raw `Portrait Slot` bullets.

- [ ] **2.10 Remove presentation from loaders/reader/test fixtures**

Change `StoryLoaderResult` to `{ dialogue, choices }`; remove presentation imports/returns from all three stories.

Remove `readerState.presentation`, manager assignments/clears, ReaderShell derivation/prop, VisualNovelReader prop, and `VisualControllerInput.presentation`.

Remove presentation fixtures from:

- `packages/stories/src/async/__tests__/loader.test.ts`
- `packages/stories/src/__tests__/stories.test.ts`
- `apps/web/src/lib/__tests__/reader-intent.test.ts`
- `apps/web/src/lib/__tests__/reader-manager.test.ts`
- `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

### 2C — Convert existing controller to two slots

- [ ] **2.11 Change snapshot types**

```ts
import type { PortraitStageSlot } from './portrait-stage';

export type VisualPortraitLayer = VisualImageLayer;
export type VisualPortraitLayers = Readonly<
    Record<PortraitStageSlot, VisualPortraitLayer>
>;
```

`VisualSnapshot` gets `portraits: { left, right }` and `activePortraitSlot`.

- [ ] **2.12 Add slot-local controller bookkeeping**

Define this **at module scope before the controller class**:

```ts
type PortraitFailureMemo = {
    releaseGeneration: number;
    portraitKey: string;
} | null;
```

Inside the class:

```ts
private readonly portraitCacheKeys: Record<PortraitStageSlot, string | null> = {
    left: null,
    right: null,
};
private readonly portraitReleaseIds: Record<PortraitStageSlot, string | null> = {
    left: null,
    right: null,
};
private readonly portraitFailures: Record<
    PortraitStageSlot,
    PortraitFailureMemo
> = {
    left: null,
    right: null,
};
```

Add:

```ts
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

Clear both slot records on dispose.

- [ ] **2.13 Reconcile projected slots**

Derive:

```ts
const stage = projectPortraitStage(input.dialogue, input.dialogueIndex);
```

For each slot:

1. empty desired slot -> clear cache/release/failure and publish omitted;
2. ready desired identity under current release -> retain it;
3. matching failure memo + current `missing|failed` matching identity -> retain terminal layer and do not publish loading;
4. otherwise clear stale memo/tracking and publish loading.

Publish `activePortraitSlot: stage.activeSlot`.

- [ ] **2.14 Load projected targets and memoize failures**

Use:

```ts
private async loadPortrait(
    input: VisualControllerInput,
    generation: number,
    slot: PortraitStageSlot,
    portraitKey: string
): Promise<void>;
```

Skip a slot load when `hasCurrentPortraitFailure(slot, portraitKey)` is true.

On ready set `portraitFailures[slot] = null`.

On `missing` or `failed` set:

```ts
this.portraitFailures[slot] = {
    releaseGeneration,
    portraitKey,
};
```

A new release generation makes the old memo non-matching.

- [ ] **2.15 Split async freshness helpers**

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

Do not restore a single current-line identity helper for both visual kinds.

- [ ] **2.16 Extend lifecycle/status bookkeeping**

Protect both portrait cache keys. Detach both portrait layers. `statusFor()` treats either missing/failed portrait as fallback. Keep background and prefetch behavior unchanged.

### 2D — Render two images and rewrite local browser contract in place

- [ ] **2.17 Render two stable portrait nodes**

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

Do not change #65 geometry CSS in this step.

- [ ] **2.18 Replace page-object single portrait getter**

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

Delete `get portrait()`.

- [ ] **2.19 Rewrite existing flagship E2E**

Replace the old Yuma-right/Mio-left test with line 6 -> 7 -> 8 assertions for Yuma-left/Mio-right/Yuma-left. Add direct `goto(7)` and `goto(9)` prefix reconstruction assertions.

- [ ] **2.20 Rewrite corrupt-Mio E2E and pin one request**

Count Mio route hits. At line 7 assert right failed, left/Yuma remains ready with the same source, and request count is `1`. Advance to line 8 and assert right remains failed, Yuma becomes active, and request count is still `1`.

- [ ] **2.21 Replace #65-conflicting geometry assertions**

Delete the helper/assertions requiring the portrait to sit above the dialogue box or not geometrically overlap controls.

Use viewport containment instead:

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

Update dialogue heights to #65 values:

```ts
const viewports = [
    { width: 1280, height: 800, expectedHeight: 14.4 * 16 },
    { width: 390, height: 844, expectedHeight: 0.32 * 844 },
    { width: 844, height: 390, expectedHeight: 7.6 * 16 },
] as const;
```

Continue asserting Settings/History/Continue visibility and usability; overlap behind the dialogue box is allowed.

### 2E — Generate, scan, verify, commit

- [ ] **2.22 Regenerate stories**

```bash
rtk bun compile:stories
rtk git diff --name-status -- packages/stories/src/generated packages/stories/src/stories
```

Expected: only the three generated `presentation.ts` deletions plus the three story loader presentation removals attributable to this contract cut; no dialogue/flow asset churn.

- [ ] **2.23 Run deletion scans**

```bash
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/utils.ts
```

Expected: all scans return no matches. The parser sentinel identifier is `REMOVED_PORTRAIT_SLOT_RE`, not a deleted type/field.

- [ ] **2.24 Run complete local GREEN**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk bun compile:check
rtk git diff --check
```

Expected: all focused unit/component/local browser gates pass on the same tree.

- [ ] **2.25 Commit atomic contract swap**

```bash
rtk git add packages/stories/src packages/stories/raw/theSeventhMirror/docs/characters.md apps/web/src packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): replace static slots with two-character stage"
```

---

## Task 3: Dimming and Width Changes on Top of #65 Geometry

**Files**
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- `packages/e2e/tests/reader-visual.spec.ts`

- [ ] **3.1 Pin active attributes without source churn**

Component fixture: Yuma left, Mio right, right active. Assert left `data-portrait-active=false`, right `true`. Emit same sources with `activePortraitSlot: null`; assert both false and both `src` unchanged.

- [ ] **3.2 Add computed-style RED**

```ts
const visual = new VisualReaderPage(page);
await visual.goto(7);
expect(
    await visual.leftPortrait.evaluate(el => getComputedStyle(el).filter)
).toContain('brightness(0.55)');
expect(
    await visual.rightPortrait.evaluate(el => getComputedStyle(el).filter)
).toContain('brightness(1)');
await expect(visual.leftPortrait).toHaveCSS('opacity', '0.82');
await expect(visual.rightPortrait).toHaveCSS('opacity', '1');
```

Run Chromium-only before CSS changes; expect RED.

- [ ] **3.3 Change only width/emphasis properties**

Preserve #65:

```css
bottom: max(1rem, env(safe-area-inset-bottom));
height: calc(
  100dvh - max(1rem, env(safe-area-inset-bottom)) -
    env(safe-area-inset-top)
);
```

Preserve dialogue heights `14.4rem`, `32dvh`, `7.6rem`, grid row, and act-panel `min-height`.

Set:

```css
.visual-portrait {
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

Mobile portrait cap: `54vw`. Compact landscape: retain `42vw` unless browser containment fails.

Reduced motion removes portrait transition.

- [ ] **3.4 Verify #65 markers and browser GREEN**

```bash
rtk rg -n -- "--dialogue-box-height: 14\.4rem|bottom: max\(1rem, env\(safe-area-inset-bottom\)\)|grid-template-rows: minmax\(0, 1fr\)|min-height: 0" apps/web/src/components/VisualNovelReader.svelte
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk git diff --check
```

Expected: #65 geometry remains and all local visual-reader projects pass.

- [ ] **3.5 Commit styling**

```bash
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): dim inactive portrait speakers"
```

---

## Task 4: Deployed Gate and Full Verification

**Files**
- `packages/e2e/tests/visual-novel-deployed.spec.ts`

- [ ] **4.1 Replace same-node deployed portrait assertion with semantic active portrait**

Keep `findSceneAnchors()` and `requireCovered()`.

Before advancing:

```ts
await expect(visual.activePortrait).toHaveCount(1);
await expect(visual.activePortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
const portraitSrcBefore = await visual.activePortrait.getAttribute('src');
expect(portraitSrcBefore).not.toBeNull();
```

Advance to `anchors.portraitPage`, then require readiness again:

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

This preserves the existing gate's strong “changed portrait is ready” property while allowing the active DOM node to switch slots. Do not use a non-waiting `evaluateAll()` baseline.

- [ ] **4.2 Compile normally ignored deployed spec**

```bash
rtk bunx tsc --noEmit -p packages/e2e/tsconfig.json
```

Expected: PASS; `tests/**/*.ts` includes `visual-novel-deployed.spec.ts` even though normal Playwright ignores it.

- [ ] **4.3 Run release-gate config tests**

```bash
rtk bun --filter e2e test:release-gate-config
```

Expected: PASS. The remote browser gate still requires its normal deployment/release credentials.

- [ ] **4.4 Run final scans**

```bash
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests
rtk git diff --check
```

Expected: no matches.

- [ ] **4.5 Run repository verification**

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

Expected: all available local gates pass. If remote release-gate credentials are absent, record that external prerequisite; do not weaken assertions.

- [ ] **4.6 Review diff scope**

```bash
rtk git status --short
rtk git diff origin/main...HEAD --stat
rtk git diff origin/main...HEAD -- packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/components/VisualNovelReader.svelte packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/visual-novel-deployed.spec.ts
```

Reject permanent home sides, stage directives, 3+ portraits, persistence, new dependencies, asset generation, #65 rollback, or unrelated reader refactors.

- [ ] **4.7 Commit deployed gate update**

```bash
rtk git add packages/e2e/tests/visual-novel-deployed.spec.ts
rtk git commit -m "test(reader): update deployed portrait stage gate"
```

## Plan Self-Review

- PR #65 is a hard prerequisite; #64 cannot restore pre-#65 geometry.
- Projector fixtures explicitly distinguish portrait-bearing speakers from narrator/no-portrait lines.
- `A -> B -> C -> A` pins side-switching re-entry.
- Yuma-left/Mio-right is an explicit accepted flagship consequence.
- Legacy `Portrait Slot` fails loudly while placement types/data are deleted.
- `parse-characters.ts`, `emit.ts`, and `emit.test.ts` stale `slotsByCharacterId/defaultSlot/portraitSlot` commentary is explicitly removed.
- The metadata-only controller `it.each` is explicitly deleted.
- The failed-popstate manager test explicitly preserves `activeFlow` instead of deleted presentation.
- Static deletion + two-slot runtime + local E2E rewrite are one atomic commit; no intentional all-left red window exists.
- Portrait freshness is projector/slot-based.
- `PortraitFailureMemo` is module-level and valid TypeScript; retained failures are terminal once per release generation.
- Corrupt-Mio E2E checks opposite-slot survival and exactly one request across the next line.
- Old portrait-above/no-overlap geometry assertions are replaced with viewport/control-usability assertions compatible with #65.
- Dimming is browser-computed-style RED/GREEN.
- Deployed gate waits for active portrait readiness before and after the anchor and proves the source changed.
- `source-factory.test.ts` and every local/deployed single-portrait call site are accounted for.
- CSS merge/revert and retained-failure retry loop are explicit risks with gates.
