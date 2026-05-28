# Story Compiler & Content Package Consolidation — Design

**Date:** 2026-05-27
**Status:** Approved (pending spec review)

## Problem

Raw narrative for the Train Adventure story lives as 495 Chinese-only markdown files under
`packages/stories/trainAdventure/`, organized into a deeply nested branch tree (folders
`branch_1a`, `branch_1b/branch_2c`, … up to `branch_11`). The runtime the game/web actually
consume lives under `packages/dialogue/src/stories/trainAdventure/` as hand-authored
TypeScript — but that content is a small, outdated, hand-built slice whose `scene_4b`-style
ids cannot represent the full tree, and most of it is empty placeholders.

We need a script that compiles the markdown source into the runtime game asset
(dialogue + flow graph + choices), and we want to remove the resulting package redundancy.

## Goals

1. A **generic, story-agnostic compiler** that reads `packages/stories/<story>/` markdown and
   emits the runtime TypeScript asset for that story.
2. **Deterministic** parse (no translation, no LLM). Generates **zh** content only; English is
   produced separately.
3. Generate **dialogue + flow graph**, and **stub** choice prompts/labels (the markdown has no
   structured choice text).
4. **Consolidate packages**: delete `@aquila/dialogue` and fold it into `@aquila/stories`, the
   single framework-agnostic content package. Keep Phaser out of the web app.

## Non-Goals

- Translating zh → en (handled separately; compiler emits an en skeleton only).
- Authoring choice prompt/label text (compiler scaffolds TODO stubs; humans fill them).
- Editing the 495 source markdown files (no frontmatter, no bilingual rewrite).
- Changing the public runtime contract shapes (`DialogueMap` / `ChoiceMap` / `FlowConfig`)
  consumed by `@aquila/game` and `apps/web`.
- Code-splitting / lazy-loading story content (the game deliberately uses bundled internal TS
  modules, not network JSON, for offline support). Revisit only if bundle size hurts.

## Key Decisions (and why)

- **zh-only, deterministic.** Source is Chinese-only; a parser can't translate. English is a
  separate workflow. The compiler emits an `dialogue.en.ts` **skeleton** (same keys, empty
  strings) so `getStoryContent(_, 'en')` stays structurally valid and a translator can fill it.
- **Dialogue + flow generated; choices stubbed.** Branch structure is fully derivable from
  folders; choice prompt/label text is not present in the markdown.
- **Generated TypeScript, eager/synchronous.** Matches the team's existing deliberate choice
  (`PreloadScene.ts`: "load from internal modules instead of network JSON") and keeps the
  public API synchronous and offline-friendly.
