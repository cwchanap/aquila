# HPA-606 Per-Story Audio Plans and Authoring Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Aquila's temporary global SFX/BGM cue allowlists with one strict per-story `audio-plan.json`, compiler-owned validation and read-only usage coverage, temporary local-catalog safety, and matching story-authoring/review guidance.

**Architecture:** `parseScene` remains syntax-only. A new `audio-plan.ts` owns the provider-neutral authoring contract, while `compiler/audio-usage.ts` owns pure usage collection, plan comparison, and deterministic report shaping; `compileStory` wires those together before output emission and supports `writeOutputs: false` for report mode. Runtime cue fields stay open strings and the two local web catalogs remain tiny fixture maps until HPA-610.

**Tech Stack:** Bun, TypeScript, Zod 3, Vitest, existing Aquila story compiler, web Vitest workspace, Markdown agent skills.

## Global Constraints

- Canonical plan: `packages/stories/raw/<storyName>/docs/audio-plan.json`.
- Schema: strict `schemaVersion: 1`, local `type: 'sfx' | 'bgm'`.
- Keys must pass `isSafeLogicalKey`, match lowercase-hyphenated cue syntax, and may not equal reserved token `stop`.
- SFX requires `prompt` + positive integer `durationMs`; BGM requires those plus `loop: true`.
- `parseScene` gets no filesystem/config/plan state.
- Keyed SFX/BGM with no plan is fatal; audio-free stories may omit the plan.
- Unknown cue/type mismatch is fatal; unused plan entry is a warning.
- `bgm: null` is an explicit stop command, never a plan asset.
- Usage location is `sceneId` + `sourcePath` + zero-based `entryIndex`; no Markdown source maps.
- The five cues already authored on `main` receive plan rows in the same task that makes missing plans fatal.
- Report mode must not emit generated scenes or scaffold choices.
- No generated cue unions, AudioManager/mixer, provider integration, R2 schema/publisher work, fourth review agent, or Seventh Mirror story-wide audio pass.
- Every reviewable task leaves normal tests/compilation green.

---

## File Structure

### Create

- `packages/stories/src/audio-plan.ts` — strict V1 schema, pure parser, thin loader.
- `packages/stories/src/__tests__/audio-plan.test.ts` — schema/parser/loader tests.
- `packages/stories/src/compiler/audio-usage.ts` — usage collection, validation, report shaping.
- `packages/stories/src/compiler/__tests__/audio-usage.test.ts` — pure usage tests.
- `packages/stories/src/compiler/__tests__/compile.test.ts` — real temporary-tree compiler integration.
- `packages/stories/src/compiler/__tests__/cli-report.test.ts` — report CLI smoke.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` — five existing bootstrap definitions.
- `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts` — temporary catalog ⊆ plan invariant.

### Modify

- `packages/stories/src/compiler/parse-scene.ts`
- `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- `packages/stories/src/compiler/compile.ts`
- `packages/stories/src/compiler/cli.ts`
- `packages/stories/src/index.ts`
- `packages/stories/package.json`
- `apps/web/src/lib/audio/sfx-catalog.ts`
- `apps/web/src/lib/audio/bgm-catalog.ts`
- `.agents/skills/writing-story-acts/SKILL.md`
- `.agents/skills/orchestrating-stories/SKILL.md`
- `.agents/skills/reviewing-written-stories/SKILL.md`

### Delete

- `packages/stories/src/audio-cues.ts`

---

### Task 1: Add the per-story audio-plan contract

**Files:**
- Create: `packages/stories/src/audio-plan.ts`
- Create: `packages/stories/src/__tests__/audio-plan.test.ts`
- Modify: `packages/stories/src/index.ts`

**Interfaces:**
- Consumes: `isSafeLogicalKey(value: string): boolean` from `./runtime-assets/paths`, Zod.
- Produces:
  - `AUDIO_PLAN_SCHEMA_VERSION = 1`
  - `AudioAssetType = 'sfx' | 'bgm'`
  - `AudioPlanAsset`
  - `AudioPlanV1`
  - `parseAudioPlan(value: unknown): AudioPlanV1`
  - `loadAudioPlan(rawDir: string): AudioPlanV1 | undefined`

- [ ] **Step 1: Write failing parser tests**

