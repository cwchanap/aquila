# Two-Character Portrait Stage Design

Date: 2026-09-03
Status: Approved

## Summary

Replace the visual novel reader's one-active-portrait presentation with a deterministic two-slot conversation stage.

The first character that actually has a portrait in a scene occupies the left slot. When a different portrait-bearing character speaks, that character occupies the opposite slot and the previous visible speaker remains on screen. The current visible speaker renders at normal brightness while the other visible portrait is dimmed. Repeated lines and expression changes for a character that is still visible keep that character on the same side.

Stage composition is reconstructed from the current scene's dialogue prefix rather than stored as hidden mutable reader history. Direct URLs, restored dialogue indices, history/navigation jumps, and normal sequential play therefore produce the same composition.

This remains a deliberately small two-character presentation model. It does not introduce general stage direction, arbitrary multi-character layouts, permanent character home sides, entrance/exit commands, or persisted stage state.

## Prerequisite Geometry Decision

PR #65 (`fix/vn-reader-portrait-sidebar`, commit `cf62bcf2`) must land before implementation of this design begins.

That branch deliberately changes the visual reader geometry:

- dialogue box height: `18rem -> 14.4rem`, mobile `40dvh -> 32dvh`, compact landscape `9.5rem -> 7.6rem`;
- portrait bottom: from above the dialogue box to `bottom: max(1rem, env(safe-area-inset-bottom))`, so the portrait stands behind the dialogue box;
- portrait sizing: full available viewport height rather than `max-height` above the box;
- mobile portrait cap: `82vw -> 94vw`;
- reader grid/act panel: adds `grid-template-rows: minmax(0, 1fr)` and `.act-panel { min-height: 0; }` for sidebar scrolling.

This design builds on that geometry rather than reverting it. After #65 lands, #64 must rebase onto `main` before production implementation. Two-character work may narrow portrait `max-width` and add active/inactive styling, but it must preserve #65's portrait `bottom`, full-height sizing, reduced dialogue-box heights, reader grid row, and act-panel sizing unless a new measured regression demonstrates that one of those #65 decisions is independently wrong.

The previous `82vw` baseline in earlier drafts referred to pre-`cf62bcf2` `main` and is no longer the implementation baseline.

## Goals

- Alternate visible characters between left and right instead of falling back to left for most characters.
- Keep the previous visible conversation partner on screen when the speaker changes.
- Dim every visible portrait that is not the current visible speaker.
- Keep a character on the same side while that character remains staged, including repeated lines and expression changes.
- Produce identical stage composition for sequential play and direct navigation to a dialogue index.
- Keep the feature bounded to two visible portrait slots and one implementation PR.
- Avoid re-requesting a retained portrait that already failed under the same active visual release.

## Non-goals

- Three-or-more simultaneous portraits.
- Permanent per-character left/right home sides.
- Author-controlled entrance, exit, move, or z-order commands.
- New story syntax for portrait staging.
- Configurable dim strength per story or character.
- Portrait movement or entrance animations.
- Changes to text-reader behavior, audio playback, story flow, bookmarks, or persisted reader-session schema.
- Backward compatibility for the old static `Portrait Slot` presentation contract.
- Reverting or redesigning PR #65's portrait-behind-dialogue geometry.

## Current State

The current story contract exposes `PortraitSlot = 'left' | 'right'` and `StoryPresentationMetadata.portrait.activeLimit: 1`, with a `defaultSlot` and optional `slotsByCharacterId` overrides. The compiler emits `defaultSlot: 'left'` and the visual controller resolves missing assignments to left.

That presentation object contains no information unrelated to portrait placement, but it is threaded through story loading, `readerState`, `ReaderShell`, `VisualNovelReader`, and `VisualStateController` solely to support the one-portrait slot decision.

The visual controller snapshot exposes a single `portrait` layer and owns one portrait cache/release identity. `VisualNovelReader.svelte` renders one portrait `<img>`.

