# Two-Character Portrait Stage Design

Date: 2026-09-02
Status: Proposed

## Summary

Replace the visual novel reader's one-active-portrait presentation with a deterministic two-slot conversation stage.

The first visible speaker in a scene occupies the left slot. When a different portrait-bearing character speaks, that character occupies the opposite slot and the previous visible speaker remains on screen. The current visible speaker renders at normal brightness while the other visible portrait is dimmed. Repeated lines and expression changes for the same character keep that character on the same side.

Stage composition is reconstructed from the current scene's dialogue prefix rather than stored as hidden mutable reader history. Direct URLs, restored dialogue indices, history/navigation jumps, and normal sequential play therefore produce the same composition.

This remains a deliberately small two-character presentation model. It does not introduce general stage direction, arbitrary multi-character layouts, entrance/exit commands, or persisted stage state.

## Goals

- Alternate participating characters between left and right instead of falling back to left for most characters.
- Keep the previous visible conversation partner on screen when the speaker changes.
- Dim every visible portrait that is not the current visible speaker.
- Keep a character on the same side while they continue speaking or change portrait expression.
- Produce identical stage composition for sequential play and direct navigation to a dialogue index.
- Keep the feature bounded to two visible portrait slots and one implementation PR.

## Non-goals

- Three-or-more simultaneous portraits.
- Author-controlled entrance, exit, move, or z-order commands.
- New story syntax for portrait staging.
- Configurable dim strength per story or character.
- Portrait movement or entrance animations.
- Changes to text-reader behavior, audio playback, story flow, bookmarks, or persisted reader-session schema.
- Backward compatibility for the old static `Portrait Slot` presentation contract.

## Current State

The current story contract exposes `PortraitSlot = 'left' | 'right'` and `StoryPresentationMetadata.portrait.activeLimit: 1`, with a `defaultSlot` and optional `slotsByCharacterId` overrides. The compiler emits `defaultSlot: 'left'` and the visual controller resolves missing assignments to left.

That presentation object contains no information unrelated to portrait placement, but it is threaded through story loading, `readerState`, `ReaderShell`, `VisualNovelReader`, and `VisualStateController` solely to support the one-portrait slot decision.

The visual controller snapshot exposes a single `portrait` layer and owns one portrait cache/release identity. `VisualNovelReader.svelte` renders one portrait `<img>`, though its CSS already supports left and right anchors.

This means a story with only a few explicit slot assignments places every other character on the left and cannot keep the previous speaker visible for dimming.

## Proposed Behavior

### Scene-local stage

Each scene starts with an empty two-slot stage:

```ts
type PortraitStage = {
    left: StagePortrait | null;
    right: StagePortrait | null;
    activeSlot: 'left' | 'right' | null;
};
```

A staged portrait contains only the data needed to identify the visible character and asset:

```ts
type StagePortrait = {
    characterId: string;
    portrait: string;
};
```

The stage is derived presentation state. It is never serialized into the URL, local storage, bookmarks, or reader-session state.

### Deterministic projection

Compute the stage by replaying `dialogue.slice(0, dialogueIndex + 1)` from an empty stage.

The projection keeps an internal `lastSpeakerSlot: 'left' | 'right' | null` in addition to the returned `activeSlot`. `activeSlot` describes the current line for rendering; `lastSpeakerSlot` remembers the most recent visible speaker for placement after narration or other non-visible dialogue.

For each entry:

1. **No `characterId`**
   - Do not change either slot.
   - Set `activeSlot` to `null`.
   - Leave `lastSpeakerSlot` unchanged.

2. **Character is already visible**
   - Keep the character in the same slot.
   - If the entry has `portrait`, replace that slot's portrait key with the new key; otherwise preserve the existing portrait/expression.
   - Set both `activeSlot` and `lastSpeakerSlot` to that character's slot.

3. **Character is not visible and the entry has no `portrait`**
   - Do not add a portrait or change either slot.
   - Set `activeSlot` to `null` because the speaking character has no visible stage representation.
   - Leave `lastSpeakerSlot` unchanged.

4. **New portrait-bearing character, stage empty**
   - Place the character on the left.
   - Set `activeSlot` and `lastSpeakerSlot` to left.

5. **New portrait-bearing character, exactly one slot occupied**
   - Place the character in the empty slot.
   - Set `activeSlot` and `lastSpeakerSlot` to the new slot.

6. **New portrait-bearing character, both slots occupied**
   - Replace the slot opposite `lastSpeakerSlot` so the immediately previous visible speaker remains as the dimmed conversation partner.
   - Set `activeSlot` and `lastSpeakerSlot` to the replacement slot.

Because a two-occupied-slot state can only be produced by prior visible speakers, `lastSpeakerSlot` is non-null for rule 6 when projection starts from an empty scene. The implementation may assert that invariant rather than adding a fallback branch.