Create `packages/stories/src/__tests__/audio-plan.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseAudioPlan } from '../audio-plan';

const validPlan = {
    schemaVersion: 1,
    assets: [
        {
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening, dry hinge, one-shot',
            durationMs: 2200,
        },
        {
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Restrained cold-dawn mystery underscore, seamless loop',
            durationMs: 90000,
            loop: true,
        },
    ],
};

describe('parseAudioPlan', () => {
    it('parses strict SFX and BGM entries', () => {
        expect(parseAudioPlan(validPlan)).toEqual(validPlan);
    });

    it('accepts non-empty editorial notes', () => {
        expect(parseAudioPlan({
            schemaVersion: 1,
            assets: [{
                key: 'door-open',
                type: 'sfx',
                prompt: 'Door',
                durationMs: 1000,
                notes: 'Reuse for the same apartment door.',
            }],
        }).assets[0]).toMatchObject({ notes: 'Reuse for the same apartment door.' });
    });

    it.each([
        ['wrong version', { ...validPlan, schemaVersion: 2 }],
        ['reserved key', { schemaVersion: 1, assets: [{ key: 'stop', type: 'sfx', prompt: 'x', durationMs: 1 }] }],
        ['unsafe key', { schemaVersion: 1, assets: [{ key: '../door', type: 'sfx', prompt: 'x', durationMs: 1 }] }],
        ['capitalized key', { schemaVersion: 1, assets: [{ key: 'Door-Open', type: 'sfx', prompt: 'x', durationMs: 1 }] }],
        ['zero duration', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: 'x', durationMs: 0 }] }],
        ['fractional duration', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: 'x', durationMs: 1.5 }] }],
        ['empty prompt', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: ' ', durationMs: 1000 }] }],
        ['empty notes', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: 'x', durationMs: 1000, notes: ' ' }] }],
        ['sfx loop field', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: 'x', durationMs: 1000, loop: true }] }],
        ['bgm missing loop', { schemaVersion: 1, assets: [{ key: 'dawn-apartment', type: 'bgm', prompt: 'x', durationMs: 90000 }] }],
        ['provider field', { schemaVersion: 1, assets: [{ key: 'door-open', type: 'sfx', prompt: 'x', durationMs: 1000, provider: 'elevenlabs' }] }],
    ])('rejects %s', (_name, input) => {
        expect(() => parseAudioPlan(input)).toThrow();
    });

    it('rejects a duplicate logical key even across types', () => {
        expect(() => parseAudioPlan({
            schemaVersion: 1,
            assets: [
                { key: 'shared-cue', type: 'sfx', prompt: 'x', durationMs: 1000 },
                { key: 'shared-cue', type: 'bgm', prompt: 'y', durationMs: 90000, loop: true },
            ],
        })).toThrow(/duplicate/i);
    });
});
```

- [ ] **Step 2: Verify the parser tests fail**

```bash
bun --filter @aquila/stories test -- src/__tests__/audio-plan.test.ts
```

Expected: FAIL because `../audio-plan` does not exist.

- [ ] **Step 3: Implement the strict schema and pure parser**

Create `packages/stories/src/audio-plan.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { isSafeLogicalKey } from './runtime-assets/paths';

export const AUDIO_PLAN_SCHEMA_VERSION = 1 as const;

export const AudioAssetTypeSchema = z.enum(['sfx', 'bgm']);
export type AudioAssetType = z.infer<typeof AudioAssetTypeSchema>;

const CueKeySchema = z
    .string()
    .refine(isSafeLogicalKey, 'Audio cue key must be repository-safe')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Audio cue key must be a lowercase hyphenated slug')
    .refine(key => key !== 'stop', 'Audio cue key "stop" is reserved');

const commonAssetShape = {
    key: CueKeySchema,
    prompt: z.string().trim().min(1),
    durationMs: z.number().int().positive(),
    notes: z.string().trim().min(1).optional(),
};

const SfxPlanAssetSchema = z.object({
    ...commonAssetShape,
    type: z.literal('sfx'),
}).strict();

const BgmPlanAssetSchema = z.object({
    ...commonAssetShape,
    type: z.literal('bgm'),
    loop: z.literal(true),
}).strict();

export const AudioPlanAssetSchema = z.discriminatedUnion('type', [
    SfxPlanAssetSchema,
    BgmPlanAssetSchema,
]);
export type AudioPlanAsset = z.infer<typeof AudioPlanAssetSchema>;

export const AudioPlanV1Schema = z.object({
    schemaVersion: z.literal(AUDIO_PLAN_SCHEMA_VERSION),
    assets: z.array(AudioPlanAssetSchema),
}).strict().superRefine((plan, context) => {
    const seen = new Set<string>();
    plan.assets.forEach((asset, index) => {
        if (seen.has(asset.key)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['assets', index, 'key'],
                message: `Duplicate audio cue key: ${asset.key}`,
            });
        }
        seen.add(asset.key);
    });
});

export type AudioPlanV1 = z.infer<typeof AudioPlanV1Schema>;

export function parseAudioPlan(value: unknown): AudioPlanV1 {
    return AudioPlanV1Schema.parse(value);
}

export function loadAudioPlan(rawDir: string): AudioPlanV1 | undefined {
    const planPath = join(rawDir, 'docs', 'audio-plan.json');
    if (!existsSync(planPath)) return undefined;

    let value: unknown;
    try {
        value = JSON.parse(readFileSync(planPath, 'utf8'));
    } catch (error) {
        throw new Error(`[story-compiler] ${planPath}: invalid audio-plan JSON`, { cause: error });
    }

    try {
        return parseAudioPlan(value);
    } catch (error) {
        throw new Error(`[story-compiler] ${planPath}: invalid audio plan`, { cause: error });
    }
}
```

