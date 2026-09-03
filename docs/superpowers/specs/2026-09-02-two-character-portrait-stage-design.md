# Two-Character Portrait Stage Design

Date: 2026-09-02
Status: Approved

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
   - If the entry has a `portrait`, replace that slot's portrait key with the new value.
   - If the entry omits `portrait`, retain the currently staged portrait/expression.
   - Set that slot as both `activeSlot` and `lastSpeakerSlot`.

3. **Character is not visible and the entry has no `portrait`**
   - Do not change either slot.
   - Set `activeSlot` to `null`.
   - Leave `lastSpeakerSlot` unchanged.

4. **New visible character, stage empty**
   - Place the character on the left.
   - Set left as `activeSlot` and `lastSpeakerSlot`.

5. **New visible character, exactly one slot occupied**
   - Place the character in the empty opposite slot.
   - Set the new slot as `activeSlot` and `lastSpeakerSlot`.

6. **New visible character, both slots occupied**
   - Replace the slot opposite `lastSpeakerSlot`.
   - Set the replacement slot as `activeSlot` and `lastSpeakerSlot`.

Example:

```text
A -> left active
B -> A left dim, B right active
B -> A left dim, B right active
A -> A left active, B right dim
C -> A left dim, C right active
D -> D left active, C right dim
```

### Narration and non-visible dialogue

Narration or other lines that do not produce a visible current speaker:

- keep both staged portraits unchanged;
- set `activeSlot` to `null`;
- dim every visible portrait;
- retain `lastSpeakerSlot` internally so the next new visible character alternates relative to the last visible speaker rather than relative to narration.

### Scene changes

A new scene starts from an empty stage. Portraits do not carry across scene boundaries.

This keeps reconstruction local to the scene's dialogue array and avoids cross-scene stage persistence.

## Story Contract Simplification

Delete static portrait placement metadata instead of supporting both static and dynamic placement:

- remove `PortraitSlot`;
- remove `StoryPresentationMetadata`;
- remove `portraitSlot` from parsed characters;
- stop parsing `**Portrait Slot**` metadata;
- stop emitting generated `presentation.ts` files;
- remove `presentation` from story loader results;
- remove `readerState.presentation` and all reader/controller presentation props;
- remove existing authored `Portrait Slot` bullets from raw character docs.

After this change, `DialogueEntry.characterId` and `DialogueEntry.portrait` are the only story inputs needed for portrait-stage projection.

There is no compatibility layer. The old contract has no production-user compatibility requirement and becomes dead machinery once conversational staging owns placement.

## Web Runtime Design

### Pure stage projection

Add a small pure helper under the visual-assets area:

```text
apps/web/src/lib/visual-assets/portrait-stage.ts
```

It exposes:

```ts
projectPortraitStage(
    dialogue: readonly DialogueEntry[],
    dialogueIndex: number
): PortraitStage
```

The helper owns only stage composition. It does not load assets, mutate caches, know about releases, or talk to Svelte.

### Snapshot shape

Replace the single portrait layer with explicit left and right layers plus active-slot state:

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

The slot is represented by the object key, so portrait layers no longer need an internal `slot` field.

### Controller responsibilities

`VisualStateController.update()` projects the stage for the current input and reconciles each desired slot independently.

For each slot:

- desired empty -> publish `omitted` and clear that slot's protected cache/release identity;
- same logical portrait under the active release -> keep the ready layer;
- changed portrait -> publish `loading`, resolve/load it, then publish `ready`, `missing`, or `failed` using the existing generation/release guards.

The controller therefore moves from one portrait cache key/release ID to two slot-local pairs. It reuses existing image loading, fallback, generation, object-URL detachment, release validation, and prefetch machinery.

Portrait async freshness must compare a completed load against the currently projected target for that slot. It cannot compare only against the current dialogue entry's `portrait`, because retained inactive portraits may come from earlier lines.

Cache protection includes both ready portrait slots.

Within-scene lookahead continues prefetching portrait identities from future dialogue entries as it does today. It does not need to project future stage layouts.

### Reader rendering

`VisualNovelReader.svelte` renders two stable portrait images, one per slot.

Each exposes:

```text
data-testid="visual-portrait-left|visual-portrait-right"
data-portrait-state="omitted|loading|ready|missing|failed"
data-portrait-slot="left|right"
data-portrait-active="true|false"
```

Active portrait:

- full brightness/opacity;
- above the inactive portrait when overlap occurs.

Inactive portrait:

- `brightness(0.55)`;
- `opacity: 0.82`;
- short filter/opacity transition;
- no movement animation.

When `activePortraitSlot === null`, both visible portraits use inactive styling.

## Responsive Layout

The current mobile `82vw` portrait cap was tuned for one portrait and is too large for a two-character stage.

Use the same stage model at every breakpoint and reduce per-portrait width only:

- desktop/regular landscape: cap each portrait at `min(42vw, 36rem)`;
- mobile portrait: cap each portrait at `54vw`;
- compact landscape: retain the existing `42vw` cap.

These constants may be adjusted only if the browser geometry tests demonstrate a concrete overlap problem. Do not introduce breakpoint-specific stage logic.

## Error and Loading Semantics

Each slot fails independently.

- If one portrait asset is missing or fails, the other slot remains visible.
- A failed current-speaker portrait does not remove a previously successful opposite portrait.
- Release-level invalid/unavailable behavior remains governed by existing controller semantics.
- Generation checks prevent old loads from overwriting newer projected targets.
- Object-URL detachment and protected-cache bookkeeping cover both portrait layers.

No new user-facing error UI is required.

## Testing

### Pure projection

Cover:

1. empty/narration-only stage;
2. first speaker left;
3. second speaker right;
4. repeated speaker remains in place;
5. expression replacement in place;
6. visible speaker reactivation when current line omits portrait;
7. third-character replacement opposite the last visible speaker;
8. narration dims/preserves stage without losing alternation history;
9. unseen no-portrait character does not enter;
10. direct prefix projection produces the same result as sequential history.

### Visual controller

Prove:

- both projected slots load independently;
- expression changes reload only the affected slot;
- reactivation does not reload an unchanged portrait;
- replacement preserves the other slot;
- both cache keys are protected;
- stale async loads cannot overwrite newer targets;
- detachment checks both layers;
- soft release revalidation refreshes both desired slots;
- missing/fallback is slot-local.

### Component/browser

Prove:

- two stable portrait elements exist;
- active/inactive attributes switch without clearing retained image URLs;
- browser-computed inactive filter contains `brightness(0.55)` and opacity is `0.82`;
- narration dims both;
- line 6/7/8 of Seventh Mirror produces Yuma-left -> Mio-right -> Yuma-left reactivation;
- direct navigation reconstructs the same two portraits;
- desktop/mobile/compact-landscape portrait geometry stays above the dialogue box and does not cover essential controls.

## Delivery

Implement this as one PR (#64).

The implementation contains:

1. pure stage projection;
2. deletion of obsolete static portrait-placement authoring/runtime metadata;
3. two-slot visual-controller reconciliation;
4. two-image reader rendering with inactive-speaker dimming;
5. responsive two-portrait sizing;
6. focused unit/component/E2E coverage.

No compatibility layer, stage engine, new dependency, asset-generation work, or persisted schema change is needed.