PR #65 changes only visual geometry; it does not change this one-portrait runtime contract. This design therefore consumes #65's geometry as the baseline while replacing the single-portrait state model.

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
   - This includes generated narrator lines such as `{ characterId: Narrator, ... }` that intentionally have no portrait.

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
A(base) -> A left active
B(base) -> A left dim, B right active
B(angry) -> A left dim, B right active with angry expression
A(no new portrait) -> A left active, B right dim
C(base) -> A left dim, C right active
D(base) -> D left active, C right dim
```

### Re-entry after replacement

A side is stable only while the character remains one of the two staged portraits. Once a character is replaced, the projector does not remember a permanent home side.

Therefore this sequence is intentional and deterministic:

```text
A(base) -> A left
B(base) -> A left, B right
C(base) -> C left, B right
A(base) -> C left, A right
```

A re-entering character is treated as a new visible character and may return on the opposite side from an earlier appearance. Adding permanent home-side metadata is explicitly out of scope.

### Accepted flagship side inversion

The current Seventh Mirror authoring metadata pins Mio left and Yuma right, but `ch1_act2` has Yuma as the first portrait-bearing speaker at dialogue 6, followed by Mio at dialogue 7.

Deleting author home sides therefore intentionally changes the flagship sequence to:

```text
dialogue 6 -> Yuma left active
dialogue 7 -> Yuma left dim, Mio right active
dialogue 8 -> Yuma left active, Mio right dim
```

This is an accepted consequence, not a regression. The reason is architectural: conversation-order placement has one source of truth. Reintroducing Mio/Yuma home-side metadata would recreate the static/dynamic dual-placement system this change is explicitly deleting. If permanent author-controlled home sides are later proven necessary, they should be introduced as a new projector rule in a separate feature rather than restoring `slotsByCharacterId` beside the current algorithm.

### Narration and non-visible dialogue

Narration or other lines that do not produce a visible current speaker include both:

- lines without `characterId`; and
- lines with a `characterId` that is not currently visible and no `portrait`, including the current generated narrator shape.

For those lines:

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
- stop interpreting `**Portrait Slot**` as valid metadata;
- stop emitting generated `presentation.ts` files;
- remove `presentation` from story loader results;
- remove `readerState.presentation` and all reader/controller presentation props;
- remove existing authored `Portrait Slot` bullets from raw character docs.

The parser keeps one narrow validation sentinel for the removed syntax: if a character document still contains a `- **Portrait Slot**: ...` bullet, compilation fails with a clear error that portrait placement is automatic and the metadata must be removed. Silently accepting and ignoring the old directive is not allowed because it would make copied legacy authoring templates appear to work while doing nothing.

All reserved-character-ID error text and comments must be rewritten to describe only the remaining `characterTable` lookup hazard. Deleted terms such as `slotsByCharacterId`, `defaultSlot`, and “character with no portraitSlot” must not survive in active source/test commentary.

This rejection sentinel is not a compatibility adapter and carries no placement behavior. After the authored bullets are removed, `DialogueEntry.characterId` and `DialogueEntry.portrait` are the only story inputs needed for portrait-stage projection.

There is no migration or compatibility layer.

## Web Runtime Design

### Pure stage projection

Add:

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

- desired empty -> publish `omitted` and clear that slot's protected cache/release identity and failure memo;
- same logical portrait under the active release -> keep the ready layer;
- same logical portrait already `missing`/`failed` under the same release generation -> keep the terminal layer and do not request it again;
- changed portrait or new release generation -> publish `loading`, resolve/load it, then publish `ready`, `missing`, or `failed` using the existing generation/release guards.

The controller therefore moves from one portrait cache key/release ID to two slot-local pairs. It reuses existing image loading, fallback, generation, object-URL detachment, release validation, and prefetch machinery.

Portrait async freshness must compare a completed load against the currently projected target for that slot. It cannot compare only against the current dialogue entry's `portrait`, because retained inactive portraits may come from earlier lines.

### Per-release failure memoization

Retained failure becomes more important with two slots because a failed inactive portrait may remain projected for many subsequent lines. Without memoization, the current `isLayerCurrentForRelease()` rule (`state === 'ready'`) would turn the failed slot back into `loading` and re-fetch it on every `update()`.

Keep one small memo per slot:

```ts
type PortraitFailureMemo = {
    releaseGeneration: number;
    portraitKey: string;
} | null;
```

A `missing` or `failed` result records `{ releaseGeneration, portraitKey }` for that slot. While the projected key and release generation are unchanged, `prepareLoadingLayers()` retains the terminal layer and `prepareCurrentInput()` skips the request. Clear or supersede the memo when:

- the slot becomes empty;
- the slot's projected portrait key changes;
- the controller is disposed; or
- `releaseGeneration` changes, which makes the old memo no longer match and permits one retry under the new release.

A successful load clears the slot memo.

This is deliberately not a retry framework. The contract is simply “once per portrait key per release generation.” A soft revalidation that resolves to the same immutable release does not retry known failed bytes; activation of a different release does.

As long as a failed/missing portrait remains projected, `status: 'fallback'` remains appropriate. Replacing/clearing that slot allows status to recover normally.

### Cache/lifecycle

Cache protection includes both ready portrait slots. Object-URL detachment checks both portrait layers. Dispose clears both slot-local cache/release/failure tracking records.

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
- above the inactive portrait but still behind the dialogue box from PR #65.

Inactive portrait:

- `brightness(0.55)`;
- `opacity: 0.82`;
- short filter/opacity transition;
- no movement animation.

When `activePortraitSlot === null`, both visible portraits use inactive styling.

## Responsive Layout

Implementation must start from PR #65 / `cf62bcf2`, whose portrait baseline is:

```css
.visual-portrait {
  bottom: max(1rem, env(safe-area-inset-bottom));
  max-width: min(48vw, 42rem);
  height: calc(
    100dvh - max(1rem, env(safe-area-inset-bottom)) -
      env(safe-area-inset-top)
  );
}