Do not reuse or widen visual `AssetTypeSchema` / `LogicalAssetIdentitySchema`.

- [ ] **Step 4: Add loader tests**

In the same test file, create temporary directories with `mkdtempSync(join(tmpdir(), 'aquila-audio-plan-'))` and clean them with `rmSync(..., { recursive: true, force: true })` in `finally` blocks. Test:

- absent file => `undefined`;
- valid `docs/audio-plan.json` => parsed plan;
- malformed JSON => throws and message contains `audio-plan.json`;
- schema-invalid JSON => throws and message contains `audio-plan.json`.

- [ ] **Step 5: Export the new API without removing bootstrap exports yet**

Add to `packages/stories/src/index.ts`:

```ts
export {
    AUDIO_PLAN_SCHEMA_VERSION,
    AudioAssetTypeSchema,
    AudioPlanAssetSchema,
    AudioPlanV1Schema,
    loadAudioPlan,
    parseAudioPlan,
} from './audio-plan';
export type { AudioAssetType, AudioPlanAsset, AudioPlanV1 } from './audio-plan';
```

- [ ] **Step 6: Run Task 1 verification**

```bash
bun --filter @aquila/stories test -- src/__tests__/audio-plan.test.ts
bun --filter @aquila/stories typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add packages/stories/src/audio-plan.ts \
        packages/stories/src/__tests__/audio-plan.test.ts \
        packages/stories/src/index.ts
git commit -m "feat: add per-story audio plan contract"
```

---

### Task 2: Deliver plan-backed compiler validation as one green vertical slice

**Files:**
- Create: `packages/stories/src/compiler/audio-usage.ts`
- Create: `packages/stories/src/compiler/__tests__/audio-usage.test.ts`
- Create: `packages/stories/src/compiler/__tests__/compile.test.ts`
- Create: `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- Modify: `packages/stories/src/compiler/parse-scene.ts`
- Modify: `packages/stories/src/compiler/__tests__/parse-scene.test.ts`
- Modify: `packages/stories/src/compiler/compile.ts`

**Interfaces:**
- Consumes: `AudioAssetType`, `AudioPlanV1`, `loadAudioPlan`, `StoryIR`, `compareQualifiedAssetIds`.
- Produces:
  - `AudioUsageLocation`
  - `AudioCueUsage`
  - `CollectedAudioUsage`
  - `collectAudioUsage(story: StoryIR): CollectedAudioUsage`
  - `validateAudioUsage(usage: CollectedAudioUsage, plan: AudioPlanV1 | undefined, planDisplayPath: string): string[]`
  - `CompileOptions.writeOutputs?: boolean`

- [ ] **Step 1: Write failing pure usage tests**

Create `packages/stories/src/compiler/__tests__/audio-usage.test.ts`. Use this two-scene `StoryIR` core:

```ts
const story: StoryIR = {
    storyId: 'fixture_story',
    name: 'fixtureStory',
    start: 'act1',
    choices: [],
    assetManifest: { storyId: 'fixture_story', backgrounds: [], portraits: [] },
    scenes: [
        {
            id: 'act1', title: 'Act 1', sourcePath: 'act1.md', next: 'act2',
            entries: [
                { characterId: 'narrator', displayName: '旁白', dialogue: 'Door', sfx: 'door-open' },
                { characterId: 'narrator', displayName: '旁白', dialogue: 'Dawn', bgm: 'dawn-apartment' },
            ],
        },
        {
            id: 'act2', title: 'Act 2', sourcePath: 'act2.md', next: null,
            entries: [
                { characterId: 'narrator', displayName: '旁白', dialogue: 'Door again', sfx: 'door-open' },
                { characterId: 'narrator', displayName: '旁白', dialogue: 'Quiet', bgm: null },
            ],
        },
    ],
};
```

Assert collection yields three keyed cues in story order and one stop. Add validation tests for absent plan/no audio, absent plan/keyed audio, unknown key, both type-mismatch directions, explicit stop, and deterministic unused warnings.

- [ ] **Step 2: Verify the tests fail**

```bash
bun --filter @aquila/stories test -- src/compiler/__tests__/audio-usage.test.ts
```

Expected: FAIL because `audio-usage.ts` does not exist.

- [ ] **Step 3: Implement pure usage collection and validation**

Create `packages/stories/src/compiler/audio-usage.ts` with the correct compiler-relative imports:

```ts
import type { AudioAssetType, AudioPlanV1 } from '../audio-plan';
import { compareQualifiedAssetIds } from '../runtime-assets/paths';
import type { StoryIR } from './ir';

export interface AudioUsageLocation {
    sceneId: string;
    sourcePath: string;
    entryIndex: number;
}

