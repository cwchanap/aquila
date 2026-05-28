# Content Package Consolidation (@aquila/dialogue → @aquila/stories) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the `@aquila/dialogue` package and fold all of its content into `@aquila/stories`, the single framework-agnostic content package, keeping the public API shapes identical so the change is a mechanical rename.

**Architecture:** `@aquila/stories` (currently only raw markdown) becomes a real TypeScript package holding characters, translations, types, flow-types, story loaders, and the existing per-story runtime. All consumers (`@aquila/game`, `apps/web`, `apps/desktop`) repoint their imports from `@aquila/dialogue` to `@aquila/stories`. Phaser stays only in `@aquila/game` + `apps/desktop`; the web app never gains a Phaser dependency.

**Tech Stack:** Bun workspaces, Turbo, TypeScript (project refs / `tsc`), Vitest, Astro (web), Vite (game/desktop).

**Why this is a refactor, not TDD:** No behavior changes — public API shapes are preserved. The safety net is the *existing* test suites + `tsc` typecheck + builds. Each task copies/moves/repoints, then verifies green before committing. Content is briefly duplicated between `@aquila/dialogue` and `@aquila/stories` during Tasks 2–4 (harmless; `@aquila/dialogue` is deleted in Task 5).

**This plan is Plan 1 of 2.** Plan 2 (the markdown→runtime story compiler) builds on the structure created here.

---

## File Structure (created/modified)

**Created (in `@aquila/stories`):**
- `packages/stories/src/**` — copied verbatim from `packages/dialogue/src/**` (index, types, flow-types, characters, translations, stories/trainAdventure runtime, `__tests__`)
- `packages/stories/tsconfig.json`, `packages/stories/vitest.config.ts` — copied from `@aquila/dialogue`
- `packages/stories/raw/trainAdventure/**` — the existing raw markdown, moved out of the package root

**Modified:**
- `packages/stories/package.json` — rewritten as a TS content package
- `packages/game/{package.json, vite.config.ts, src/PreloadScene.ts, src/index.ts, src/SceneFlow.ts, src/dialogue/types.ts, src/characters/CharacterDirectory.ts}`
- `apps/desktop/{package.json, src/lib/i18n.ts}`
- `apps/web/{package.json, tsconfig.json, astro.config.mjs}` + all `src` imports & test mocks referencing `@aquila/dialogue`

**Deleted:**
- `packages/dialogue/**` (entire package, in Task 5)

---

## Task 1: Stand up `@aquila/stories` as a TS content package

**Files:**
- Create: `packages/stories/src/**` (copy of `packages/dialogue/src/**`)
- Create: `packages/stories/tsconfig.json`, `packages/stories/vitest.config.ts`
- Move: `packages/stories/trainAdventure/` → `packages/stories/raw/trainAdventure/`
- Modify: `packages/stories/package.json`

- [ ] **Step 1: Move the raw markdown under `raw/`**

```bash
cd /Users/chanwaichan/workspace/Aquila
mkdir -p packages/stories/raw
git mv packages/stories/trainAdventure packages/stories/raw/trainAdventure
```

- [ ] **Step 2: Copy the dialogue source tree and its configs into stories**

```bash
cp -R packages/dialogue/src packages/stories/src
cp packages/dialogue/tsconfig.json packages/stories/tsconfig.json
cp packages/dialogue/vitest.config.ts packages/stories/vitest.config.ts
```

Verify the copy landed:

```bash
ls packages/stories/src
```

Expected: `__tests__  characters  flow-types.ts  index.ts  stories  translations  types.ts`

- [ ] **Step 3: Rewrite `packages/stories/package.json`**

Replace the entire file contents with:

```json
{
  "name": "@aquila/stories",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./characters": "./src/characters/index.ts",
    "./types": "./src/types.ts",
    "./stories": "./src/stories/index.ts",
    "./translations/en.json": "./src/translations/en.json",
    "./translations/zh.json": "./src/translations/zh.json"
  },
  "scripts": {
    "dev": "tsc --watch",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@vitest/coverage-v8": "^4.0.18",
    "typescript": "^5.3.3",
    "vitest": "^4.0.18"
  }
}
```

- [ ] **Step 4: Link the new workspace package**

