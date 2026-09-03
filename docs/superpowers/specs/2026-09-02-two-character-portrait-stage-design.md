# Two-Character Portrait Stage Design

Date: 2026-09-02
Status: Proposed

## Summary

Replace the visual novel reader's one-active-portrait presentation with a deterministic two-slot conversation stage.

The first portrait-bearing speaker in a scene occupies the left slot. When a different portrait-bearing character speaks, that character occupies the opposite slot and the previous speaker remains visible. The current speaker is shown at normal brightness while the other visible portrait is dimmed. Repeated lines or expression changes for the same character keep that character on the same side.

Stage composition is reconstructed from the scene dialogue prefix rather than stored as hidden mutable reader history. Direct URLs, restored dialogue indices, backlog/navigation jumps, and normal sequential play therefore produce the same portrait composition.

This remains a deliberately small two-character presentation model. It does not introduce general stage direction, arbitrary multi-character layouts, entrance/exit animation commands, or per-scene staging state.

## Goals

- Alternate participating characters between left and right instead of falling back to left for most characters.
- Keep the previous conversation partner visible when the current speaker changes.
- Dim visible portraits that are not currently speaking.
- Keep a character on the same side while that character continues speaking or changes portrait expression.
- Produce identical stage composition for sequential play and direct navigation to a dialogue index.
- Keep the feature bounded to two visible portrait slots and one implementation PR.

## Non-goals

- Three-or-more simultaneous portraits.
- Author-controlled entrance, exit, move, or z-order commands.
- New story syntax for portrait staging.
- Configurable dim strength per story or character.
- Portrait animations beyond a small CSS brightness/opacity transition.
- Changes to text-reader behavior, audio playback, story flow, bookmarks, or persisted reader-session schema.
- Backward compatibility for the old static `Portrait Slot` presentation contract.

## Current State

The current story contract exposes `PortraitSlot = 'left' | 'right'` and `StoryPresentationMetadata.portrait.activeLimit: 1`, with a `defaultSlot` and optional `slotsByCharacterId` overrides. The compiler emits `defaultSlot: 'left'` and the visual controller resolves missing assignments to left.

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

A `StagePortrait` contains enough information for the controller to resolve and render the slot:

```ts
type StagePortrait = {
    characterId: string;
    portrait: string;
};
```

The stage is a presentation derivation, not persisted reader state.

### Deterministic placement algorithm

Compute the stage by replaying `dialogue.slice(0, dialogueIndex + 1)` from an empty stage.

Only entries with both `characterId` and `portrait` participate in portrait placement. This preserves the existing meaning of `DialogueEntry.portrait`: a line without a portrait key does not create a new portrait asset requirement.

For each participating entry:

1. **Character already visible**
   - Keep that character in the same slot.
   - Replace that slot's portrait key with the current entry's portrait key, allowing expression changes without moving sides.
   - Set that slot as active.

2. **New character, stage empty**
   - Place the character on the left.
   - Set left as active.

3. **New character, exactly one slot occupied**
   - Place the character in the empty opposite slot.
   - Set the new slot as active.

4. **New character, both slots occupied**
   - Replace the slot opposite the currently active slot.
   - Set the replacement slot as active.

This produces a stable conversational alternation without requiring author metadata. Example:

```text
A -> left active
B -> A left dim, B right active
B -> A left dim, B right active
A -> A left active, B right dim
C -> C right active, A left dim
D -> D left active, C right dim
```

### Non-participating lines

For narration, system text, or any line without both `characterId` and `portrait`:

- Keep the two existing slot contents unchanged.
- Set `activeSlot` to `null` for that line.
- Dim every visible portrait.

This makes narration visually neutral without unexpectedly removing conversation context.

A later portrait-bearing speaker reactivates or replaces a slot using the normal deterministic rules.

### Scene changes

A new scene starts from an empty stage. Portraits do not carry across scene boundaries.

This keeps reconstruction local to the scene's dialogue array and avoids introducing cross-scene stage persistence.

## Story Contract Simplification

Remove static portrait-placement metadata from `StoryPresentationMetadata`:

- remove `activeLimit`;
- remove `defaultSlot`;
- remove `slotsByCharacterId`;
- remove `PortraitSlot` if no other runtime consumer still needs it.

Remove `Portrait Slot` parsing from character authoring and stop emitting generated slot metadata.

The reader owns conversational placement. Character documents continue to own identity and portrait prompts only.

Generated presentation files should either omit the portrait section entirely or, if `StoryPresentationMetadata` has no remaining fields after this change, remove the generated presentation artifact and its loader plumbing rather than retaining an empty compatibility shell. Choose the smaller result based on actual remaining consumers during implementation; do not preserve dead metadata only for compatibility.

## Web Runtime Design

### Pure stage projection

Add a small pure helper under the visual-assets area, for example:

```text
apps/web/src/lib/visual-assets/portrait-stage.ts
```

It should expose one primary function equivalent to:

```ts
projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage
```

The helper owns only stage composition. It does not load assets, mutate caches, know about release identities, or talk to Svelte.

Keeping this logic pure makes direct-jump behavior trivial to test and avoids adding mutable speaker-history fields to `VisualStateController`.

### Snapshot shape

Replace the single portrait layer with explicit left and right layers plus active-slot state:

```ts
type VisualSnapshot = {
    release: VisualReleaseState;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portraits: {
        left: VisualPortraitLayer;
        right: VisualPortraitLayer;
    };
    activePortraitSlot: 'left' | 'right' | null;
    releaseIdentity: VisualReleaseIdentity | null;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

`VisualPortraitLayer` no longer needs to carry `slot` because the object key is the slot.

Both empty portrait layers use the same existing image-layer states: `omitted | loading | ready | missing | failed`.

### Controller responsibilities

`VisualStateController.update()` derives the desired `PortraitStage` for the current input and reconciles each desired slot independently.

For each slot:

- desired empty -> publish `omitted` and clear that slot's protected cache/release identity;
- same logical portrait under the current release -> keep the ready layer;
- changed portrait -> publish `loading`, resolve/load it, then publish `ready`, `missing`, or `failed` using the existing generation/release guards.

The controller therefore moves from one portrait cache key/release ID to two explicit slot-local pairs. It should reuse the existing image loading, failure, generation, object-URL detachment, release validation, and prefetch machinery instead of introducing another asset manager.

Cache protection must include both ready portrait slots.

Within-scene lookahead may continue prefetching portrait asset identities from future dialogue entries as it does today. It does not need to precompute future stage layouts.

### Reader rendering

`VisualNovelReader.svelte` renders two portrait images, one for each slot.

Each image exposes stable test attributes, for example:

```text
data-testid="visual-portrait-left|visual-portrait-right"
data-portrait-state="..."
data-portrait-active="true|false"
```

Positioning remains based on the existing left/right CSS anchors.

Active portrait styling:

- normal brightness/opacity;
- above the inactive portrait when overlap occurs.

Inactive portrait styling:

- reduced brightness, targeting approximately `brightness(0.55)`;
- optionally a small opacity reduction if needed for readability;
- short transition for brightness/opacity;
- no movement animation.

When `activePortraitSlot === null`, both visible portraits use inactive styling.

The exact CSS constants are presentation details and should be tuned in implementation tests/manual visual verification rather than added to story configuration.

## Responsive Layout

The current mobile portrait width was tuned for one portrait and is too large for two simultaneous characters.

Adjust portrait sizing so two slots can coexist without obscuring the dialogue box or each other excessively:

- desktop/regular landscape: preserve current height-first composition, but cap each portrait width for a two-character stage;
- mobile portrait: reduce per-portrait maximum width from the current single-character value so left/right characters remain legible side by side;
- compact landscape: preserve the existing compact-height treatment while capping each portrait independently.

Do not add breakpoint-specific stage algorithms. The same left/right stage model applies at every size; only CSS sizing changes.

## Error and Loading Semantics

Each slot fails independently.

- If one portrait asset is missing or fails, the other slot remains visible and can still be active/dimmed normally.
- A failed current-speaker portrait does not remove the previous successfully loaded portrait.
- Release-level invalid/unavailable behavior remains governed by the existing controller semantics.
- Generation checks must prevent an older load from overwriting a newer stage projection after rapid navigation.

No new user-facing error UI is required.

## Testing

### Pure stage projection tests

Cover at minimum:

1. empty dialogue -> both slots empty, no active slot;
2. A -> A left active;
3. A -> B -> A left dim/B right active;
4. A -> B -> B -> B remains right and updates expression in place;
5. A -> B -> A -> A reactivates left;
6. A -> B -> C -> C replaces A on left;
7. A -> B -> A -> C -> C replaces B on right;
8. narration between speakers -> slot contents preserved, no active slot;
9. direct projection to index N equals sequentially applying lines through N;
10. scene input replacement starts from an empty stage because projection receives only the new scene dialogue.

### Visual controller tests

Update the existing controller suite to prove:

- both slot loads are independently reconciled;
- expression changes reload only the affected slot;
- reactivating an existing character does not reload an unchanged portrait;
- third-character replacement releases/protects the correct cache keys;
- stale async loads cannot overwrite a newer slot;
- object URL detachment checks both portrait layers;
- soft release revalidation refreshes both portrait slots when necessary;
- missing/fallback behavior remains slot-local.

### Component tests

Update `VisualNovelReader.test.ts` to assert:

- two stable portrait elements exist;
- left/right ready layers render the expected object URLs;
- only the active slot is undimmed;
- narration dims both;
- mobile/compact CSS hooks still expose two-side layout behavior.

### E2E

Update the existing visual-reader page object away from a single `portrait` getter and add one focused flow that proves:

- first character appears left;
- second character appears right while the first remains visible/dimmed;
- returning to the first character reactivates the existing left slot;
- the dialogue URL/index behavior remains unchanged.

Use existing story content when it already provides a suitable A/B/A sequence. Do not add production story lines solely to satisfy E2E.

## Expected File Areas

Likely implementation touch points:

```text
packages/stories/src/types.ts
packages/stories/src/compiler/parse-characters.ts
packages/stories/src/compiler/emit.ts
packages/stories/src/compiler/__tests__/*
packages/stories/src/generated/*/presentation.ts (regenerated or removed)
packages/stories/raw/*/docs/characters.md (remove obsolete Portrait Slot metadata where present)
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

Implement this as one PR.

The PR should contain:

1. the pure two-slot stage projection;
2. removal of obsolete static portrait-slot authoring metadata;
3. two-slot visual-controller state/loading;
4. two-image reader rendering with inactive-speaker dimming;
5. responsive portrait sizing adjustments;
6. focused unit/component/E2E coverage;
7. regenerated generated-story artifacts if still required by the simplified presentation contract.

No compatibility layer or migration path is needed because the project has no production-user compatibility requirement.