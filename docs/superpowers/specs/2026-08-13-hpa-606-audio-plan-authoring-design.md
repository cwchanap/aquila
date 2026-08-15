# HPA-606 Per-Story Audio Plans and Authoring Guidance

Date: 2026-08-13
Status: Implemented in PR #55 (feat(stories): add per-story audio plans)

## Goal

Replace Aquila's temporary global SFX/BGM cue allowlists with one provider-neutral `audio-plan.json` per audio-enabled story, validate authored cue usage against that plan during story compilation, provide deterministic read-only usage coverage for audit work, and teach the existing story-writing/orchestration/review skills to use the contract consistently.

HPA-604 and HPA-605 are already merged on this PR's `main` base. HPA-606 therefore covers both SFX and BGM. It does not generate audio, publish audio, redesign runtime playback, or perform the full Seventh Mirror audio-direction pass.

## Current Code Evidence

- `packages/stories/src/audio-cues.ts` is the temporary global cue authority: three SFX keys and two BGM keys.
- `packages/stories/src/compiler/parse-scene.ts` already parses `sfx`, `bgm`, and `bgm stop`, but also performs global membership checks.
- `packages/stories/src/compiler/compile.ts` already owns the assembled `StoryIR`, the warning path, and the final validation window before `emitStory` / choice scaffolding.
- `packages/stories/src/runtime-assets/schemas.ts` establishes the local pattern for strict versioned Zod contracts and discriminated unions.
- `packages/stories/src/runtime-assets/paths.ts` already owns logical-key safety and deterministic qualified-id ordering helpers.
- `apps/web/src/lib/audio/sfx-catalog.ts` and `bgm-catalog.ts` are temporary local-fixture maps whose exact cue-union typing disappears when `audio-cues.ts` is removed.
- `.agents/skills/writing-story-acts`, `orchestrating-stories`, and `reviewing-written-stories` already own story authoring and review behavior.

## Reuse Boundaries

Reuse existing conventions where they fit, but do not couple audio authoring to the visual release contract.

### Reuse

- Use strict Zod objects, a literal `schemaVersion`, a discriminated union, and plan-level duplicate refinement, matching the runtime-asset contract style.
- Validate cue keys with `isSafeLogicalKey` in addition to the narrower authoring slug rule.
- Use the existing lexical qualified-id comparator for deterministic `type:key` ordering where useful.
- Reuse `compileStory`'s existing warning emission path.

### Keep separate

Do **not** reuse or widen `AssetTypeSchema` / `LogicalAssetIdentitySchema`: they intentionally model visual runtime assets (`background | portrait`). Audio uses its own local `AudioAssetTypeSchema = z.enum(['sfx', 'bgm'])`.

Do **not** extend `resolveSceneAssets` to collect audio usage. That function mutates visual background/portrait state while walking entries; audio validation/reporting is a separate pure concern and needs explicit entry indexes.

Do **not** reuse `validateReleaseCoverage`. It is tied to visual release dispositions and `Record<AssetType, ...>` coverage. HPA-606 only needs plan-vs-authored cue validation.

## Design Direction

Keep `parseScene` syntax-only.

`parseScene` remains responsible for:

- fenced-block grammar;
- pending SFX/BGM semantics;
- `bgm stop`;
- duplicate pending blocks;
- EOF handling.

It accepts any syntactically valid lowercase hyphenated cue key. Story-specific membership and SFX/BGM type validation happen only after the full `StoryIR` is assembled.

Do not thread plan/filesystem state into `parseScene`, generate per-story cue unions, or add structured audio data to the existing graph/portrait `validate.ts` module.

## Audio Plan V1

Canonical path:

```text
packages/stories/raw/<storyName>/docs/audio-plan.json
```

Add `packages/stories/src/audio-plan.ts` with a strict provider-neutral contract, exported types, and a pure parser (no filesystem access). The filesystem loader lives in a separate `packages/stories/src/audio-plan-loader.ts` (Node-only, kept out of the package entry so browser bundles never pull in `node:fs`/`node:path`); `audio-plan.ts` owns only the pure schema/parser while `audio-plan-loader.ts` owns filesystem loading.

### Shape

```ts
type AudioPlanV1 = {
  schemaVersion: 1;
  assets: AudioPlanAsset[];
};

type SfxPlanAsset = {
  key: string;
  type: 'sfx';
  prompt: string;
  durationMs: number;
  notes?: string;
};

type BgmPlanAsset = {
  key: string;
  type: 'bgm';
  prompt: string;
  durationMs: number;
  loop: true;
  notes?: string;
};
```

Use `type`, not `kind`, so authoring identity naming aligns with the repository's existing asset vocabulary without widening the visual `AssetTypeSchema`.