- **Consolidate into `@aquila/stories`, not `@aquila/game`.** `apps/web` (novel reader) needs
  content without Phaser. `@aquila/game` hard-depends on Phaser (SSR-hostile) and sits *above*
  the content layer (it re-exports and extends dialogue's types). `dialogue` is a shared leaf;
  merging it into `game` would invert dependencies and force the web app to bundle Phaser.
  Folding `dialogue` into `stories` removes the redundant package without that coupling.

## Architecture

### Package consolidation

`@aquila/stories` becomes the single framework-agnostic content package. `@aquila/dialogue` is
deleted; its modules move into `@aquila/stories`:

- `characters/` (`CharacterId`, `CharacterDirectory`, `CharacterInfo`)
- `translations/` (`en.json`, `zh.json`, `getTranslations`, `Locale`)
- `types.ts` (`DialogueEntry`, `DialogueMap`, `ChoiceMap`, …)
- `flow-types.ts` (`FlowConfig`, `FlowNodeDefinition`, …)
- `stories/index.ts` loaders (`getStoryContent`, `getStoryFlow`)
- generated runtime content per story

The public API keeps the **same shapes**; only the import specifier changes for consumers
(`@aquila/dialogue` → `@aquila/stories`).

Dependency arrows after consolidation:
`game → stories`, `web → stories`, `desktop → game + stories`. Phaser stays only in
`game` + `desktop`. `stories` has no framework dependency.

### Proposed package layout

```
packages/stories/
  package.json                 # @aquila/stories — now a real TS package (exports map, scripts)
  raw/
    <story>/                   # raw markdown source (moved from packages/stories/trainAdventure/)
      act1.md ...
      compiler.config.ts       # { storyId, resolveCharacter }
  src/
    index.ts                   # public barrel (was @aquila/dialogue's src/index.ts)
    types.ts
    flow-types.ts
    characters/{CharacterId.ts,index.ts}
    translations/{en.json,zh.json,index.ts}
    stories/
      index.ts                 # getStoryContent / getStoryFlow registry (one line per story)
      <story>/
        generated/             # 100% compiler-owned, safe to delete & regenerate
          scenes/<branch-path>/<act>.ts   # one DialogueEntry[] per scene (zh)
          dialogue.zh.ts                  # DialogueMap index
          dialogue.en.ts                  # en skeleton (same keys, empty strings)
          flow.ts                         # FlowConfig + SceneId union + choice transitions
        choices.zh.ts          # hand-maintained: prompt + option labels (scaffolded; never clobbered)
        index.ts               # thin: merge choice text + flow transitions → getXStory()
    compiler/                  # build-time only; never re-exported from src/index.ts
      ir.ts                    # IR types
      parse-scene.ts           # markdown → Scene IR
      infer-flow.ts            # folder tree → Flow IR + choice stubs
      emit.ts                  # IR → generated TypeScript
      validate.ts             # integrity checks
      cli.ts                   # discovers raw/<story>/, compiles each
```

The compiler lives **inside** `@aquila/stories` (not a separate package) to reduce sprawl and
co-locate it with the content it generates. It is reachable only via the CLI entry, so it never
enters the runtime bundle of consumers.

### Compiler pipeline

`parse → in-memory Story IR → emit TS`. The IR decouples parsing from emission and is unit-
testable in isolation (optional `--dump-ir` writes JSON for debugging; TypeScript is the only
committed output).

#### 1. Per-story config (`raw/<story>/compiler.config.ts`)

```ts
export default {
  storyId: 'train_adventure',
  resolveCharacter: (name: string) => CharacterDirectory.getIdByName(name),
}
```

Keeps the compiler generic. trainAdventure delegates to the existing `CharacterDirectory`,
which already maps both real names (`李杰`) and aliases (`健談男大生`) to `CharacterId`.

#### 2. Parser (markdown → Scene IR)

- Drop the leading `# 第N幕：…` H1 (retain title as optional scene metadata).
- Split on blank lines into paragraphs.
- Each paragraph must match `**name**：text` (full-width `：` or half-width `:`):
  resolve `name` → `CharacterId` via `resolveCharacter`; emit `{ characterId, dialogue }`.
- Inline parentheticals (`(內心)` / `（內心）`) are kept **verbatim** in the dialogue text
  (matches current runtime). Punctuation is passed through unchanged (normalization is out of
  scope).
- Unresolved character name OR a non-empty paragraph that is not a valid header line →
  **hard error** with `file:line` (catches format drift and typos).

#### 3. Flow inference (folder tree → Flow IR + choice stubs)

Invariants verified against the current content:

- Within a directory, scenes are ordered: numeric `actN` ascending, then `actFinal`, then
  `actEpilogue`. Consecutive scenes are chained via `next`.
- A directory's **last** scene:
  - if the directory has child `branch_*` directories → it is a **choice point**: emit a
    `choice:` flow node with one option per child (sorted `a`, `b`, `c`, …); each option's
    `nextScene` = that child's first act. The last scene's `next` points to the choice node.
  - otherwise → **terminal** (`next: null`).
- Act numbers continue across branch boundaries (a child branch's first act = parent's last
  act + 1; siblings reuse the same starting number), which is why ids must encode the branch
  path, not just the act number.
- The root directory's first scene is the flow `start`.

**Scene id scheme** (derived from the path relative to the story root): replace `branch_` with
`b`, join path segments with `_`, append the act basename. Examples:

| File | Scene id |
|---|---|
| `act1.md` | `act1` |
| `branch_1b/act8.md` | `b1b_act8` |
| `branch_1b/branch_2c/act14.md` | `b1b_b2c_act14` |
| `branch_1b/branch_2c/actFinal.md` | `b1b_b2c_actFinal` |

Collision-free, stable, human-readable. The compiler generates the `SceneId` string-union type
and the `FlowConfig`.

**Choice ids:** `choice_<lastSceneId>` (e.g. `choice_b1b_act8`); the flow node id is
`choice:choice_b1b_act8` (matching the existing `ChoiceNodeId = \`choice:${string}\`` contract).
Option ids derive from child folders (`b2a`, `b2b`, `b2c`).

#### 4. Choices: structure generated, text preserved

To stub choices without ever clobbering hand-written text, the two concerns are split:

- **Generated** (`flow.ts`): owns *transitions* — `nextByOption` (optionId → sceneId). Always
  regenerated.
- **Hand-maintained** (`choices.zh.ts`): owns only `{ [choiceId]: { prompt, labels: { [optionId]: label } } }`.
  The compiler scaffolds TODO entries for any missing choice/option ids and **warns on drift**
  (new or removed choices), but never overwrites existing entries.
- `index.ts` merges flow transitions + choice text into the existing `ChoiceMap` shape
  (`{ prompt, options: [{ id, label, nextScene }] }`), so consumers see no contract change.

#### 5. Output & English

- `generated/scenes/<branch-path>/<act>.ts` — one `DialogueEntry[]` per scene (zh), keeping
  regeneration diffs small and incremental-build-friendly (mirrors the existing convention).
- `generated/dialogue.zh.ts` — `DialogueMap` index importing all scene modules.
- `generated/dialogue.en.ts` — en skeleton: identical keys, empty strings.
- `generated/flow.ts` — `FlowConfig`, `SceneId` union, choice transition structure.

### Required consumer changes

- **Import specifier:** `@aquila/dialogue` → `@aquila/stories` across `apps/web`,
  `apps/desktop`, `@aquila/game`, and their `package.json` deps. `@aquila/game` keeps its thin
  Phaser-specific layer (`src/dialogue/types.ts` extensions, `src/characters/CharacterDirectory.ts`
  re-export), now importing from `@aquila/stories`.
- **`apps/web/src/lib/reader-manager.ts`:** replace `parseSceneNumber` / `hasNextScene`
  (regex-incrementing `scene_<n>`) with flow-graph navigation via `getStoryFlow`. The integer
  scheme is gone, and branching already invalidated linear "next" detection.

### Validation & testing

`validate.ts` fails the build when:
- any `next` / `nextScene` target references a missing scene,
- a scene is unreachable (orphan) from `start`,
- a character name fails to resolve.

Tests (Vitest, matching repo conventions):
- parser fixtures (markdown snippet → expected `DialogueEntry[]`),
- flow inference on a synthetic fixture tree (ordering, terminals, choice fan-out, id derivation),
- unknown-character → error,
- a golden trainAdventure compile asserting `start`, total scene count, and
  `act3 → choice → b1a / b1b`.

### Running

- Root script: `bun compile:stories` → `bun --filter @aquila/stories compile` → `src/compiler/cli.ts`.
- Generated output is **committed**.
- Compiler is run manually when markdown changes — **not** in the dev/build hot path.
- Optional CI guard: re-run the compiler and assert the working tree has no diff, so committed
  output cannot silently drift from source.

## Migration outline (high level; detailed steps belong in the implementation plan)

1. Turn `@aquila/stories` into a TS package; move `@aquila/dialogue`'s `src/` modules in;
   move raw markdown under `raw/<story>/`.
2. Build the compiler under `src/compiler/`; add the `compiler.config.ts` for trainAdventure.
3. Compile trainAdventure; delete the old hand-authored runtime
   (`en.ts`, `zh.ts`, `zh/**`, `flow.ts`).
4. Update `getStoryContent` / `getStoryFlow` registry and the per-story `index.ts` merge.
5. Repoint all consumers from `@aquila/dialogue` to `@aquila/stories`; delete `@aquila/dialogue`.
6. Update `reader-manager.ts` navigation to use the flow graph.
7. Wire `bun compile:stories`; add tests and the optional CI no-diff guard.

## Risks

- **Folder-structure inference is the one fragile spot.** Mitigated by `validate.ts` and the
  golden compile test; format drift in markdown fails loudly with `file:line`.
- **Scene-id change breaks old save data** keyed on `scene_<n>` ids. Acceptable: content is
  pre-release/disposable and being regenerated wholesale.
- **Large cross-package move** (delete `@aquila/dialogue`). Mitigated by keeping API shapes
  identical so changes are mostly mechanical import-specifier updates, verified by typecheck +
  existing tests.
```
