# Two-Character Portrait Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a deterministic two-character visual-novel stage where speakers alternate between left and right, the previous visible speaker remains on screen, and every visible non-speaker is dimmed.

**Architecture:** Add one pure scene-prefix projection that derives `{ left, right, activeSlot }` from `DialogueEntry[]` and the current index. `VisualStateController` reconciles those two projected slots independently using the existing resolver/cache/release machinery, while `VisualNovelReader.svelte` owns only two stable `<img>` layers and active/inactive presentation styling. Delete the old static `Portrait Slot` / `StoryPresentationMetadata` pipeline instead of layering dynamic staging on top of obsolete metadata.

**Tech Stack:** Bun 1.3 workspaces, TypeScript 5.9, Svelte 5 runes, Astro 5, Vitest, Testing Library, Playwright, the existing `@aquila/stories` compiler/runtime-asset contracts, and the existing web decoded-asset cache/controller.

**Spec:** `docs/superpowers/specs/2026-09-02-two-character-portrait-stage-design.md`

## Global Constraints

- Deliver the design, implementation plan, implementation, and verification in the existing single draft PR #64; do not split this task into multiple PRs.
- The stage is scene-local and derived from `dialogue.slice(0, dialogueIndex + 1)`; do not persist stage state in URL, bookmarks, local storage, or `ReaderSessionState`.
- Maximum visible portraits is exactly two: `left` and `right`.
- First visible character starts left. A new visible character fills the opposite empty slot, or replaces the slot opposite the most recent visible speaker when both slots are occupied.
- A visible character that speaks again stays in its existing slot. If that line supplies a new `portrait`, replace only that slot's portrait key; if the line omits `portrait`, keep the currently staged expression.
- A character that is not already visible and has no `portrait` does not enter the stage. The line has no active portrait, so all visible portraits are dimmed.
- A line without `characterId` does not alter the two staged portraits and has `activeSlot: null`; keep the last visible speaker internally so later new-character placement still alternates correctly.
- New scenes project from an empty stage; portraits never carry across scene boundaries.
- Remove the static `Portrait Slot`, `PortraitSlot`, `StoryPresentationMetadata`, generated `presentation.ts`, and `readerState.presentation` pipeline. Do not add a compatibility adapter or migration layer.
- Reuse the existing release resolver, `DecodedAssetCache`, prefetch queue, generation guards, fallback semantics, and object-URL lifecycle. Do not add an asset manager or stage manager.
- Keep existing background transition behavior unchanged.
- Dimming is presentation-only: inactive portraits use `brightness(0.55)` and `opacity: 0.82`; active portraits use `brightness(1)` and `opacity: 1`. Do not make these values story configuration.
- Use only a short filter/opacity transition; no portrait movement, entrance, or exit animation.
- Responsive breakpoints change portrait sizing only. They must not change the stage-placement algorithm.
- Preserve existing visual fixture assets: both `asakura_mio/base` and `asakura_yuma/base` are already in the local visual fixture manifest; do not regenerate or add portrait source assets for this task.
- Follow TDD for every behavior slice: observe focused RED, implement the minimum production change, then run focused GREEN before the task commit.

---

## File Structure

### New focused unit

- Create `apps/web/src/lib/visual-assets/portrait-stage.ts` — pure deterministic scene-prefix projection; no loading, cache, Svelte, or release logic.
- Create `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts` — complete placement/reconstruction contract for the pure projection.

### Story/compiler contract cleanup

- Modify `packages/stories/src/types.ts` — remove `PortraitSlot` and `StoryPresentationMetadata`; `DialogueEntry` remains unchanged.
- Modify `packages/stories/src/index.ts` — stop exporting removed presentation types.
- Modify `packages/stories/src/compiler/parse-characters.ts` — remove `portraitSlot` parsing/state and simplify reserved-ID comments to the still-valid `characterTable` risk.
- Modify `packages/stories/src/compiler/emit.ts` — stop emitting `presentation.ts`; keep character/portrait/background/dialogue/flow generation unchanged.
- Modify `packages/stories/src/compiler/__tests__/parse-characters.test.ts` — replace slot parsing tests with a test proving obsolete slot metadata no longer affects parsed character data.
- Modify `packages/stories/src/compiler/__tests__/emit.test.ts` — prove `presentation.ts` is not emitted; preserve character-ID safety coverage.
- Modify `packages/stories/src/__tests__/stories.test.ts` — story content is only dialogue + choices.
- Modify `packages/stories/src/async/__tests__/loader.test.ts` — async payloads carry dialogue/choices/flow/locale, not presentation metadata.
- Modify `packages/stories/src/stories/index.ts` — remove `presentation` from `StoryLoaderResult`.
- Modify `packages/stories/src/stories/trainAdventure/index.ts` — remove generated presentation import/return.
- Modify `packages/stories/src/stories/dontSaveMeBeforeMidnight/index.ts` — remove generated presentation import/return.
- Modify `packages/stories/src/stories/theSeventhMirror/index.ts` — remove generated presentation import/return.
- Modify `packages/stories/raw/theSeventhMirror/docs/characters.md` — remove Mio/Yuma `Portrait Slot` bullets; portrait prompts and IDs remain authoritative.
- Delete through compiler regeneration:
  - `packages/stories/src/generated/trainAdventure/presentation.ts`
  - `packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts`
  - `packages/stories/src/generated/theSeventhMirror/presentation.ts`