```bash
bun install
```

Expected: completes without error; `node_modules/@aquila/stories` is created/symlinked.

- [ ] **Step 5: Verify stories typechecks and its tests pass**

```bash
bun --filter @aquila/stories typecheck
bun --filter @aquila/stories test
```

Expected: `typecheck` exits 0 with no errors; `test` runs the migrated suites (`CharacterDirectory.test.ts`, `stories.test.ts`, `translations.test.ts`) and they PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/stories
git commit -m "feat(stories): stand up @aquila/stories as TS content package (copy of @aquila/dialogue)"
```

---

## Task 2: Repoint `@aquila/game` to `@aquila/stories`

**Files:**
- Modify: `packages/game/package.json:30`
- Modify: `packages/game/vite.config.ts:14`
- Modify: `packages/game/src/PreloadScene.ts:3`, `src/index.ts:17`, `src/SceneFlow.ts:8`, `src/dialogue/types.ts:9`, `src/characters/CharacterDirectory.ts:6`

- [ ] **Step 1: Replace the package specifier across the game package**

```bash
cd /Users/chanwaichan/workspace/Aquila
grep -rl "@aquila/dialogue" packages/game --include="*.ts" --include="*.json" 2>/dev/null \
  | grep -v node_modules | grep -v "/dist/" \
  | xargs sed -i '' 's|@aquila/dialogue|@aquila/stories|g'
```

- [ ] **Step 2: Verify no `@aquila/dialogue` references remain in game**

```bash
grep -rn "@aquila/dialogue" packages/game --include="*.ts" --include="*.json" 2>/dev/null | grep -v node_modules | grep -v "/dist/"
```

Expected: no output (empty).

- [ ] **Step 3: Re-link and verify game typechecks, tests, and builds**

```bash
bun install
bun --filter @aquila/game typecheck
bun --filter @aquila/game test
bun --filter @aquila/game build
```

Expected: all exit 0. (`vite.config.ts` now externalizes `@aquila/stories`; `PreloadScene`, `SceneFlow`, `index.ts`, `dialogue/types.ts`, `characters/CharacterDirectory.ts` import from `@aquila/stories`.)

- [ ] **Step 4: Commit**

```bash
git add packages/game
git commit -m "refactor(game): import content from @aquila/stories instead of @aquila/dialogue"
```

---

## Task 3: Repoint `apps/desktop` to `@aquila/stories`

**Files:**
- Modify: `apps/desktop/package.json:18`
- Modify: `apps/desktop/src/lib/i18n.ts:1-2`

- [ ] **Step 1: Replace the package specifier across desktop**

```bash
cd /Users/chanwaichan/workspace/Aquila
grep -rl "@aquila/dialogue" apps/desktop --include="*.ts" --include="*.json" 2>/dev/null \
  | grep -v node_modules | grep -v "/dist/" \
  | xargs sed -i '' 's|@aquila/dialogue|@aquila/stories|g'
```

This updates the dependency in `package.json` and the two JSON imports in `i18n.ts`
(`@aquila/stories/translations/en.json`, `@aquila/stories/translations/zh.json`).

- [ ] **Step 2: Verify no `@aquila/dialogue` references remain in desktop**

```bash
grep -rn "@aquila/dialogue" apps/desktop --include="*.ts" --include="*.json" 2>/dev/null | grep -v node_modules | grep -v "/dist/"
```

Expected: no output.

- [ ] **Step 3: Re-link and verify desktop typechecks**

```bash
bun install
bun --filter desktop check
```

Expected: `svelte-check` exits with 0 errors (warnings unrelated to this change are acceptable).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop
git commit -m "refactor(desktop): import translations from @aquila/stories"
```

---

## Task 4: Repoint `apps/web` to `@aquila/stories`

**Files:**
- Modify: `apps/web/package.json:25`
- Modify: `apps/web/tsconfig.json` (paths)
- Modify: `apps/web/astro.config.mjs` (vite alias)
- Modify: all `apps/web/src` imports and `vi.mock(...)` calls referencing `@aquila/dialogue`

- [ ] **Step 1: Replace the package specifier across web source, tests, and package.json**