export interface AudioCueUsage extends AudioUsageLocation {
    type: AudioAssetType;
    key: string;
}

export interface CollectedAudioUsage {
    cues: AudioCueUsage[];
    bgmStops: AudioUsageLocation[];
}

function qualified(type: AudioAssetType, key: string): string {
    return `${type}:${key.normalize('NFC')}`;
}

export function collectAudioUsage(story: StoryIR): CollectedAudioUsage {
    const cues: AudioCueUsage[] = [];
    const bgmStops: AudioUsageLocation[] = [];

    for (const scene of story.scenes) {
        scene.entries.forEach((entry, entryIndex) => {
            const location = { sceneId: scene.id, sourcePath: scene.sourcePath, entryIndex };
            if (entry.sfx !== undefined) {
                cues.push({ ...location, type: 'sfx', key: entry.sfx });
            }
            if (entry.bgm === null) {
                bgmStops.push(location);
            } else if (entry.bgm !== undefined) {
                cues.push({ ...location, type: 'bgm', key: entry.bgm });
            }
        });
    }
    return { cues, bgmStops };
}

export function validateAudioUsage(
    usage: CollectedAudioUsage,
    plan: AudioPlanV1 | undefined,
    planDisplayPath: string
): string[] {
    if (!plan) {
        const first = usage.cues[0];
        if (!first) return [];
        throw new Error(
            `[story-compiler] ${first.sourcePath}#${first.entryIndex}: audio cue "${first.key}" requires ${planDisplayPath}`
        );
    }

    const byKey = new Map(plan.assets.map(asset => [asset.key, asset]));
    const usedKeys = new Set<string>();
    for (const cue of usage.cues) {
        const asset = byKey.get(cue.key);
        if (!asset) {
            throw new Error(
                `[story-compiler] ${cue.sourcePath}#${cue.entryIndex}: unknown audio cue "${cue.key}"`
            );
        }
        if (asset.type !== cue.type) {
            throw new Error(
                `[story-compiler] ${cue.sourcePath}#${cue.entryIndex}: audio cue "${cue.key}" type mismatch; authored as ${cue.type}, planned as ${asset.type}`
            );
        }
        usedKeys.add(cue.key);
    }

    return plan.assets
        .filter(asset => !usedKeys.has(asset.key))
        .sort((left, right) =>
            compareQualifiedAssetIds(
                qualified(left.type, left.key),
                qualified(right.type, right.key)
            )
        )
        .map(asset => `[story-compiler] unused audio-plan entry ${asset.type}:${asset.key}`);
}
```

- [ ] **Step 4: Move unknown-key membership out of parser tests**

In `parse-scene.test.ts`, replace syntactically valid unknown-key failures with:

```ts
it('accepts an unknown but syntactically valid SFX key', () => {
    const result = parseScene(
        ['```sfx', 'new-door-cue', '```', '', '**旁白**：Door.'].join('\n'),
        resolve,
        'fixture.md'
    );
    expect(result.entries[0].sfx).toBe('new-door-cue');
});

it('accepts an unknown but syntactically valid BGM key', () => {
    const result = parseScene(
        ['```bgm', 'new-music-cue', '```', '', '**旁白**：Music.'].join('\n'),
        resolve,
        'fixture.md'
    );
    expect(result.entries[0].bgm).toBe('new-music-cue');
});
```

Retain malformed syntax, duplicate-pending, combined metadata, stop, and EOF-pending tests.

- [ ] **Step 5: Make `parse-scene.ts` syntax-only**

Remove the `audio-cues` import and the `isSfxCueKey` / `isBgmCueKey` branches. For syntactically matched SFX use:

```ts
pendingSfx = sfxMatch[1];
```

For BGM keep `stop -> null`; otherwise:

```ts
pendingBgm = token;
```

Do not change either block regex or pending consumption semantics.

- [ ] **Step 6: Add the bootstrap plan before fatal plan validation is enabled**

Create `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` exactly:

```json
{
  "schemaVersion": 1,
  "assets": [
    {
      "key": "dawn-apartment",
      "type": "bgm",
      "prompt": "Instrumental psychological mystery underscore for a cold Tokyo dawn, restrained piano and soft synth texture, seamless loop",
      "durationMs": 90000,
      "loop": true
    },
    {
      "key": "tension-pulse",
      "type": "bgm",
      "prompt": "Instrumental restrained investigation tension pulse, low synth texture and subtle percussion, seamless loop without a dramatic climax",
      "durationMs": 90000,
      "loop": true
    },
    {
      "key": "door-open",
      "type": "sfx",
      "prompt": "Heavy old Japanese apartment door opening with a dry hinge creak, close perspective, one-shot",
      "durationMs": 2200
    },
    {
      "key": "impact",
      "type": "sfx",
      "prompt": "Muted body-weight impact on an apartment floor, close dry interior perspective, one-shot",
      "durationMs": 900
    },
    {
      "key": "notification-beep",
      "type": "sfx",
      "prompt": "Short modern smartphone alert beep, clean close perspective, one-shot",
      "durationMs": 900
    }
  ]
}
```

Do not edit act Markdown.

- [ ] **Step 7: Write real `compileStory` integration tests using `mkdtempSync`**

Create `packages/stories/src/compiler/__tests__/compile.test.ts`. Each fixture gets:

```text
docs/characters.md
docs/audio-plan.json
act1.md
```

Characters content:

```md
## 1. 旁白（Narrator）

