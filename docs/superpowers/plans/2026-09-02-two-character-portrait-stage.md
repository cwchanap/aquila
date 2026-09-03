# Two-Character Portrait Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic two-character visual-novel stage where visible speakers alternate left/right, the previous visible speaker remains on screen, and every visible non-speaker is dimmed.

**Architecture:** Add one pure scene-prefix projector that derives `{ left, right, activeSlot }` from the current scene's `DialogueEntry[]`. `VisualStateController` reconciles those two targets independently using the existing release resolver/cache/generation machinery. `VisualNovelReader.svelte` renders two stable portrait images and owns only active/inactive styling. Delete the old static `Portrait Slot` / `StoryPresentationMetadata` pipeline instead of keeping two competing placement systems; retain only a compiler error sentinel so obsolete authoring syntax fails loudly.

**Tech Stack:** Bun workspaces, TypeScript, Svelte 5, Astro 5, Vitest, Testing Library, Playwright, existing `@aquila/stories` compiler/runtime assets, existing `DecodedAssetCache` + `VisualStateController`.

**Spec:** `docs/superpowers/specs/2026-09-02-two-character-portrait-stage-design.md`

## Global Constraints

- Keep all design, plan, implementation, and verification in the existing single draft PR #64.
- Stage state is scene-local and derived from `dialogue.slice(0, dialogueIndex + 1)`; never persist it to URL, bookmarks, local storage, or reader session state.
- Exactly two visible slots: `left` and `right`. No 3+ character layout or stage-direction framework.
- First portrait-bearing character starts left. A second fills right. With both occupied, a new portrait-bearing character replaces the slot opposite the most recent visible speaker.
- A character stays on its side only while still staged. Once replaced, re-entry is treated as a new visible character and may put that character on the opposite side from an earlier appearance.
- A visible character that speaks again stays in its current slot. A new `portrait` updates only that slot's expression; a line without `portrait` keeps the staged expression.
- An unseen character without `portrait` does not enter the stage and does not become active. This includes generated narrator lines with `characterId: Narrator` and no portrait.
- A line without `characterId` likewise leaves the stage unchanged and sets `activeSlot: null`.
- Non-visible dialogue preserves the most recent visible speaker internally for later alternation.
- New scene = empty stage.
- Delete `PortraitSlot`, `StoryPresentationMetadata`, `ParsedCharacter.portraitSlot`, generated `presentation.ts`, `readerState.presentation`, and all presentation props. No compatibility adapter.
- Keep a narrow parser guard that rejects any remaining `- **Portrait Slot**: ...` bullet with a clear removed-metadata error. Do not silently ignore the old authoring directive.
- Reuse existing resolver, release validation, decoded cache, object-URL lifecycle, prefetch queue, and generation guards. Do not create an asset/stage manager.
- Background transition logic is out of scope and must remain behaviorally unchanged.
- Inactive presentation is fixed for now: `brightness(0.55)` + `opacity: 0.82`; active is `brightness(1)` + `opacity: 1`.
- Only filter/opacity transitions; no portrait movement/entrance/exit animation.
- Responsive CSS may change portrait sizing, never placement rules.
- Existing local visual fixtures already contain `asakura_yuma/base` and `asakura_mio/base`; do not add/regenerate source assets for this feature.
- Rewrite existing single-portrait E2E assertions; do not leave a `visual.portrait` compatibility locator that hides which slot is being asserted.
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

- [ ] **1.1 Write RED projector tests with production-shaped entries**

Use helpers that make portrait presence explicit:

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

Cover these exact cases:

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

Pin replacement and re-entry explicitly:

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

Pin production-shaped narration after two staged speakers:

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

Also assert:

- `systemLine` preserves staged portraits and clears `activeSlot`;
- an unseen `spokenLine('c')` without portrait does not enter or become active;
- direct `projectPortraitStage(dialogue, N)` equals projecting a fresh copy of `dialogue.slice(0, N + 1)`.

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