### Validation rules

- `schemaVersion` is exactly `1`.
- All objects are strict; unknown fields fail.
- `type` is exactly `sfx` or `bgm` through a local discriminated union.
- `key` must pass `isSafeLogicalKey` **and** match `^[a-z0-9]+(?:-[a-z0-9]+)*$` so it is both repository-safe and valid Markdown cue syntax.
- `stop` is reserved and cannot be an asset key.
- `prompt` contains non-whitespace text.
- `durationMs` is a positive integer for both SFX and BGM.
- SFX rejects `loop`.
- BGM requires `loop: true`.
- Optional `notes` contains non-whitespace text when present.
- Cue keys are globally unique across the plan, including across SFX/BGM types.

Global key uniqueness stays deliberate: authored runtime fields carry plain logical strings, and HPA-606's Linear contract already treats duplicate keys as invalid. Do not switch to type-qualified duplicate semantics that would allow the same key once as SFX and once as BGM.

`durationMs` remains required for BGM because HPA-607 must report total intended generated duration before API work. `loop: true` remains explicit provider-neutral creative intent; the current runtime supports only looping BGM, so `false` is not accepted yet.

Do not add provider/model IDs, seeds, request IDs, candidate paths, approvals, hashes, credits, runtime URLs, volume, fades, or release metadata.

### Pure parser

```ts
export function parseAudioPlan(value: unknown): AudioPlanV1
```

Unit tests call this directly without filesystem access.

### Tiny loader

```ts
export function loadAudioPlan(rawDir: string): AudioPlanV1 | undefined
```

The loader:

1. resolves `<rawDir>/docs/audio-plan.json`;
2. returns `undefined` only when the file does not exist;
3. parses JSON;
4. delegates validation to `parseAudioPlan`;
5. wraps JSON/schema failures with the plan path for actionable compiler diagnostics.

Export the parser/types from `@aquila/stories` when the bootstrap cue exports are removed.

## Markdown Parsing Boundary

Remove `isSfxCueKey` / `isBgmCueKey` membership checks from `parse-scene.ts` while keeping all existing structural behavior.

### SFX

````markdown
```sfx
door-open
```

**旁白**：澪推開房門。
````

A syntactically valid unknown key parses. Duplicate pending SFX, malformed blocks, and EOF-pending SFX still fail.

### BGM

````markdown
```bgm
investigation-unease
```

**旁白**：琴音的手停了半拍。
````

Explicit silence remains:

````markdown
```bgm
stop
```

**旁白**：房間只剩時鐘聲。
````

`stop` emits `bgm: null`; it is a command, not a plan asset.

Parser-membership removal and story-level validation must land in the same implementation slice. There must be no reviewable checkpoint where `compile:check` silently accepts unknown authored cues.

## Structured Audio Usage

Add:

```text
packages/stories/src/compiler/audio-usage.ts
```

This module is pure and owns both collection and plan comparison.

### `collectAudioUsage(story)`

Walk `StoryIR.scenes` in existing order and each scene's entries by zero-based `entryIndex`.

For every keyed SFX/BGM usage record:

- `type`;
- `key`;
- `sceneId`;
- `sourcePath`;
- `entryIndex`.

Record `bgm: null` separately as an explicit stop location for coverage output, but never as an asset usage.

No Markdown line/column source map is added.

### `validateAudioUsage(usages, plan)`

Exact signatures may vary, but behavior is fixed:

- no plan + no keyed SFX/BGM usage: valid;
- no plan + keyed usage: fatal;
- used key absent from plan: fatal;
- SFX usage resolving to a BGM plan asset: fatal;
- BGM usage resolving to an SFX plan asset: fatal;
- explicit BGM stop needs no plan entry;
- each unused plan asset yields one deterministic warning.

Plan-shape errors are already fatal in `parseAudioPlan` / `loadAudioPlan`.

## `compileStory` Integration

After assembling `StoryIR`:

1. load `audio-plan.json` if present;
2. collect + validate audio usage;
3. run existing story validation;
4. emit all warnings through the existing `console.warn` path;
5. only then emit generated files / scaffold choices.

Fatal audio errors therefore prevent generated output from being written.

### Read-only report mode

HPA-606 and HPA-607 explicitly require deterministic usage coverage. Keep one minimal command, but do **not** make the report command rewrite generated files.

Use the smallest change to existing compilation: add an internal/option seam that runs normal story assembly and validation while skipping `emitStory` and `scaffoldChoices` for report mode. The normal compile path remains unchanged by default.

No second compiler architecture, argument library, or command framework is introduced.

## Deterministic Cue Usage Report

Expose a command such as:

```bash
bun --filter @aquila/stories audio:report theSeventhMirror
```

backed by one small `--report <rawName>` branch in existing compiler tooling.

The report is operational stdout JSON, not a checked-in or versioned wire artifact:

```json
{
  "story": "theSeventhMirror",
  "assets": [
    {
      "type": "sfx",
      "key": "door-open",
      "usageCount": 1,
      "usages": [
        {
          "sceneId": "ch1_act1",
          "sourcePath": "chapter_1/act1.md",
          "entryIndex": 31
        }
      ]
    }
  ],
  "bgmStops": [
    {
      "sceneId": "ch1_act4",
      "sourcePath": "chapter_1/act4.md",
      "entryIndex": 86
    }
  ],
  "unused": []
}
```

Determinism:

- assets sorted lexically by `type:key`;
- usages remain in story scene order then `entryIndex`;
- BGM stops use the same story ordering;
- unused assets sorted by `type:key`;
- no timestamps, absolute paths, request IDs, or machine-specific data.

Use the existing qualified-id comparator for the lexical `type:key` sort without importing the visual-only identity schema.

Report mode:

- resolves exactly one named raw story;
- uses the normal parser/assembly/audio-validation functions;
- does not emit generated files or scaffold choices;
- prints exactly one JSON document to stdout;
- keeps warnings/diagnostics on stderr;
- has no generic subcommand router.

This preserves the explicit HPA-606/HPA-607 dependency while removing the surprising side effect from the earlier design.

## Bootstrap Migration and Catalog Safety

In the **same implementation slice that enables fatal audio validation**, add:

```text
packages/stories/raw/theSeventhMirror/docs/audio-plan.json
```

with exactly the five cues already authored on `main`:

- SFX: `door-open`, `notification-beep`, `impact`;
- BGM: `dawn-apartment`, `tension-pulse`.

This ordering is required: once no-plan keyed usage becomes fatal, the existing five cues must already have a plan so `bun run compile:check` never stays broken between slices.

Use concise provider-neutral prompts, intended durations, and `loop: true` for the two BGM entries. Do not add/move story cue blocks or perform the HPA-607 story-wide audit.

After validation is plan-backed:

- delete `packages/stories/src/audio-cues.ts`;
- remove its constants/type guards/unions from `packages/stories/src/index.ts`;
- change both temporary web catalogs to ordinary `as const` maps;
- keep runtime `DialogueEntry.sfx?: string` and `bgm?: string | null` open.

### Temporary catalog invariant

Removing `Record<SfxCueKey, string>` / `Record<BgmCueKey, string>` removes compile-time catalog closure. Replace it with one temporary web unit test asserting:

```text
local catalog keys ⊆ The Seventh Mirror audio-plan keys of the same type
```

A planned cue without a local URL is allowed: HPA-607 can expand the creative palette before HPA-608 generates audio. A local catalog URL for an unplanned/wrong-type cue must fail the test.

Do not add a second catalog file or generated union. Delete this test with the local catalogs when HPA-610 replaces them.

## Story Skill Updates

### `writing-story-acts`

When `docs/audio-plan.json` exists or audio direction is explicitly in scope:

- read the plan before writing cue blocks;
- reuse exact approved keys;
- never put URLs, filenames, provider/model syntax, prompts, durations, or candidate metadata in act Markdown;
- use SFX selectively for meaningful actions, reveals, transitions, and recurring motifs rather than Foley on every sentence;
- change BGM at sustained location/mood/story-state boundaries rather than every act/line;
- treat explicit `bgm stop` and silence as valid choices;
- preserve recurring physical/tonal cue identity;
- keep all required plot comprehension in text;
- flag a missing cue definition to the orchestrator rather than inventing an alias.

Add concise `sfx`, keyed `bgm`, and `bgm stop` syntax examples. Do not duplicate the full schema.

### `orchestrating-stories`

The orchestrator owns the canonical plan:

- create/update `docs/audio-plan.json` when audio is in scope;
- decide whether a requested cue deserves a reusable logical key;
- resolve writer requests for missing definitions;
- run normal compilation and deterministic audio coverage;
- review unused warnings before audit/generation work;
- pass the plan path/relevant palette to writing subagents.

No spreadsheet, second inventory, or provider-specific authoring file.

### `reviewing-written-stories`

Do not add Agent D.

The skill has separate chapter-level and per-act Agent B prompt bodies. Add the same optional audio-continuity section to **both**. Run it when a plan exists or reviewed acts contain SFX/BGM blocks.

Check:

- recurring object/location/motif cues reuse consistent logical identities;
- BGM changes follow sustained story state rather than arbitrary act boundaries;
- cues do not spoil reveals or escalate mood prematurely;
- SFX density is selective;
- intentional silence / explicit stop is preserved;
- provider/URL syntax does not leak into acts;
- plot-essential information is not audio-only.