Example:

```text
A(portrait) -> A left active
B(portrait) -> A left dim, B right active
B(no new portrait key) -> A left dim, B right active with existing expression
narration -> A left dim, B right dim; last visible speaker remains B/right
C(portrait) -> C left active, B right dim
B(portrait) -> C left dim, B right active
D(portrait) -> D left active, B right dim
```

This is an O(dialogueIndex) projection on each reader update. Scene dialogue is small enough that memoization or a second mutable stage store would add complexity without useful benefit; do not add either in this PR.

### Dimming

- The portrait in `activeSlot` renders at full brightness.
- Every other ready portrait renders with `brightness(0.55)`.
- When `activeSlot === null`, every ready portrait is dimmed.
- Keep the existing portrait drop shadow in both states.
- Use a short CSS `filter` transition; do not add movement or opacity animation.

The dim factor is a reader presentation constant, not story metadata.

### Scene changes

A new scene projects from an empty stage. Portraits do not carry across scene boundaries.

This keeps the algorithm scene-local and avoids cross-scene stage persistence.

## Remove Static Presentation Metadata

Delete the static portrait-placement contract rather than keeping a compatibility shell:

- remove `PortraitSlot`;
- remove `StoryPresentationMetadata`;
- remove `portraitSlot` from parsed character data;
- remove `Portrait Slot` parsing and validation;
- remove `emitPresentation()` and generated `presentation.ts` files;
- remove the two active `Portrait Slot` lines from Seventh Mirror `characters.md`;
- remove `presentation` from `StoryLoaderResult` and each story loader result;
- remove `readerState.presentation`;
- remove presentation plumbing through `ReaderManager`, `ReaderShell`, `VisualNovelReader`, and `VisualStateController`;
- remove/update tests whose only purpose was proving presentation payload propagation or static slot selection.

Historical design/plan documents describing the old contract remain historical records and do not need rewriting.

The reader now owns conversational placement entirely from `DialogueEntry.characterId` and `DialogueEntry.portrait`.

## Web Runtime Design

### Pure stage projection

Add a small pure helper under the existing visual-assets boundary:

```text
apps/web/src/lib/visual-assets/portrait-stage.ts
```

Expose one primary function equivalent to:

```ts
projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage
```

The helper owns only stage composition. It does not load assets, mutate caches, know about release identities, or talk to Svelte.

### Snapshot shape

Replace the single portrait layer with explicit left and right layers plus current-line activity:

```ts
type VisualSnapshot = {
    release: VisualReleaseState;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portraits: {
        left: VisualImageLayer;
        right: VisualImageLayer;
    };
    activePortraitSlot: 'left' | 'right' | null;
    releaseIdentity: VisualReleaseIdentity | null;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

The separate `VisualPortraitLayer` type can be deleted if it has no remaining distinction from `VisualImageLayer` after `slot` is removed.

Both empty portrait layers use the existing image-layer states: `omitted | loading | ready | missing | failed`.

### Controller responsibilities

`VisualStateController.update()` derives the desired `PortraitStage` for the current scene/index and reconciles each desired slot independently.

For each slot:

- desired empty -> publish `omitted` and clear that slot's protected cache/release identity;
- same logical portrait under the active release -> preserve the ready layer;
- changed portrait -> publish `loading`, resolve/load it, then publish `ready`, `missing`, or `failed` using the existing generation/release guards.

The controller moves from one portrait cache key/release ID to two explicit slot-local pairs. Reuse the existing asset loading, failure, generation, object-URL detachment, release validation, and prefetch machinery; do not introduce another asset manager.

Cache protection must include both ready portrait slots.

Within-scene lookahead may continue prefetching portrait asset identities from future dialogue entries as it does today. It does not need to project future stage layouts.

### Reader rendering

`VisualNovelReader.svelte` renders two portrait images, one for each slot.

Expose stable test attributes:

```text
data-testid="visual-portrait-left"
data-testid="visual-portrait-right"
data-portrait-state="..."
data-portrait-active="true|false"
```

The existing left/right anchors remain the positioning mechanism. The active ready portrait receives normal brightness and higher z-order when portraits overlap; the inactive ready portrait receives the dim filter.

## Responsive Layout

The current mobile portrait width was tuned for one portrait and is too large for two simultaneous characters.

Adjust CSS sizing so two slots can coexist without obscuring the dialogue box or each other excessively:

- desktop/regular landscape: retain the existing height-first composition while capping each portrait for a two-character stage;
- mobile portrait: reduce per-portrait maximum width from the current single-character value;
- compact landscape: preserve the current compact-height treatment while capping each portrait independently.

Use the same stage algorithm at every breakpoint. Do not create mobile-specific placement rules.

The implementation should verify the resulting composition at the existing desktop, mobile portrait, and compact-landscape test/view sizes and make the smallest CSS adjustment that keeps both characters readable.

## Error and Loading Semantics

Each slot fails independently.

- If one portrait asset is missing or fails, the other slot remains visible and can still be active/dimmed normally.
- A failed current-speaker portrait does not remove the other successfully loaded portrait.
- Release-level invalid/unavailable behavior remains governed by the existing controller semantics.
- Generation checks must prevent an older load from overwriting a newer stage projection after rapid navigation.
- Object URL detachment and protected-cache-key calculation must inspect both portrait slots.

No new user-facing error UI is required.

## Testing

### Pure stage projection tests

Cover at minimum:

1. empty dialogue -> both slots empty, no active slot;
2. A with portrait -> A left active;
3. A -> B -> A left dim/B right active;
4. visible B speaks without a new portrait key -> B stays right, remains active, existing expression preserved;
5. A -> B -> A -> A reactivates left;
6. A -> B -> C -> C replaces A on left;
7. A -> B -> A -> C -> C replaces B on right;
8. narration after A/B -> both portraits preserved and dimmed while last visible speaker side is retained internally;
9. A -> B -> narration -> C -> C replaces A, proving narration does not erase the B/right alternation anchor;
10. unseen character without portrait -> no new portrait and no active slot;
11. direct projection to index N equals the composition reached by applying the same prefix sequentially;
12. projecting a different scene's dialogue starts from an empty stage.

### Story/compiler tests

Update compiler and story-loader coverage to prove:

- character parsing no longer recognizes or emits portrait-slot metadata;
- active raw story source contains no `Portrait Slot` metadata;
- generated stories no longer contain `presentation.ts` artifacts;
- `StoryLoaderResult`/async story payloads no longer carry `presentation`;
- old presentation-propagation tests are removed rather than replaced with no-op equivalents.

### Visual controller tests

Update the existing controller suite to prove:

- both slot loads are independently reconciled;
- expression changes reload only the affected slot;
- reactivating an existing character does not reload an unchanged portrait;
- third-character replacement protects/releases the correct cache keys;
- stale async loads cannot overwrite a newer slot;
- object URL detachment checks both portrait layers;
- soft release revalidation refreshes both portrait slots when necessary;
- missing/fallback behavior remains slot-local.

### Component tests

Update `VisualNovelReader.test.ts` to assert:

- two stable portrait elements exist;
- left/right ready layers render the expected object URLs;
- only the active slot is undimmed;
- narration/no-visible-speaker state dims both;
- the reader no longer accepts presentation metadata;
- mobile/compact CSS hooks preserve a two-side layout.

### E2E

Update the existing visual-reader page object away from a single `portrait` getter and add one focused flow that proves:

- first portrait-bearing character appears left;
- second portrait-bearing character appears right while the first remains visible/dimmed;
- returning to the first character reactivates the existing left slot;
- the dialogue URL/index behavior remains unchanged.

Use existing story content when it already provides a suitable A/B/A sequence. Do not add production story dialogue solely for E2E.

## Expected File Areas

Likely implementation touch points:

```text
packages/stories/src/types.ts
packages/stories/src/index.ts
packages/stories/src/stories/index.ts
packages/stories/src/stories/*/index.ts
packages/stories/src/compiler/parse-characters.ts
packages/stories/src/compiler/emit.ts
packages/stories/src/compiler/__tests__/*
packages/stories/src/generated/*/presentation.ts (delete)
packages/stories/raw/theSeventhMirror/docs/characters.md
packages/stories/src/async/* tests/fixtures as required by StoryLoaderResult changes
apps/web/src/lib/reader-state.svelte.ts
apps/web/src/lib/reader-manager.ts
apps/web/src/lib/__tests__/reader-manager*.test.ts
apps/web/src/components/ReaderShell.svelte
apps/web/src/lib/visual-assets/types.ts
apps/web/src/lib/visual-assets/portrait-stage.ts (new)
apps/web/src/lib/visual-assets/visual-state-controller.ts
apps/web/src/lib/visual-assets/__tests__/*
apps/web/src/components/VisualNovelReader.svelte
apps/web/src/components/__tests__/VisualNovelReader.test.ts
packages/e2e/tests/utils.ts
packages/e2e/tests/reader-visual.spec.ts
```

The implementation should not expand into unrelated reader, story, or asset-runtime refactors.

## Delivery

Implement this as one PR: the existing design PR becomes the implementation PR rather than opening another PR.

The PR should contain:

1. pure deterministic two-slot stage projection;
2. deletion of obsolete static presentation/portrait-slot plumbing;
3. two-slot visual-controller state and loading;
4. two-image reader rendering with inactive-speaker dimming;
5. responsive portrait sizing adjustments;
6. focused compiler/unit/component/E2E coverage;
7. deletion/regeneration of generated story artifacts as required by the removed presentation emitter.

No compatibility layer or migration path is needed.