### Web runtime

- Modify `apps/web/src/lib/reader-state.svelte.ts` — remove `presentation` reactive payload.
- Modify `apps/web/src/lib/reader-manager.ts` — stop clearing/assigning presentation metadata.
- Modify `apps/web/src/lib/__tests__/reader-intent.test.ts` — remove presentation from `StoryPayload` fixture.
- Modify `apps/web/src/lib/__tests__/reader-manager.test.ts` — remove presentation fixtures/assertions while preserving payload and dialogue-lookup coverage.
- Modify `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts` — remove presentation from defensive fixtures.
- Modify `apps/web/src/components/ReaderShell.svelte` — stop deriving/passing `presentation`.
- Modify `apps/web/src/lib/visual-assets/types.ts` — replace one slotted `portrait` with explicit `portraits.left`, `portraits.right`, and `activePortraitSlot`.
- Modify `apps/web/src/lib/visual-assets/visual-state-controller.ts` — reconcile two projected portrait targets independently and protect both cache entries.
- Modify `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts` — cover two-slot loading, retained expressions, replacement, async guards, cache protection, detachment, fallback, and revalidation.
- Modify `apps/web/src/components/VisualNovelReader.svelte` — remove presentation prop, render two stable portrait layers, and style active/inactive/responsive states.
- Modify `apps/web/src/components/__tests__/VisualNovelReader.test.ts` — structural two-layer and active-state component coverage.

### Browser contract

- Modify `packages/e2e/tests/utils.ts` — replace the single portrait page-object getter with left/right/ready portrait locators.
- Modify `packages/e2e/tests/reader-visual.spec.ts` — prove Yuma-left -> Mio-right -> Yuma-left reactivation, dimming, canonical URL behavior, and two-portrait responsive geometry.

No new dependencies, persisted schema, story syntax, visual fixture source, or infrastructure files are required.

---

### Task 1: Add the Pure Portrait Stage Projection

**Files:**
- Create: `apps/web/src/lib/visual-assets/portrait-stage.ts`
- Create: `apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts`

**Interfaces:**
- Consumes: `readonly DialogueEntry[]` and a zero-based `dialogueIndex`.
- Produces:

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

- Guarantees: the function is pure, starts from an empty stage on every call, and never reads or writes controller state.

- [ ] **Step 1: Write the projection contract as failing unit tests**

Create `portrait-stage.test.ts` with compact test entries:

```ts
import type { DialogueEntry } from '@aquila/stories';
import { describe, expect, it } from 'vitest';
import { projectPortraitStage } from '../portrait-stage';

const line = (
    characterId?: string,
    portrait?: string
): DialogueEntry => ({
    dialogue: characterId ?? 'narration',
    ...(characterId ? { characterId } : {}),
    ...(portrait ? { portrait } : {}),
});

describe('projectPortraitStage', () => {
    it('starts empty before any visible portrait', () => {
        expect(projectPortraitStage([], 0)).toEqual({
            left: null,
            right: null,
            activeSlot: null,
        });
        expect(projectPortraitStage([line()], 0)).toEqual({
            left: null,
            right: null,
            activeSlot: null,
        });
    });

    it('puts the first visible character on the left', () => {
        expect(projectPortraitStage([line('a', 'a/base')], 0)).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: null,
            activeSlot: 'left',
        });
    });

    it('fills the opposite slot for the second visible character', () => {
        expect(
            projectPortraitStage(
                [line('a', 'a/base'), line('b', 'b/base')],
                1
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'right',
        });
    });

    it('keeps a visible character in place and updates only its expression', () => {
        expect(
            projectPortraitStage(
                [
                    line('a', 'a/base'),
                    line('b', 'b/base'),
                    line('b', 'b/angry'),
                ],
                2
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/angry' },
            activeSlot: 'right',
        });
    });

    it('reactivates a visible character without moving it', () => {
        const stage = projectPortraitStage(
            [line('a', 'a/base'), line('b', 'b/base'), line('a')],
            2
        );
        expect(stage.left).toEqual({ characterId: 'a', portrait: 'a/base' });
        expect(stage.right).toEqual({ characterId: 'b', portrait: 'b/base' });
        expect(stage.activeSlot).toBe('left');
    });

    it('replaces the slot opposite the most recent visible speaker', () => {
        expect(
            projectPortraitStage(
                [
                    line('a', 'a/base'),
                    line('b', 'b/base'),
                    line('c', 'c/base'),
                ],
                2
            )
        ).toEqual({
            left: { characterId: 'c', portrait: 'c/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'left',
        });

        expect(
            projectPortraitStage(
                [
                    line('a', 'a/base'),
                    line('b', 'b/base'),
                    line('a'),
                    line('c', 'c/base'),
                ],
                3
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'c', portrait: 'c/base' },
            activeSlot: 'right',
        });
    });

    it('dims through narration without forgetting the last speaker side', () => {
        const dialogue = [
            line('a', 'a/base'),
            line('b', 'b/base'),
            line(),
        ];
        expect(projectPortraitStage(dialogue, 2)).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: null,
        });

        expect(
            projectPortraitStage([...dialogue, line('c', 'c/base')], 3)
        ).toEqual({
            left: { characterId: 'c', portrait: 'c/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'left',
        });
    });

    it('does not introduce an unseen character without a portrait', () => {
        expect(
            projectPortraitStage(
                [line('a', 'a/base'), line('b', 'b/base'), line('c')],
                2
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: null,
        });
    });

    it('reconstructs direct navigation entirely from the dialogue prefix', () => {
        const dialogue = [
            line('a', 'a/base'),
            line('b', 'b/base'),
            line(),
            line('a'),
            line('c', 'c/base'),
        ];
        const direct = projectPortraitStage(dialogue, 4);
        const copiedPrefix = projectPortraitStage(dialogue.slice(0, 5), 4);
        expect(direct).toEqual(copiedPrefix);
        expect(direct).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'c', portrait: 'c/base' },
            activeSlot: 'right',
        });
    });
});
```

- [ ] **Step 2: Run the new test and verify RED**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
```

Expected: FAIL because `../portrait-stage` does not exist.

- [ ] **Step 3: Implement the minimal deterministic projector**

Create `portrait-stage.ts` with this state machine; keep `lastSpeakerSlot` local and out of the returned type:

```ts
import type { DialogueEntry } from '@aquila/stories';

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

const opposite = (slot: PortraitStageSlot): PortraitStageSlot =>
    slot === 'left' ? 'right' : 'left';

export function projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage {
    let left: StagePortrait | null = null;
    let right: StagePortrait | null = null;
    let activeSlot: PortraitStageSlot | null = null;
    let lastSpeakerSlot: PortraitStageSlot | null = null;
    const end = Math.min(dialogueIndex, dialogue.length - 1);

    for (let index = 0; index <= end; index += 1) {
        const entry = dialogue[index];
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
                  : lastSpeakerSlot
                    ? opposite(lastSpeakerSlot)
                    : 'left';
        const next = {
            characterId: entry.characterId,
            portrait: entry.portrait,
        };
        if (target === 'left') left = next;
        else right = next;
        activeSlot = target;
        lastSpeakerSlot = target;
    }

    return { left, right, activeSlot };
}
```

- [ ] **Step 4: Run focused GREEN and typecheck the web workspace**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk bun --filter web astro check
```

Expected: projection tests PASS; Astro/TypeScript check reports no new errors.

- [ ] **Step 5: Commit the pure stage slice**

```bash
rtk git add apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/__tests__/portrait-stage.test.ts
rtk git commit -m "feat(reader): project two-character portrait stage"
```

---

### Task 2: Delete Static Portrait Placement Metadata End-to-End

**Files:**
- Modify: `packages/stories/src/types.ts`
- Modify: `packages/stories/src/index.ts`
- Modify: `packages/stories/src/compiler/parse-characters.ts`
- Modify: `packages/stories/src/compiler/emit.ts`
- Modify: `packages/stories/src/compiler/__tests__/parse-characters.test.ts`
- Modify: `packages/stories/src/compiler/__tests__/emit.test.ts`
- Modify: `packages/stories/src/__tests__/stories.test.ts`
- Modify: `packages/stories/src/async/__tests__/loader.test.ts`
- Modify: `packages/stories/src/stories/index.ts`
- Modify: `packages/stories/src/stories/trainAdventure/index.ts`
- Modify: `packages/stories/src/stories/dontSaveMeBeforeMidnight/index.ts`
- Modify: `packages/stories/src/stories/theSeventhMirror/index.ts`
- Modify: `packages/stories/raw/theSeventhMirror/docs/characters.md`
- Delete by regeneration: `packages/stories/src/generated/trainAdventure/presentation.ts`
- Delete by regeneration: `packages/stories/src/generated/dontSaveMeBeforeMidnight/presentation.ts`
- Delete by regeneration: `packages/stories/src/generated/theSeventhMirror/presentation.ts`
- Modify: `apps/web/src/lib/reader-state.svelte.ts`
- Modify: `apps/web/src/lib/reader-manager.ts`
- Modify: `apps/web/src/lib/__tests__/reader-intent.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager.test.ts`
- Modify: `apps/web/src/lib/__tests__/reader-manager-coverage.test.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Modify: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`