Reuse the existing HIGH/MEDIUM/LOW severity vocabulary and aggregation flow.

## Testing Strategy

### `audio-plan.ts`

Pure parser tests cover:

- valid SFX/BGM;
- wrong version;
- unsafe/malformed/reserved keys;
- duplicate keys including cross-type duplicates;
- invalid duration;
- empty prompt/notes;
- SFX with `loop`;
- BGM without `loop: true`;
- unknown/provider fields.

Loader tests cover absent file, malformed JSON, and path-rich schema errors.

### `audio-usage.ts`

Hand-built `StoryIR` tests cover:

- repeated SFX/BGM usage;
- BGM stop collection;
- missing plan;
- unknown key;
- type mismatch;
- unused warnings;
- deterministic ordering.

### Parser tests

Keep malformed/duplicate/EOF-pending SFX/BGM tests. Change syntactically valid unknown-key expectations so parsing succeeds and membership failure moves to story-level coverage.

### Real `compileStory` integration

Use `mkdtempSync`; never add a permanent `raw/audioFixture` story.

Create temporary `docs/characters.md`, `docs/audio-plan.json`, and one act, plus temp output paths. Prove valid SFX/BGM compiles through the real loader and an unknown cue fails before output emission.

### Report test

Prove one named story produces deterministic valid JSON, includes SFX/BGM usages and stop locations, rejects missing story names, and writes no generated/choice files.

### Catalog-plan test

In the web workspace, load the checked-in Seventh Mirror plan and assert every SFX/BGM local catalog key exists in that plan with the same type. Do not require every plan key to have a local URL.

## Implementation Slices

Every slice intended for review must leave normal compile/tests green.

1. Add `audio-plan.ts`: local audio type schema, strict parser, loader, exports, and focused tests.
2. Deliver the compiler vertical slice atomically: add `audio-usage.ts`; remove parser membership checks; add the five-row Seventh Mirror plan; wire pre-emit validation/warnings; add the `mkdtemp` integration test; add the read-only deterministic report command/tests. This slice is not done unless `compile:check` passes.
3. Delete `audio-cues.ts`, remove global cue exports, retype both temporary web catalogs, and add the catalog ⊆ plan unit test.
4. Update `writing-story-acts`, `orchestrating-stories`, and both Agent B prompt bodies; run representative manual writer/reviewer checks.
5. Run full repository verification and final scope/diff review.

## Verification

Required automated checks:

```bash
bun run test
bun --filter @aquila/stories typecheck
bun run compile:check
bun run lint
bun run build
```

Also run the audio report against The Seventh Mirror and confirm it covers exactly the five existing bootstrap keys plus the already-authored BGM stop, with no act changes or generated-file drift from report mode.

Run one representative writer prompt and one representative reviewer prompt manually. Do not add an LLM evaluation harness.

## YAGNI / KISS Boundaries

Do not add:

- generated cue TypeScript unions;
- a generic AudioManager/registry/mixer;
- a database, CMS, spreadsheet, or second cue inventory;
- physical Markdown source maps;
- a checked-in/versioned usage report;
- a generic CLI/subcommand framework;
- provider adapters or ElevenLabs fields;
- candidate/approval/generation state;
- audio fields in visual runtime-release schemas;
- volume/fades/adaptive music/voice acting;
- a fourth review agent;
- story-wide Seventh Mirror audio edits;
- an LLM evaluation harness.

## Acceptance Mapping

- Versioned provider-neutral schema/parser: `audio-plan.ts` pure parser + loader.
- Cue existence/type validation: `audio-usage.ts` wired through `compileStory` before emit.
- Audio-free stories unchanged: absent-plan/no-key remains valid.
- Deterministic usage coverage: read-only minimal report command with scene/source/index coordinates.
- Real compiler path: one `mkdtemp` integration test.
- Bootstrap continuity: the five-row Seventh Mirror plan lands with fatal validation.
- Local catalog safety: temporary catalog ⊆ plan test replaces lost cue-union closure.
- Skill agreement: existing writing/orchestration/review skills only; both Agent B modes updated.
- Cue-spam/provider-leak/muted-comprehension guidance: explicit writer/reviewer rules.
- No generated audio/API calls: scope + final diff review.

## Non-Goals

- Full Seventh Mirror audio audit/rewrite
- ElevenLabs calls or candidate selection
- Generated audio binaries
- R2 source/runtime publishing
- Runtime audio-manifest resolution
- Voice acting
- Adaptive music/dynamic mixing
- Generic audio-production tooling