## Task 2: Delete Static Placement Metadata and Make Legacy Syntax Fail Loudly

**Files**
- All story/compiler and reader-payload files listed in the File Map
- `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`

Keep the visual snapshot single-portrait until Task 3; this task removes only the obsolete author/runtime placement contract.

**Final story interface**

```ts
export type DialogueEntry = {
    character?: string;
    characterId?: string;
    dialogue: string;
    sfx?: string;
    bgm?: string | null;
    background?: string;
    portrait?: string;
};

export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};
```

- [ ] **2.1 Rewrite metadata-specific tests to RED**

Replace slot acceptance tests with a removed-directive rejection:

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

Keep normal parsing coverage without the bullet:

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

`emit.test.ts`:

```ts
emitStory(story, dir, mockCharDir);
expect(existsSync(join(dir, 'presentation.ts'))).toBe(false);
```

Remove `portraitSlot` from emitter fixtures but retain reserved `Object.prototype` ID rejection because `characterTable[id]` remains an ordinary-object lookup.

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

Run:

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/lib/visual-assets/__tests__/source-factory.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: RED on removed-directive, emitted presentation, story/async payload, reader state, and `VisualControllerInput` fixture behavior.

- [ ] **2.2 Remove placement data while retaining one rejection sentinel**

In `parse-characters.ts` remove:

- `PortraitSlot` import;
- `ParsedCharacter.portraitSlot`;
- `parsePortraitSlot()`;
- `currentPortraitSlot` state/reset;
- slot field from `flushCharacter()`.

Keep a regex only for rejection:

```ts
const REMOVED_PORTRAIT_SLOT_RE = /^-\s+\*\*Portrait Slot\*\*:\s*.*$/;
```

In the character parse loop, before generic ignored prose can swallow the line:

```ts
if (REMOVED_PORTRAIT_SLOT_RE.test(line)) {
    throw new Error(
        `[story-compiler] character "${currentName}" uses removed Portrait Slot metadata; portrait placement is automatic — remove the **Portrait Slot** bullet`
    );
}
```

This sentinel has no placement semantics.

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

Update `stories.test.ts` and `async/__tests__/loader.test.ts` fixtures accordingly. `AsyncStoryLoaderResult` remains `StoryLoaderResult + flow + locale`; no loader branch is needed.

- [ ] **2.4 Remove presentation from web reader/controller fixtures**

`reader-state.svelte.ts`: remove type import, `presentation` field, and reset assignment.

`reader-manager.ts`: remove constructor clearing and `payload.presentation` assignment.

`ReaderShell.svelte`: remove the derived `presentation` value and stop passing it to `VisualNovelReader`.

`VisualNovelReader.svelte`: remove presentation type/prop/destructure and remove it from `controller.update(...)`.

`visual-state-controller.ts`: remove presentation type/input and delete `portraitSlot()`. Until Task 3 replaces the single portrait layer, pass `'left'` at the existing single-portrait helper sites so compilation stays green without an authoring contract.

Remove `presentation` fields from:

- `reader-intent.test.ts` `StoryPayload` fixture;
- both reader-manager test fixtures;
- `VisualNovelReader.test.ts` props;
- `visual-state-controller.test.ts` input fixtures;
- `source-factory.test.ts` `VisualControllerInput` fixture (`presentation: null` currently exists there).

Replace the old manager “assigns presentation” test with one that asserts `activeFlow` assignment plus the existing guarded `getSceneDialogue()` behavior.

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

Expected loader edits: the three story loader modules drop presentation import/return only. Dialogue/flow/portrait/background generated content must not churn from this contract deletion.