**Interfaces:**
- Removes: `PortraitSlot`, `StoryPresentationMetadata`, `ParsedCharacter.portraitSlot`, `StoryLoaderResult.presentation`, `readerState.presentation`, `VisualNovelReader.presentation`, and `VisualControllerInput.presentation`.
- Preserves: `DialogueEntry.characterId` + `DialogueEntry.portrait` as the only stage inputs.
- Temporary behavior until Task 3: the still-single portrait controller uses `'left'` wherever it previously called `portraitSlot(...)`; this is not a compatibility path, only the compile-safe intermediate state before the two-slot controller lands.

- [ ] **Step 1: Rewrite presentation-specific tests to the deletion contract and observe RED**

In `parse-characters.test.ts`, remove the slot acceptance/rejection tests and replace them with:

```ts
it('does not expose obsolete Portrait Slot metadata on parsed characters', () => {
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

In `emit.test.ts`, change the output contract to:

```ts
emitStory(story, dir, mockCharDir);
expect(existsSync(join(dir, 'presentation.ts'))).toBe(false);
```

Remove `portraitSlot` from all test character fixtures. Keep reserved Object.prototype ID tests, but rewrite their comments to reference only `characterTable` lookups.

In `stories.test.ts` add the deletion assertion before removing the old presentation assertions:

```ts
expect(getTrainAdventureStory('en')).not.toHaveProperty('presentation');
expect(getStoryContent('train_adventure', 'en')).not.toHaveProperty(
    'presentation'
);
```

In `async/__tests__/loader.test.ts`, keep the current fixture for the RED observation and add:

```ts
const result = await loader.load('train_adventure', 'en');
expect(result).not.toHaveProperty('presentation');
```

In `reader-manager.test.ts`, add:

```ts
expect(readerState).not.toHaveProperty('presentation');
```

Run:

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: FAIL on parsed `portraitSlot`, emitted `presentation.ts`, story/async `presentation`, and `readerState.presentation`.

- [ ] **Step 2: Remove the story/compiler presentation types and parser state**

Make `packages/stories/src/types.ts` stop after `DialogueMap` before choice types; delete both presentation declarations:

```ts
export type DialogueMap = { [sectionKey: string]: DialogueEntry[] };