- **ID**: `narrator`
```

Valid act:

````md
# 第一幕：Fixture

```sfx
door-open
```

**旁白**：Door.

```bgm
dawn-apartment
```

**旁白**：Music.

```bgm
stop
```

**旁白**：Quiet.
````

Config:

```ts
const config: StoryCompilerConfig = {
    storyId: 'fixture_story',
    defaultSpeakerId: 'narrator',
};
```

Test three paths:

1. valid plan-backed SFX/BGM emits the generated scene;
2. changing `door-open` to `unknown-door` throws `/unknown audio cue/` before `outDir` or `choicesPath` is created;
3. valid input with `writeOutputs: false` returns the `StoryIR` with cues but creates neither output path.

- [ ] **Step 8: Wire plan validation into `compileStory` before output**

Add to `CompileOptions`:

```ts
writeOutputs?: boolean;
```

After assembling `story`:

```ts
const audioPlan = loadAudioPlan(opts.rawDir);
const audioUsage = collectAudioUsage(story);
const warnings = [
    ...validateAudioUsage(audioUsage, audioPlan, 'docs/audio-plan.json'),
    ...validateStory(story, portraitMap),
];
for (const warning of warnings) console.warn(warning);

if (opts.writeOutputs !== false) {
    emitStory(story, opts.outDir, charDir);
    scaffoldChoices(story, opts.choicesPath);
}
return story;
```

Import `loadAudioPlan` from `../audio-plan` and `collectAudioUsage` / `validateAudioUsage` from `./audio-usage`. Remove the previous standalone story-warning loop.

- [ ] **Step 9: Verify the whole vertical slice**

```bash
bun --filter @aquila/stories test -- \
  src/__tests__/audio-plan.test.ts \
  src/compiler/__tests__/audio-usage.test.ts \
  src/compiler/__tests__/parse-scene.test.ts \
  src/compiler/__tests__/compile.test.ts
bun --filter @aquila/stories typecheck
bun run compile:check
```

Expected: PASS. Task 2 is not complete if `compile:check` is broken.

- [ ] **Step 10: Commit Task 2 atomically**

```bash
git add packages/stories/src/compiler/audio-usage.ts \
        packages/stories/src/compiler/__tests__/audio-usage.test.ts \
        packages/stories/src/compiler/__tests__/compile.test.ts \
        packages/stories/src/compiler/parse-scene.ts \
        packages/stories/src/compiler/__tests__/parse-scene.test.ts \
        packages/stories/src/compiler/compile.ts \
        packages/stories/raw/theSeventhMirror/docs/audio-plan.json
git commit -m "feat: validate story audio cues from plans"
```

---

### Task 3: Add deterministic read-only cue coverage

**Files:**
- Modify: `packages/stories/src/compiler/audio-usage.ts`
- Modify: `packages/stories/src/compiler/__tests__/audio-usage.test.ts`
- Modify: `packages/stories/src/compiler/cli.ts`
- Create: `packages/stories/src/compiler/__tests__/cli-report.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Produces:
  - `AudioUsageReportAsset`
  - `AudioUsageReport`
  - `buildAudioUsageReport(storyName: string, usage: CollectedAudioUsage, plan: AudioPlanV1 | undefined): AudioUsageReport`
  - `bun src/compiler/cli.ts --report <storyName>`
  - `bun --filter @aquila/stories audio:report <storyName>`

- [ ] **Step 1: Write failing deterministic report tests**

Extend `audio-usage.test.ts` and assert aggregation/deduplication produces:

```ts
{
    story: 'fixtureStory',
    assets: [
        {
            type: 'bgm',
            key: 'dawn-apartment',
            usageCount: 1,
            usages: [{ sceneId: 'act1', sourcePath: 'act1.md', entryIndex: 1 }],
        },
        {
            type: 'sfx',
            key: 'door-open',
            usageCount: 2,
            usages: [
                { sceneId: 'act1', sourcePath: 'act1.md', entryIndex: 0 },
                { sceneId: 'act2', sourcePath: 'act2.md', entryIndex: 0 },
            ],
        },
    ],
    bgmStops: [{ sceneId: 'act2', sourcePath: 'act2.md', entryIndex: 1 }],
    unused: [{ type: 'sfx', key: 'unused-cue' }],
}
```