- [ ] **2.6 Run GREEN, dead-contract scans, drift check, commit**

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/lib/visual-assets/__tests__/source-factory.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk git diff --check
```

Expected:

- tests/typecheck pass;
- the first scan returns no dead type/runtime contract matches;
- the raw-authoring scan returns no legacy bullets (exit status `1` is success for this negative scan);
- `parse-characters.ts` still contains the explicit removed-directive error text, which is intentionally not part of either negative scan.

Then:

```bash
rtk git add packages/stories/src packages/stories/raw/theSeventhMirror/docs/characters.md apps/web/src/lib/reader-state.svelte.ts apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-intent.test.ts apps/web/src/lib/__tests__/reader-manager.test.ts apps/web/src/lib/__tests__/reader-manager-coverage.test.ts apps/web/src/components/ReaderShell.svelte apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts
rtk bun compile:check
rtk git commit -m "refactor(reader): remove static portrait slots"
```

Expected: `compile:check` creates no unstaged generated/story-loader drift.

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

Convert the initial snapshot assertion to two omitted portraits + null active slot.

Direct jump:

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

Retained expression/reactivation:

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

Production-shaped narrator:

```ts
it('retains both slots and clears active speaker on narrator lines', async () => {
    const dialogue = [
        { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
        { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
        { dialogue: 'Narration', characterId: 'narrator' },
    ];
    controller.update(input(dialogue, { dialogueIndex: 2 }));
    await flushAsyncWork();
    expect(latest().portraits.left.identity).toBe('portrait:a/base');
    expect(latest().portraits.right.identity).toBe('portrait:b/base');
    expect(latest().activePortraitSlot).toBeNull();
});
```

Also pin:

- third character replaces only the projected slot;
- A -> B -> C -> A re-entry produces C-left/A-right and loads only the projected replacement slot;
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

In `prepareCurrentInput()` derive the same stage. A resolver-less direct jump to narrator/system text may still require retained staged portraits, so compute keyed visuals from current background + both projected portrait keys.

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

`detachObjectUrl()` checks active background, staging background, left portrait, and right portrait; clear every matching slot's cache/release tracking.

`publish()` protects both `portraitCacheKeys.left` and `.right` in addition to background keys.

`statusFor()` returns fallback if either portrait slot is missing/failed.

Keep `warmWithinScene()` and edge prefetch line-based; do not project future stage layouts.

- [ ] **3.7 Render two stable portrait elements so the snapshot is consumable**

`VisualNovelReader.emptySnapshot` becomes two omitted layers + null active slot.

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

Keep existing left/right anchors for this task. Update component fixtures/assertions so there are four images total: two backgrounds + two portraits.

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

## Task 4: Rewrite Local Browser Contract, Then Add Dimming and Responsive Sizing

**Files**
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- `packages/e2e/tests/utils.ts`
- `packages/e2e/tests/reader-visual.spec.ts`

The point of this task is to replace existing one-portrait assertions, not add new tests beside stale ones.

- [ ] **4.1 Pin active-slot DOM behavior in component tests**

Use a snapshot with Yuma left, Mio right, `activePortraitSlot: 'right'`:

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

Emit the same portrait layers with `activePortraitSlot: null`; assert both become false without changing either `src`.

- [ ] **4.2 Replace the shared page-object single portrait getter**

Delete:

```ts
get portrait() {
    return this.root.getByTestId('visual-portrait');
}
```

Add only explicit semantics:

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

Do not add an `anyPortrait`/`portrait` alias.

- [ ] **4.3 Rewrite the existing Seventh Mirror local E2E tests before adding CSS**

Replace the current test named `renders Yuma right, advances to Mio left, and preserves the URL line` with the new flagship sequence:

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

Rewrite the existing invalid-Mio test so failure is slot-local:

```ts
await visual.goto(6);
await expect(visual.leftPortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
const yumaSrc = await visual.leftPortrait.getAttribute('src');

await visual.root.click();
await expectCanonicalVisualLine(page, 7);
await expect(visual.rightPortrait).toHaveAttribute(
    'data-portrait-state',
    'failed'
);
await expect(visual.leftPortrait).toHaveAttribute(
    'data-portrait-state',
    'ready'
);
expect(await visual.leftPortrait.getAttribute('src')).toBe(yumaSrc);
```

Preserve the existing background/status/dialogue/control assertions in that test.

Rewrite the existing responsive helper from one `visual.portrait` box to every `visual.readyPortraits.nth(index)` and assert essential settings/history/continue controls do not overlap any ready portrait.

Add direct reconstruction assertions:

- `goto(7)` immediately yields Yuma-left inactive + Mio-right active without visiting line 6;
- `goto(9)` immediately yields both portraits ready with both `data-portrait-active="false"` because line 9 is generated narrator dialogue with `characterId` and no portrait.

Run the updated behavioral subset before CSS dimming:

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium -g "alternates Yuma|portrait bytes are invalid|direct portrait stage"
```

Expected: stage/slot assertions pass after Task 3; no old static-slot expectation remains.

- [ ] **4.4 Add a computed-style RED test**

At direct dialogue 7, Yuma is left/inactive and Mio is right/active:

```ts
test('dims the inactive portrait and emphasizes the active portrait', async ({
    page,
}) => {
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
});
```

Run:

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium -g "dims the inactive portrait"
```

Expected: RED because both images still use the old undimmed single-portrait styling.

- [ ] **4.5 Implement exact active/inactive and responsive styling**

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

Mobile portrait breakpoint:

```css
.visual-portrait {
  max-width: 54vw;
}
```

Keep compact landscape at `42vw`.

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

No transforms or movement animations.

- [ ] **4.6 Run complete local visual-reader GREEN and commit**

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/utils.ts apps/web/src
rtk git diff --check
```

Expected: component tests/lint and Chromium/mobile Chrome/mobile Safari visual-reader cases pass; old single-portrait selectors return no matches.

Commit:

```bash
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "feat(reader): dim alternating portrait speakers"
```

---

## Task 5: Update the Deployed Release Gate and Run Full Verification

**Files**
- `packages/e2e/tests/visual-novel-deployed.spec.ts`
- Verify all files from Tasks 1-4

The deployed gate currently uses the shared single `visual.portrait` locator. It must adopt the same two-slot page-object contract rather than preserve a special compatibility path.

- [ ] **5.1 Rewrite deployed portrait-change verification to accept either slot**

Keep `findSceneAnchors()` and `requireCovered(manifest, 'portrait', portraitAfter, ...)`: the gate should still prove the release covers the portrait key on the change line.

Replace same-node `portraitSrcBefore` logic with a set of ready portrait sources:

```ts
const portraitSrcsBefore = await visual.readyPortraits.evaluateAll(nodes =>
    nodes
        .map(node => node.getAttribute('src'))
        .filter((src): src is string => src !== null)
);

await advanceTo(page, visual, anchors.startPage, anchors.portraitPage);

await expect
    .poll(async () => {
        const current = await visual.readyPortraits.evaluateAll(nodes =>
            nodes
                .map(node => node.getAttribute('src'))
                .filter((src): src is string => src !== null)
        );
        return current.some(src => !portraitSrcsBefore.includes(src));
    })
    .toBe(true);
```

This works for both cases the release gate may discover:

- a new character enters the opposite slot while the prior portrait remains;
- the same visible character changes expression and its slot's source changes.

Do not add a single-portrait alias to `VisualReaderPage` for this gate.

- [ ] **5.2 Typecheck the complete E2E tree, including the normally ignored deployed spec**

The normal `playwright.config.ts` excludes `visual-novel-deployed.spec.ts`, but `packages/e2e/tsconfig.json` includes `tests/**/*.ts`. Run:

```bash
rtk bunx tsc --noEmit -p packages/e2e/tsconfig.json
```

Expected: PASS, proving the deployed spec compiles against the new page-object contract even without remote release-gate credentials.

- [ ] **5.3 Run the deployed release gate when its required environment is available**

If `BASE_URL`, `RELEASE_GATE_RELEASE_ID`, and `RELEASE_GATE_MANIFEST_SHA256` are configured for an HTTPS deployed target (plus preview/audio variables when applicable), run:

```bash
rtk bun --filter e2e test:release-gate
```

Expected: the deployed gate still validates release identity, newly loaded portrait/background assets, mode swaps, bookmark/choice flow, and failure fallbacks.

If those deployment credentials are unavailable in the implementation environment, record that the remote-only gate was not executable; do not weaken or delete its assertions. The mandatory local compile gate remains Step 5.2.

- [ ] **5.4 Run focused story/web gates and legacy-contract scans**

```bash
rtk bun --filter @aquila/stories test
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test
rtk bun --filter web lint
rtk bun compile:check
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src apps/web/src
rtk rg -n "\*\*Portrait Slot\*\*" packages/stories/raw
rtk rg -n "visual\.portrait\b|getByTestId\(['\"]visual-portrait['\"]\)|data-testid=\"visual-portrait\"" apps/web/src packages/e2e/tests
rtk git diff --check
```

Expected:

- tests/typecheck/lint/compile/diff checks pass;
- dead placement-type scan returns no matches;
- raw legacy directive scan returns no matches;
- single-portrait browser/source scan returns no matches, including `visual-novel-deployed.spec.ts`;
- the parser's removed-directive validation remains intentional and is not targeted by the raw-source scan.

- [ ] **5.5 Run repository-wide verification**

```bash
rtk bun lint
rtk bun build
rtk bun run test
```

Expected: Turbo lint/build/test gates pass. If a browser/environment-only command is blocked, record the exact command and failure; do not remove or weaken the assertion.

- [ ] **5.6 Review final diff for scope creep**

```bash
rtk git status --short
rtk git diff main...HEAD --stat
rtk git diff main...HEAD -- packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/components/VisualNovelReader.svelte packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts packages/e2e/tests/visual-novel-deployed.spec.ts
```

Final implementation must contain only:

1. approved design + this plan;
2. pure two-slot projection;
3. deletion of static portrait placement metadata/plumbing plus the legacy-directive compiler error;
4. two-slot controller/cache/release reconciliation;
5. two portrait DOM layers with dim/active/responsive styling;
6. updated local and deployed browser contracts.

Reject accidental permanent home sides, stage directives, 3+ portraits, persisted stage state, new dependencies, asset generation, or unrelated reader refactors.

- [ ] **5.7 Commit release-gate/regression updates**

```bash
rtk git add packages/e2e/tests/visual-novel-deployed.spec.ts
rtk git commit -m "test(reader): update deployed portrait stage gate"
```

Keep PR #64 as the only PR for this task. Keep it draft until the implementation diff and CI have been reviewed.

## Plan Self-Review

- Projector fixtures use explicit portrait-bearing entries whenever a character is supposed to enter the stage; generated narrator shape is covered separately.
- A -> B -> C -> A explicitly proves that re-entry may change a character's side after replacement.
- Legacy `Portrait Slot` authoring fails loudly rather than being silently ignored.
- `source-factory.test.ts` is included in the presentation-contract deletion slice.
- Every current `visual.portrait` consumer is accounted for: local reader spec, responsive/failure assertions, shared page object, and deployed release gate.
- Existing local single-portrait tests are rewritten in place rather than duplicated with contradictory new tests.
- Portrait async guards are slot/projector-based, covering retained portraits on narrator/direct jumps.
- Browser dimming is driven RED using computed CSS before styling implementation.
- The deployed spec gets a mandatory TypeScript gate even when remote release credentials are unavailable.
- All commands use scripts or configs already present in the repository; no undeclared Astro check dependency is assumed.
- The task remains one PR (#64) with small reviewable commits inside that PR.