```bash
cd /Users/chanwaichan/workspace/Aquila
grep -rl "@aquila/dialogue" apps/web --include="*.ts" --include="*.svelte" --include="*.astro" --include="*.json" 2>/dev/null \
  | grep -v node_modules | grep -v "/dist/" | grep -v "/.vercel/" \
  | xargs sed -i '' 's|@aquila/dialogue|@aquila/stories|g'
```

This rewrites every import (`getTranslations`, `translations`, `getStoryContent`, `CharacterDirectory`, type imports), every `vi.mock('@aquila/dialogue', ...)` and `vi.mock('@aquila/dialogue/translations/*.json', ...)`, and the `package.json` dependency. The `@aquila/dialogue/*` key in `tsconfig.json` also becomes `@aquila/stories/*` here, but its directory **value** still needs fixing (next step).

- [ ] **Step 2: Fix the directory-path value in `apps/web/tsconfig.json`**

In `apps/web/tsconfig.json`, change the path mapping value:

```jsonc
// before (value still points at the old dir after Step 1):
"@aquila/stories/*": ["../../packages/dialogue/src/*"]
// after:
"@aquila/stories/*": ["../../packages/stories/src/*"]
```

- [ ] **Step 3: Fix the Vite alias value in `apps/web/astro.config.mjs`**

In the `vite.resolve.alias` block, change:

```js
// before (Step 1 already renamed the key to '@aquila/stories'):
'@aquila/stories': path.resolve(
  __dirname,
  '../../packages/dialogue/src'
),
// after:
'@aquila/stories': path.resolve(
  __dirname,
  '../../packages/stories/src'
),
```

- [ ] **Step 4: Verify no `@aquila/dialogue` or stale `packages/dialogue/src` references remain in web**

```bash
grep -rn "@aquila/dialogue\|packages/dialogue/src" apps/web --include="*.ts" --include="*.svelte" --include="*.astro" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v node_modules | grep -v "/dist/" | grep -v "/.vercel/"
```

Expected: no output.

- [ ] **Step 5: Re-link and verify web tests pass and the app builds**

```bash
bun install
bun --filter web test:run
bun --filter web build
```

Expected: `test:run` PASSES all suites (the `vi.mock('@aquila/stories', ...)` mocks resolve via the workspace package); `build` completes (zh-proxy generation + `astro build`) with no module-resolution errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "refactor(web): import content from @aquila/stories and update aliases"
```

---

## Task 5: Delete `@aquila/dialogue` and verify the whole monorepo

**Files:**
- Delete: `packages/dialogue/**`

- [ ] **Step 1: Confirm nothing references `@aquila/dialogue` anymore**

```bash
cd /Users/chanwaichan/workspace/Aquila
grep -rn "@aquila/dialogue\|packages/dialogue" apps packages --include="*.ts" --include="*.svelte" --include="*.astro" --include="*.json" --include="*.mjs" 2>/dev/null | grep -v node_modules | grep -v "/dist/" | grep -v "/.vercel/" | grep -v "packages/dialogue/"
```

Expected: no output. (If anything prints, repoint it before continuing — do not delete the package yet.)

- [ ] **Step 2: Remove the package and re-link**

```bash
git rm -r packages/dialogue
bun install
```

Expected: `bun install` succeeds and removes the `@aquila/dialogue` workspace entry.

- [ ] **Step 3: Full monorepo verification**

```bash
bun run lint
bun run build
bun test
```

Expected: lint passes; Turbo builds every workspace (`@aquila/stories`, `@aquila/game`, `web`, `desktop`) with no unresolved `@aquila/dialogue`; all unit test suites PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove @aquila/dialogue (folded into @aquila/stories)"
```

---

## Self-Review notes (for the executor)

- After Task 5, `packages/stories` is the only content package: `raw/` (markdown source, unused at runtime until Plan 2), `src/` (runtime + characters + translations + types + loaders).
- The per-story TS runtime under `packages/stories/src/stories/trainAdventure/` is still the **old, outdated** content at this point — it is intentionally left as-is so the app keeps working. Plan 2 replaces it with compiler output.
- If `bun --filter desktop check` is unavailable in the environment (no Tauri toolchain), fall back to `bun --filter desktop build` or rely on the Task 5 `bun run build`.