- [ ] **Step 2: Implement report shaping in `audio-usage.ts`**

Add:

```ts
export interface AudioUsageReportAsset {
    type: AudioAssetType;
    key: string;
    usageCount: number;
    usages: AudioUsageLocation[];
}

export interface AudioUsageReport {
    story: string;
    assets: AudioUsageReportAsset[];
    bgmStops: AudioUsageLocation[];
    unused: Array<{ type: AudioAssetType; key: string }>;
}
```

Implement `buildAudioUsageReport` by grouping `usage.cues` on `qualified(type, key)`, preserving insertion order in each `usages` array, sorting aggregate assets and unused entries with `compareQualifiedAssetIds`, and returning a copy of `usage.bgmStops`. No timestamps or absolute paths.

- [ ] **Step 3: Verify pure report tests pass**

```bash
bun --filter @aquila/stories test -- src/compiler/__tests__/audio-usage.test.ts
```

Expected: PASS.

- [ ] **Step 4: Add one named-story helper to `cli.ts`**

Add:

```ts
async function compileNamedStory(
    name: string,
    writeOutputs: boolean
): Promise<StoryIR> {
    const rawDir = join(rawRoot, name);
    const configPath = join(rawDir, 'compiler.config.ts');
    if (!existsSync(configPath)) {
        throw new Error(`[story-compiler] unknown story "${name}"`);
    }
    const configMod = await import(configPath);
    const config: StoryCompilerConfig = configMod.default;
    return compileStory({
        rawDir,
        name,
        outDir: join(srcDir, 'generated', name),
        choicesPath: join(srcDir, 'stories', name, 'choices.zh.ts'),
        config,
        writeOutputs,
    });
}
```

Normal no-argument compilation still discovers all configured raw stories and calls this helper with `true`.

- [ ] **Step 5: Add only the `--report <storyName>` argument branch**

At the start of `main()`:

```ts
const args = process.argv.slice(2);
if (args[0] === '--report') {
    if (args.length !== 2 || !args[1]) {
        throw new Error('[story-compiler] usage: --report <storyName>');
    }
    const name = args[1];
    const rawDir = join(rawRoot, name);
    const story = await compileNamedStory(name, false);
    const report = buildAudioUsageReport(
        name,
        collectAudioUsage(story),
        loadAudioPlan(rawDir)
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
}
if (args.length > 0) {
    throw new Error(`[story-compiler] unknown arguments: ${args.join(' ')}`);
}
```

Import `StoryIR`, `loadAudioPlan`, `buildAudioUsageReport`, and `collectAudioUsage`. Do not add an argument library/router. Do not print the normal story summary in report mode; warnings remain on stderr.

- [ ] **Step 6: Add the package script**

In `packages/stories/package.json`:

```json
"audio:report": "bun src/compiler/cli.ts --report"
```

- [ ] **Step 7: Add a real report CLI smoke test**

Create `cli-report.test.ts`. Resolve the stories package root with `dirname(fileURLToPath(import.meta.url))`, run:

```ts
execFileSync(
    process.execPath,
    ['src/compiler/cli.ts', '--report', 'theSeventhMirror'],
    { cwd: packageRoot, encoding: 'utf8' }
);
```

Parse stdout and assert exact IDs:

```ts
[
    'bgm:dawn-apartment',
    'bgm:tension-pulse',
    'sfx:door-open',
    'sfx:impact',
    'sfx:notification-beep',
]
```

Also assert one BGM stop, no unused bootstrap entries, and failure for a missing story name. The `compile.test.ts` `writeOutputs: false` case is the direct no-output-write proof.

- [ ] **Step 8: Verify report mode is deterministic and read-only**

```bash
bun --filter @aquila/stories test -- \
  src/compiler/__tests__/audio-usage.test.ts \
  src/compiler/__tests__/compile.test.ts \
  src/compiler/__tests__/cli-report.test.ts
bun --filter @aquila/stories audio:report theSeventhMirror > /tmp/hpa-606-audio-report.json
bun -e 'const r=JSON.parse(await Bun.file("/tmp/hpa-606-audio-report.json").text()); if (r.assets.length !== 5 || r.bgmStops.length !== 1 || r.unused.length !== 0) process.exit(1)'
git diff --exit-code -- packages/stories/src/generated packages/stories/src/stories
```

Expected: PASS and no generated/choice drift.

- [ ] **Step 9: Commit Task 3**

```bash
git add packages/stories/src/compiler/audio-usage.ts \
        packages/stories/src/compiler/__tests__/audio-usage.test.ts \
        packages/stories/src/compiler/cli.ts \
        packages/stories/src/compiler/__tests__/cli-report.test.ts \
        packages/stories/package.json
git commit -m "feat: add read-only audio usage report"
```

---

### Task 4: Remove bootstrap cue unions while retaining catalog safety