@media (max-width: 47.99rem) and (orientation: portrait) {
  .visual-portrait { max-width: 94vw; }
}

@media (max-height: 31rem) and (orientation: landscape) {
  .visual-portrait { max-width: 42vw; }
}
```

The two-character change preserves `bottom` and `height` and narrows only portrait width caps while adding dim/active styling. Initial targets are:

- desktop/regular landscape: `max-width: min(42vw, 36rem)`;
- mobile portrait: `max-width: 54vw`;
- compact landscape: keep `42vw` unless two-slot browser measurements prove it needs narrowing.

These width values may be adjusted only from actual browser geometry. Do not restore the pre-#65 “portrait must sit above dialogue box” rule. Portrait/dialogue geometric overlap is intentional because the portrait is behind the box.

Browser geometry should prove instead that:

- each ready portrait has measurable dimensions and stays within the reader viewport;
- left/right anchors place portraits on their intended sides;
- the dialogue box, History, Continue, and Settings remain visible/usable above the portraits;
- the #65 dialogue-box heights remain unchanged;
- desktop, mobile portrait, and compact landscape remain usable with one and two ready portraits.

Do not assert that portrait bounding boxes do not intersect the dialogue box or its controls; #65 intentionally allows that intersection behind higher-z-index UI.

## Error and Loading Semantics

Each slot fails independently.

- If one portrait asset is missing or fails, the other slot remains visible.
- A failed current-speaker portrait does not remove a previously successful opposite portrait.
- A retained failed/missing portrait is not re-requested on every line under the same release generation.
- A new release generation permits one retry of the still-projected portrait key.
- Release-level invalid/unavailable behavior remains governed by existing controller semantics.
- Generation checks prevent old loads from overwriting newer projected targets.
- Object-URL detachment and protected-cache bookkeeping cover both portrait layers.

No new user-facing error UI is required.

## Testing

### Pure projection

Every fixture that is intended to enter the stage must include an explicit portrait key. Do not use shorthand such as `A, B, C` where an omitted portrait would mean “unseen character” under the real algorithm.

Cover:

1. empty/no-character narration-only stage;
2. first portrait-bearing character left;
3. second portrait-bearing character right;
4. repeated visible speaker remains in place;
5. expression replacement in place;
6. visible speaker reactivation when current line omits portrait;
7. third-character replacement opposite the last visible speaker;
8. narrator-with-`characterId` and no portrait dims/preserves the stage without losing alternation history;
9. unseen no-portrait character does not enter;
10. `A(base), B(base), C(base), A(base)` produces `C left / A right`;
11. direct prefix projection produces the same result as sequential history.

### Visual controller

Prove:

- both projected slots load independently;
- expression changes reload only the affected slot;
- reactivation does not reload an unchanged portrait;
- replacement preserves the other slot;
- both cache keys are protected;
- stale async loads cannot overwrite newer targets;
- detachment checks both layers;
- soft release revalidation refreshes both desired slots when the release changes;
- missing/fallback is slot-local;
- a failed or missing retained slot is not requested again on the next line under the same release generation;
- changing that slot's key or activating a new release generation permits a new request.

### Component/browser

Prove:

- two stable portrait elements exist;
- active/inactive attributes switch without clearing retained image URLs;
- browser-computed inactive filter contains `brightness(0.55)` and opacity is `0.82`;
- narration dims both;
- line 6/7/8 of Seventh Mirror produces Yuma-left -> Mio-right -> Yuma-left reactivation;
- direct navigation reconstructs the same two portraits;
- corrupting Mio on the line 6 -> 7 transition fails only the right/Mio slot while the ready left/Yuma slot remains visible;
- advancing again does not request the same corrupt Mio object a second time while the release is unchanged;
- desktop/mobile/compact-landscape preserve PR #65's portrait-behind-dialogue geometry and keep reader controls usable;
- every existing local `visual.portrait` assertion is rewritten to explicit left/right/ready/active-portrait semantics rather than leaving a single-node compatibility locator;
- the deployed release gate waits for the pre-change active portrait to be ready, captures its source, advances, then unconditionally waits for the new projected active portrait to be ready and proves its source changed.

## Risks and Mitigations

### Risk 1: CSS merge/revert with PR #65

Both changes touch the same portrait CSS. If #64 is implemented from pre-#65 `main`, its old “portrait above dialogue box” block would silently revert #65 and tests could accidentally defend the revert.

**Mitigation:** #65 lands first; #64 rebases; styling steps explicitly preserve #65 `bottom`, `height`, dialogue heights, grid row, and act-panel sizing. Geometry assertions are rewritten around portrait-behind-dialogue behavior before local visual E2E is treated as a gate.

### Risk 2: retained failure retry loop

A failed inactive portrait can stay projected for many lines. Treating only `ready` as reusable would repeatedly republish `loading` and re-fetch the same immutable broken object on every line.

**Mitigation:** per-slot `(releaseGeneration, portraitKey)` failure memoization makes missing/failed terminal once per release and adds focused controller + corrupt-Mio browser coverage.

## Delivery

Implement this as one PR (#64) after PR #65 lands.

The implementation contains:

1. pure stage projection;
2. one atomic contract swap that deletes obsolete static portrait-placement authoring/runtime metadata and introduces two-slot controller reconciliation;
3. loud compiler error for leftover legacy `Portrait Slot` directives;
4. per-slot per-release failure memoization;
5. two-image reader rendering with inactive-speaker dimming;
6. responsive width changes derived from #65 geometry;
7. focused unit/component/local E2E/deployed-gate coverage.

No compatibility layer, stage engine, permanent home sides, new dependency, asset-generation work, persisted schema change, or #65 geometry rollback is needed.