// no PortraitSlot
// no StoryPresentationMetadata
```

Remove their exports from `packages/stories/src/index.ts`.

In `parse-characters.ts`:

- remove the `PortraitSlot` import;
- remove `portraitSlot?: PortraitSlot` from `ParsedCharacter`;
- remove `PORTRAIT_SLOT_RE`, `parsePortraitSlot`, `currentPortraitSlot`, reset logic, and parse-loop handling;
- stop writing `portraitSlot` in `flushCharacter()`;
- retain reserved Object.prototype-name rejection because `characterTable[id]` is still an ordinary-object lookup;
- simplify comments so they no longer mention `slotsByCharacterId`.

`- **Portrait Slot**: ...` then behaves like unrelated character prose and has no runtime effect.

- [ ] **Step 3: Stop emitting generated presentation files**

Delete `emitPresentation()` from `emit.ts` and remove this write from `emitStory()`:

```ts
writeFileSync(
    join(outDir, 'presentation.ts'),
    emitPresentation(characterDir)
);
```

Keep `emitCharacters`, `emitPortraits`, `emitBackgrounds`, scenes, dialogue, flow, choices, and `image-assets.json` unchanged. Simplify the reserved-ID emitter comments to the still-valid `characterTable` case.

Remove the Mio/Yuma `Portrait Slot` bullets from `packages/stories/raw/theSeventhMirror/docs/characters.md`; do not alter IDs, aliases, bios, or portrait prompts.

- [ ] **Step 4: Remove presentation from story-loader and async payloads**

Change `StoryLoaderResult` to exactly:

```ts
export type StoryLoaderResult = {
    dialogue: DialogueMap;
    choices: ChoiceMap;
};
```

In each of the three story modules, remove the `StoryPresentationMetadata` type import, remove the generated `storyPresentation` import, and return only:

```ts
return {
    dialogue: dialogueByLocale[normalized],
    choices,
};
```

Update `stories.test.ts` and `async/__tests__/loader.test.ts` fixtures/assertions so `presentation` is absent. `AsyncStoryLoaderResult` continues to extend `StoryLoaderResult` and add only `flow` + `locale`; no loader implementation branch is needed.

- [ ] **Step 5: Remove presentation from the web reader payload path**

In `reader-state.svelte.ts` remove the `StoryPresentationMetadata` import, field, and reset assignment.

In `reader-manager.ts` remove both:

```ts
readerState.presentation = null;
readerState.presentation = payload.presentation;
```

In `ReaderShell.svelte` remove:

```ts
let presentation = $derived(readerState.presentation);
```

and stop passing `{presentation}` to `VisualNovelReader`.

In `VisualNovelReader.svelte` remove the type import, prop declaration/destructure, and `presentation` from `controller.update(...)`.

In `visual-state-controller.ts` remove `StoryPresentationMetadata` and `presentation` from `VisualControllerInput`, delete `portraitSlot()`, and use `'left'` directly in the still-single-portrait calls until Task 3 replaces the single layer.

Update `reader-intent.test.ts`, both reader-manager suites, `VisualNovelReader.test.ts`, and `visual-state-controller.test.ts` fixtures accordingly. Preserve the existing intent/session/visual behavior assertions that are unrelated to presentation metadata.

- [ ] **Step 6: Regenerate stories and verify the deletion set**

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

The three story loader modules also change to stop importing/returning presentation metadata. No portrait/background/dialogue/flow content should change merely because placement metadata was deleted.

- [ ] **Step 7: Run focused GREEN and scan active source for the dead contract**

```bash
rtk bun --filter @aquila/stories test src/compiler/__tests__/parse-characters.test.ts src/compiler/__tests__/emit.test.ts src/__tests__/stories.test.ts src/async/__tests__/loader.test.ts
rtk bun --filter @aquila/stories typecheck
rtk bun --filter web test src/lib/__tests__/reader-intent.test.ts src/lib/__tests__/reader-manager.test.ts src/lib/__tests__/reader-manager-coverage.test.ts src/components/__tests__/VisualNovelReader.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts
rtk rg -n "StoryPresentationMetadata|PortraitSlot|portraitSlot|slotsByCharacterId|defaultSlot" packages/stories/src packages/stories/raw apps/web/src
rtk git diff --check
```

Expected: tests/typecheck PASS; the `rg` command returns no active source/raw contract matches. Historical docs under `docs/` are intentionally outside this scan.

- [ ] **Step 8: Stage generated output, run drift check, and commit**

```bash
rtk git add packages/stories/src packages/stories/raw/theSeventhMirror/docs/characters.md apps/web/src/lib/reader-state.svelte.ts apps/web/src/lib/reader-manager.ts apps/web/src/lib/__tests__/reader-intent.test.ts apps/web/src/lib/__tests__/reader-manager.test.ts apps/web/src/lib/__tests__/reader-manager-coverage.test.ts apps/web/src/components/ReaderShell.svelte apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts
rtk bun compile:check
rtk git commit -m "refactor(reader): remove static portrait slots"
```

Expected: `compile:check` produces no unstaged generated/story-loader drift.

---

### Task 3: Reconcile Two Portrait Slots in the Existing Visual Controller

**Files:**
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Modify: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Interfaces:**
- Consumes: `projectPortraitStage(dialogue, dialogueIndex)` from Task 1.
- Produces final snapshot shape:

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

- Preserves: all existing background/release/prefetch contracts.
- Important guard change: portrait async freshness is validated against the currently projected target for that **slot**, never against `dialogue[dialogueIndex].portrait`.

- [ ] **Step 1: Convert the controller tests to the two-slot RED contract**

Change the initial snapshot expectation to:

```ts
expect(latest()).toMatchObject({
    portraits: {
        left: { state: 'omitted', identity: null, objectUrl: null },
        right: { state: 'omitted', identity: null, objectUrl: null },
    },
    activePortraitSlot: null,
});
```

Add a direct-index two-character test:

```ts
it('loads both projected portrait slots for a direct jump', async () => {
    const { controller, latest } = createHarness();
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

Add retained-expression/reactivation coverage:

```ts
it('reactivates a visible speaker whose current line omits portrait', async () => {
    const { controller, latest } = createHarness();
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

Add narration and replacement assertions:

```ts
it('keeps both portraits but clears the active slot on narration', async () => {
    const { controller, latest } = createHarness();
    const dialogue = [
        { dialogue: 'A', characterId: 'a', portrait: 'a/base' },
        { dialogue: 'B', characterId: 'b', portrait: 'b/base' },
        { dialogue: 'Narration' },
    ];
    controller.update(input(dialogue, { dialogueIndex: 2 }));
    await flushAsyncWork();
    expect(latest().portraits.left.identity).toBe('portrait:a/base');
    expect(latest().portraits.right.identity).toBe('portrait:b/base');
    expect(latest().activePortraitSlot).toBeNull();
});
```

Adapt the old portrait replacement/loading test so changing one slot to a slow new identity asserts the **other slot remains ready** while only the target slot becomes `loading`.

Add explicit tests that:

- a third character replaces only the projected slot;
- an expression change reloads only that character's slot;
- `cache.setProtectedKeys` contains both ready portrait cache keys plus any protected backgrounds;
- `detachObjectUrl()` detaches matching URLs from both portrait slots;
- a missing/failed left or right portrait makes status `fallback` without clearing the other ready portrait;
- soft release revalidation refreshes both desired portrait slots;
- a late decode for a superseded slot target cannot overwrite the newer projected target.

Run:

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: FAIL because `VisualSnapshot` still exposes one `portrait` and the controller loads only the current line's portrait.

- [ ] **Step 2: Change the snapshot types to explicit left/right layers**

In `types.ts`, import the slot type as type-only and replace the slotted single layer:

```ts
import type { PortraitStageSlot } from './portrait-stage';

export type VisualPortraitLayer = VisualImageLayer;

export type VisualPortraitLayers = Readonly<
    Record<PortraitStageSlot, VisualPortraitLayer>
>;
```

Change `VisualSnapshot` exactly to the interface in this task's Interfaces block. No `slot` property remains inside a portrait layer; the record key is the slot.

- [ ] **Step 3: Give the controller independent slot-local cache/release tracking**

Replace:

```ts
private portraitCacheKey: string | null = null;
private portraitReleaseId: string | null = null;
```

with:

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

Change `initialSnapshot()` to create two frozen omitted image layers and `activePortraitSlot: null`:

```ts
portraits: Object.freeze({
    left: imageLayer('omitted'),
    right: imageLayer('omitted'),
}),
activePortraitSlot: null,
```

Add one tiny immutable update helper rather than duplicating record spreads:

```ts
private portraitLayersWith(
    slot: PortraitStageSlot,
    layer: VisualPortraitLayer
): VisualSnapshot['portraits'] {
    return Object.freeze({
        ...this.snapshot.portraits,
        [slot]: layer,
    });
}
```

Clear both slot-local cache/release fields in `dispose()`.

- [ ] **Step 4: Reconcile projected targets in `prepareLoadingLayers()`**

At the start of portrait work derive:

```ts
const stage = projectPortraitStage(input.dialogue, input.dialogueIndex);
```

For each `slot` in `['left', 'right'] as const`:

1. Read `const desired = stage[slot]`.
2. If `desired === null`, clear that slot's cache/release tracking and publish `imageLayer('omitted')` for the slot.
3. Otherwise build `{ type: 'portrait', key: desired.portrait }`.
4. Reuse the existing ready layer only when `isLayerCurrentForRelease(...)` succeeds against that slot's `portraitReleaseIds[slot]`.
5. Otherwise clear only that slot's tracking and publish `imageLayer('loading', qualifyAssetIdentity(identity))`.

Publish both reconciled portrait layers and:

```ts
activePortraitSlot: stage.activeSlot
```

Do not touch `activeBackground` or alter the existing staging-background decision.

- [ ] **Step 5: Load/fail projected slots rather than the current-line portrait**

In `prepareCurrentInput()` derive the stage once and determine keyed visuals from:

```ts
const stagedPortraitKeys = (['left', 'right'] as const)
    .map(slot => stage[slot]?.portrait)
    .filter((key): key is string => key !== undefined);
const hasKeyedVisual = !!entry?.background || stagedPortraitKeys.length > 0;
```

After release validation, independently enqueue `loadPortrait(...)` for each desired slot whose layer is not current for the active release.

Use a slot-aware signature:

```ts
private async loadPortrait(
    input: VisualControllerInput,
    generation: number,
    slot: PortraitStageSlot,
    portraitKey: string
): Promise<void>;
```

Publish only that slot via `portraitLayersWith(slot, layer)`.

Change `failKeyedLayers()` so a release failure marks each currently projected portrait identity failed independently while preserving `activePortraitSlot` from the stage.

- [ ] **Step 6: Split portrait freshness from background freshness**

Keep the current-line background check in a background-specific helper:

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

Use a projected-slot check for portraits:

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

This check is required for direct jumps and narration because an inactive retained portrait often does not appear on `dialogue[dialogueIndex].portrait`.

- [ ] **Step 7: Extend lifecycle/status bookkeeping to both slots**

Update `detachObjectUrl()` to detach active background, staging background, left portrait, and right portrait. Clear cache/release tracking for every slot whose URL matches.

Update `publish()` protection to include:

```ts
this.portraitCacheKeys.left,
this.portraitCacheKeys.right,
```

in addition to the two background keys.

Update `statusFor()` so either portrait slot in `missing` or `failed` produces `fallback` just like the old single portrait.

Leave within-scene and edge prefetch line-based (`identitiesForLine`) exactly as they are; do not create a future-stage planner.

- [ ] **Step 8: Update the reader to consume the new snapshot shape without styling behavior yet**

Change `VisualNovelReader.emptySnapshot` to:

```ts
const emptySnapshot: VisualSnapshot = {
    release: 'idle',
    activeBackground: emptyLayer,
    stagingBackground: emptyLayer,
    portraits: {
        left: emptyLayer,
        right: emptyLayer,
    },
    activePortraitSlot: null,
    releaseIdentity: null,
    status: null,
};
```

Replace the single portrait image with two stable images:

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

Keep the existing left/right anchor CSS for now; Task 4 owns dimming and sizing.

Update `VisualNovelReader.test.ts` snapshots and structural assertions so there are four image elements total: two background layers + two portrait layers.

- [ ] **Step 9: Run controller/component GREEN verification**

```bash
rtk bun --filter web test src/lib/visual-assets/__tests__/portrait-stage.test.ts src/lib/visual-assets/__tests__/visual-state-controller.test.ts src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web astro check
rtk git diff --check
```

Expected: projector/controller/component tests PASS; no single `snapshot.portrait` consumer remains in active web source.

- [ ] **Step 10: Commit the two-slot runtime slice**

```bash
rtk git add apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts
rtk git commit -m "feat(reader): retain two portrait slots"
```

---

### Task 4: Dim Inactive Speakers and Fit Two Portraits Responsively

**Files:**
- Modify: `apps/web/src/components/VisualNovelReader.svelte`
- Modify: `apps/web/src/components/__tests__/VisualNovelReader.test.ts`

**Interfaces:**
- Consumes: `snapshot.activePortraitSlot` and the two stable portrait layers from Task 3.
- Produces DOM contract:
  - `data-testid="visual-portrait-left|visual-portrait-right"`
  - `data-portrait-state="omitted|loading|ready|missing|failed"`
  - `data-portrait-slot="left|right"`
  - `data-portrait-active="true|false"`
- Produces exact inactive presentation: `brightness(0.55)`, `opacity: 0.82`.
- Produces exact active presentation: `brightness(1)`, `opacity: 1`.

- [ ] **Step 1: Add component RED assertions for active/narration state**

Use a ready snapshot with both portraits:

```ts
const readySnapshot: VisualSnapshot = {
    release: 'ready',
    activeBackground: { ... },
    stagingBackground: { ... },
    portraits: {
        left: {
            state: 'ready',
            identity: 'portrait:yuma/base',
            objectUrl: 'blob:yuma',
            width: 450,
            height: 600,
        },
        right: {
            state: 'ready',
            identity: 'portrait:mio/base',
            objectUrl: 'blob:mio',
            width: 450,
            height: 600,
        },
    },
    activePortraitSlot: 'right',
    releaseIdentity: null,
    status: null,
};
```

Assert:

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

Emit the same snapshot with `activePortraitSlot: null` and assert both active attributes are `false`. Also assert the two object URLs stay mounted across the active-slot-only update.

Run:

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
```

Expected: structural active attributes may already pass from Task 3; add a source-level CSS assertion in the same test file that reads the component source or, preferably, rely on Task 5 browser-computed-style RED for filter values. Do not couple happy-dom to CSS computation it does not model accurately.

- [ ] **Step 2: Add exact active/inactive CSS**

Change the portrait base rule to:

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

Keep the existing left/right anchors unchanged.

- [ ] **Step 3: Replace one-portrait mobile sizing with two-portrait sizing**

Change the mobile portrait rule from `82vw` to:

```css
@media (max-width: 47.99rem) and (orientation: portrait) {
  .visual-novel-reader {
    --dialogue-box-height: 40dvh;
  }

  .visual-portrait {
    max-width: 54vw;
  }
}
```

Keep compact landscape at `42vw`. The same stage composition runs at all widths.

- [ ] **Step 4: Honor reduced-motion for portrait emphasis changes**

Extend the existing reduced-motion block:

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

Do not add a movement transform or entrance animation.

- [ ] **Step 5: Run component GREEN and lint the edited component**

```bash
rtk bun --filter web test src/components/__tests__/VisualNovelReader.test.ts
rtk bun --filter web lint
rtk git diff --check
```

Expected: component tests and web lint PASS.

- [ ] **Step 6: Commit the visual emphasis slice**

```bash
rtk git add apps/web/src/components/VisualNovelReader.svelte apps/web/src/components/__tests__/VisualNovelReader.test.ts
rtk git commit -m "feat(reader): dim inactive portrait speakers"
```

---

### Task 5: Prove the Stage in Playwright and Run the Full Gate

**Files:**
- Modify: `packages/e2e/tests/utils.ts`
- Modify: `packages/e2e/tests/reader-visual.spec.ts`
- Verify only: all files from Tasks 1-4

**Interfaces:**
- Consumes stable portrait test IDs from Task 3.
- Produces page-object accessors:

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

- Browser behavior anchor: Seventh Mirror `ch1_act2` lines 6/7/8 are Yuma portrait -> Mio portrait -> Yuma portrait, and local fixtures already publish both base portraits.

- [ ] **Step 1: Rewrite the flagship portrait E2E as RED for dynamic staging**

Replace the old static-slot test with:

```ts
test('alternates Yuma and Mio while dimming the inactive speaker', async ({
    page,
}) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(6);

    // First visible speaker in this scene starts left, regardless of the old
    // authored Yuma-right metadata.
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

    const leftFilter = await visual.leftPortrait.evaluate(
        element => getComputedStyle(element).filter
    );
    const rightFilter = await visual.rightPortrait.evaluate(
        element => getComputedStyle(element).filter
    );
    expect(leftFilter).toContain('brightness(0.55)');
    expect(rightFilter).toContain('brightness(1)');
    await expect(visual.leftPortrait).toHaveCSS('opacity', '0.82');
    await expect(visual.rightPortrait).toHaveCSS('opacity', '1');

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

Before implementation this test fails because line 6 uses the old authored right slot and only one portrait exists.

- [ ] **Step 2: Update page-object and geometry helpers for two portraits**

Replace `VisualReaderPage.portrait` with the three accessors in the Interfaces block.

Rename `expectEssentialControlsNotToOverlapPortrait` to `expectEssentialControlsNotToOverlapPortraits` and evaluate every ready portrait:

```ts
const count = await visual.readyPortraits.count();
for (let index = 0; index < count; index += 1) {
    const portraitBox = await visual.readyPortraits.nth(index).boundingBox();
    expect(portraitBox).not.toBeNull();
    if (!portraitBox) continue;
    for (const [name, locator] of controls) {
        const controlBox = await locator.boundingBox();
        expect(controlBox).not.toBeNull();
        if (controlBox) {
            expect(
                boxesOverlap(controlBox, portraitBox),
                `${name} overlaps portrait ${index}`
            ).toBe(false);
        }
    }
}
```

In the responsive geometry test, after line 7 require both ready portraits and assert each portrait bottom remains at least 12 px above the dialogue box, using the same bound already enforced for the single portrait.

- [ ] **Step 3: Run the flagship browser test in Chromium and observe/fix RED**

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium
```

Expected initial RED before Tasks 3-4: missing two-slot test IDs/dynamic staging. After Tasks 3-4 are present, fix only selector/timing/layout defects exposed by the browser; do not broaden the feature.

- [ ] **Step 4: Run the visual-reader spec across desktop and both mobile projects**

```bash
rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts
```

Expected: Chromium, mobile Chrome, and mobile Safari visual-reader cases PASS, including existing background transitions, mode swaps, load failures, history controls, and responsive geometry.

- [ ] **Step 5: Run focused story/web verification before the repository-wide gate**

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

Expected:

- stories tests/typecheck PASS;
- web tests/lint PASS;
- `compile:check` PASS with no generated drift;
- both `rg` scans return no active legacy contract/single-portrait selector matches;
- `git diff --check` reports no whitespace errors.

- [ ] **Step 6: Run the repository-wide build/lint/test gate**

```bash
rtk bun lint
rtk bun build
rtk bun run test
```

Expected: Turbo lint, production builds, Vitest suites, and Playwright suites PASS. If a browser/environment-only failure occurs, record the exact blocked command; do not weaken or delete the assertion.

- [ ] **Step 7: Review the final diff against the approved scope**

```bash
rtk git status --short
rtk git diff main...HEAD --stat
rtk git diff main...HEAD -- packages/stories/src/types.ts packages/stories/src/compiler/parse-characters.ts packages/stories/src/compiler/emit.ts apps/web/src/lib/visual-assets/portrait-stage.ts apps/web/src/lib/visual-assets/types.ts apps/web/src/lib/visual-assets/visual-state-controller.ts apps/web/src/components/VisualNovelReader.svelte packages/e2e/tests/reader-visual.spec.ts
```

Confirm the final implementation contains only:

1. the approved design + this plan;
2. pure two-slot stage projection;
3. deletion of static portrait-placement metadata/plumbing;
4. two-slot controller/cache/release reconciliation;
5. two stable portrait elements with active/inactive styling and responsive sizing;
6. focused unit/component/E2E updates.

Reject any accidental stage directives, 3+ portrait support, persisted stage state, new dependencies, asset generation, or unrelated reader refactors.

- [ ] **Step 8: Commit the E2E/final verification slice**

```bash
rtk git add packages/e2e/tests/utils.ts packages/e2e/tests/reader-visual.spec.ts
rtk git commit -m "test(reader): cover alternating portrait stage"
```

Keep PR #64 draft until the implementation diff and CI are reviewed; do not open a second PR for any task in this plan.