**Files:**
- Delete: `packages/stories/src/audio-cues.ts`
- Modify: `packages/stories/src/index.ts`
- Modify: `apps/web/src/lib/audio/sfx-catalog.ts`
- Modify: `apps/web/src/lib/audio/bgm-catalog.ts`
- Create: `apps/web/src/lib/__tests__/audio-catalog-plan.test.ts`

- [ ] **Step 1: Add the replacement catalog invariant before deleting union types**

Create:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAudioPlan } from '@aquila/stories';
import { LOCAL_BGM_CATALOG } from '@/lib/audio/bgm-catalog';
import { LOCAL_SFX_CATALOG } from '@/lib/audio/sfx-catalog';

const planPath = resolve(
    process.cwd(),
    '../../packages/stories/raw/theSeventhMirror/docs/audio-plan.json'
);
const plan = parseAudioPlan(JSON.parse(readFileSync(planPath, 'utf8')));
const plannedTypeByKey = new Map(
    plan.assets.map(asset => [asset.key, asset.type] as const)
);
const localEntries = [
    ...Object.keys(LOCAL_SFX_CATALOG).map(key => ({ type: 'sfx' as const, key })),
    ...Object.keys(LOCAL_BGM_CATALOG).map(key => ({ type: 'bgm' as const, key })),
];

describe('local audio catalogs', () => {
    it.each(localEntries)('$type:$key is present in the story audio plan', entry => {
        expect(plannedTypeByKey.get(entry.key)).toBe(entry.type);
    });
});
```

Run it before retyping catalogs:

```bash
bun --filter web test -- src/lib/__tests__/audio-catalog-plan.test.ts
```

Expected: PASS.

- [ ] **Step 2: Retype both catalogs as tiny `as const` fixture maps**

`sfx-catalog.ts`:

```ts
export const LOCAL_SFX_CATALOG = {
    'door-open': '/assets/vn/audio/sfx/door-open.wav',
    'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
    impact: '/assets/vn/audio/sfx/impact.wav',
} as const;
```

`bgm-catalog.ts`:

```ts
export const LOCAL_BGM_CATALOG = {
    'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
    'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} as const;
```

Keep `resolveLocalSfxUrl(string)` and `resolveLocalBgmUrl(string)` behavior unchanged.

- [ ] **Step 3: Delete bootstrap cue exports and file**

Remove `SFX_CUE_KEYS`, `BGM_CUE_KEYS`, both type guards, and `SfxCueKey`/`BgmCueKey` from `packages/stories/src/index.ts`. Keep Task 1 audio-plan exports. Delete `packages/stories/src/audio-cues.ts`.

- [ ] **Step 4: Verify both workspaces**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter web test -- src/lib/__tests__/audio-catalog-plan.test.ts
bun run compile:check
```

Expected: PASS; any stale cue-union import fails here.

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/stories/src/index.ts \
        apps/web/src/lib/audio/sfx-catalog.ts \
        apps/web/src/lib/audio/bgm-catalog.ts \
        apps/web/src/lib/__tests__/audio-catalog-plan.test.ts
git rm packages/stories/src/audio-cues.ts
git commit -m "refactor: remove bootstrap audio cue unions"
```

---

### Task 5: Align existing story skills with the audio plan

**Files:**
- Modify: `.agents/skills/writing-story-acts/SKILL.md`
- Modify: `.agents/skills/orchestrating-stories/SKILL.md`
- Modify: `.agents/skills/reviewing-written-stories/SKILL.md`

- [ ] **Step 1: Make writers read the plan when audio is in scope**

Add to `writing-story-acts` Step 1:

```md
**`packages/stories/raw/<storyName>/docs/audio-plan.json` when it exists or audio direction is in scope** — reuse its exact cue keys. If a needed cue is not defined there, flag it to the orchestrator instead of inventing an alias.
```

- [ ] **Step 2: Add concise writer syntax/rules**

Add one audio subsection containing these exact examples:

````md
```sfx
door-open
```

```bgm
dawn-apartment
```

```bgm
stop
```
````

Rules must say:

- reuse exact plan keys;
- no URLs/files/provider/model/prompts/durations/candidate metadata in acts;
- selective SFX, not sentence-by-sentence Foley;
- BGM only at sustained state/location/mood changes;
- silence/explicit stop is valid;
- recurring identities stay consistent;
- plot-essential information remains understandable when muted;
- undefined needed cue is escalated to orchestrator.

Do not duplicate the JSON schema.

- [ ] **Step 3: Make the orchestrator own plan changes and coverage**

Add to `orchestrating-stories`:

```md
When audio is in scope, the orchestrator owns `raw/<storyName>/docs/audio-plan.json`; writing subagents reuse approved keys and do not edit provider details.
```

Add the plan path + relevant approved palette to writing-subagent dispatch requirements. After normal compilation, document:

```bash
bun --filter @aquila/stories audio:report <storyName>
```

Review unused warnings/coverage; do not create a spreadsheet or second cue inventory.

- [ ] **Step 4: Add optional audio continuity to chapter-level Agent B**

Insert:

```md
### Optional audio continuity

If `docs/audio-plan.json` exists or reviewed acts contain `sfx` / `bgm` blocks, also check:
1. repeated objects, locations, and motifs reuse the same logical cue identities;
2. BGM changes follow sustained story state rather than arbitrary act boundaries;
3. cue timing does not spoil reveals or escalate mood prematurely;
4. SFX density is selective rather than mechanical Foley;
5. intentional silence / explicit `bgm stop` is preserved;
6. provider names, URLs, filenames, prompts, and generation syntax do not leak into act Markdown;
7. plot-essential information is not audio-only.

Use the same HIGH / MEDIUM / LOW severity vocabulary and existing act-organized output. Do not create a separate audio ledger.
```

- [ ] **Step 5: Add the identical block to per-act Agent B**

Place it in the second Agent B prompt body. Do not add Agent D or move these checks into character/style reviewers.

- [ ] **Step 6: Run representative manual skill checks**

Writer prompt:

```text
Using writing-story-acts, draft a short fixture continuation for a story whose audio plan contains only door-open (sfx) and dawn-apartment (bgm). Include one meaningful door action and a sustained dawn mood. Do not modify the audio plan.
```

Pass: reuses defined keys, avoids provider metadata/cue spam, and flags any requested undefined cue.

Reviewer prompt:

```text
Using reviewing-written-stories Agent B, review two fixture acts where act 1 uses door-open, act 2 invents old-door-creak for the same door, and required plot information appears only in an audio direction.
```

Pass: flags identity drift and audio-only comprehension using existing severity/output; no fourth agent.

Do not add an automated LLM evaluation harness.

- [ ] **Step 7: Commit Task 5**

```bash
git add .agents/skills/writing-story-acts/SKILL.md \
        .agents/skills/orchestrating-stories/SKILL.md \
        .agents/skills/reviewing-written-stories/SKILL.md
git commit -m "docs: align story skills with audio plans"
```

---

### Task 6: Full verification and scope gate

**Files:** verify only.

- [ ] **Step 1: Run all tests**

```bash
bun run test
```

Expected: PASS across Turbo workspaces.

- [ ] **Step 2: Run stories typecheck**

```bash
bun --filter @aquila/stories typecheck
```

Expected: PASS and no deleted cue-type references.

- [ ] **Step 3: Verify generated content**

```bash
bun run compile:check
```

Expected: PASS.

- [ ] **Step 4: Run lint and build**

```bash
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 5: Verify exact bootstrap coverage and read-only behavior**

```bash
bun --filter @aquila/stories audio:report theSeventhMirror > /tmp/hpa-606-audio-report.json
bun -e '
const r = JSON.parse(await Bun.file("/tmp/hpa-606-audio-report.json").text());
const ids = r.assets.map((a: { type: string; key: string }) => `${a.type}:${a.key}`);
const expected = [
  "bgm:dawn-apartment",
  "bgm:tension-pulse",
  "sfx:door-open",
  "sfx:impact",
  "sfx:notification-beep",
];
if (JSON.stringify(ids) !== JSON.stringify(expected)) process.exit(1);
if (r.bgmStops.length !== 1 || r.unused.length !== 0) process.exit(1);
'
git diff --exit-code -- packages/stories/src/generated packages/stories/src/stories
```

Expected: exact five bootstrap assets, one authored stop, zero unused entries, zero report-mode output drift.

- [ ] **Step 6: Scope review**

```bash
git diff --name-only main...HEAD
```

Allowed implementation scope:

- story plan/parser/usage/compiler/tests;
- one Seventh Mirror bootstrap plan;
- temporary local catalog typing + invariant test;
- three existing story skills;
- approved design/plan docs.

Reject generated audio binaries, ElevenLabs calls/adapters, R2 audio publishing/runtime manifests, AudioManager/mixer, generated cue unions, new review agents, or story-wide audio cue rewrites.

- [ ] **Step 7: Handle verification defects without an empty commit**

If Steps 1-6 expose a defect, fix it in the Task 1-5 file that owns the behavior, rerun that task's focused tests plus Steps 1-6, and commit the concrete fix. If all checks pass without changes, make no verification-only commit.

---

## Execution Notes

- Task 2 is atomic: parser membership removal, fatal compiler validation, and the five-row bootstrap plan must not be separated into reviewable commits.
- Task 3 is independently reviewable because read-only reporting does not change normal compile behavior.
- Task 4 enforces only `catalog ⊆ plan`; HPA-607 may add planned cues before HPA-608 makes audio available.
- HPA-607 expands/refines the story palette.
- HPA-608 owns ElevenLabs request mapping, candidates, resumption, and cost controls.
- HPA-609 owns audio runtime release identities, manifests, R2 publication, activation, and rollback.
