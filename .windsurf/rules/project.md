---
trigger: always_on
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Development

- `bun dev` - Start web app (port 5090), desktop app via Turbo
- `bun dev:web` - Start Astro web app only on port 5090
- `bun dev:db` - Instructions for starting CockroachDB locally (port 26257 insecure mode, HTTP on 8080)

### Database Operations

- `bun drizzle:generate` - Generate SQL migrations from the Drizzle schema
- `bun drizzle:migrate` - Run Drizzle migrations (guards against CockroachDB URLs)
- `bun drizzle:migrate:allow-cockroach` - Opt-in CockroachDB migration once staging is verified (requires `ALLOW_COCKROACH_MIGRATIONS=true`)
- `bun drizzle:studio` - Open Drizzle Studio GUI (web app only)
- **Reminder:** Drizzle's CockroachDB dialect is pre-release. Only set `ALLOW_COCKROACH_MIGRATIONS=true` after validating migrations in staging. Prefer managed PostgreSQL when in doubt.

### Testing

- `bun test` - Run all tests (Turbo runs unit + E2E across workspaces)
- `bun test:e2e` - Run Playwright E2E tests (web app)
- `bun test:headed` - Run E2E tests in headed mode (visible browser)
- `bun test:debug` - Run E2E tests in debug mode
- `bun test:report` - Show Playwright test report
- `bun --filter web test` - Run Vitest unit tests (web app only)
- `bun test:watch` - Run Vitest unit tests in watch mode (web app only)

### Build and Lint

- `bun build` - Build all workspaces for production (via Turbo)
- `bun preview` - Preview production build (web app)
- `bun lint` - Run ESLint across all workspaces (via Turbo)
- `bun lint:fix` - Fix ESLint issues automatically

## Architecture Overview

Aquila is a **monorepo** using Turbo and Bun workspaces containing:

### Workspaces

- **`apps/web`**: Astro web application with SSR, deployed to Vercel
- **`apps/desktop`**: Desktop application (Electron/Tauri)
- **`packages/game`**: Phaser 3 game engine logic (`@aquila/game`)
- **`packages/dialogue`**: Standalone dialogue content and character system (`@aquila/dialogue`)
- **`packages/assets`**: Shared game assets

### Technology Layers

- **Web UI Layer**: Astro SSR with Svelte components for interactivity
- **Game Engine Layer**: Phaser 3 (separated into `@aquila/game` package)
- **Dialogue System**: Content-as-data architecture in `@aquila/dialogue` package
- **Database Layer**: Drizzle ORM targeting PostgreSQL-compatible databases
- **Deployment**: Vercel serverless (web) with SSR support

## Key Patterns

### Database Development

- **Schema Changes**: Update `apps/web/src/lib/drizzle/schema.ts`, then run `bun drizzle:generate`
- **Repository Pattern**: Use repository class methods from `drizzle/repositories.ts`, not direct SQL
- **Environment Variables**: Ensure `DATABASE_URL` is set for local dev, CI, and production
- **Optional Tuning**: `DB_ALLOW_SELF_SIGNED=true` for non-production self-signed certs, `DB_POOL_MAX` for connection pool size (defaults to 10)
- **Authentication**: Better Auth uses PostgreSQL via Drizzle, configured in `apps/web/src/lib/auth.ts`

### Game Development

- **Package Structure**:
  - Game logic lives in `packages/game/src/` as `@aquila/game` workspace package
  - Dialogue content lives in `packages/dialogue/src/` as `@aquila/dialogue` workspace package
  - Web app imports both: `import { BaseScene } from '@aquila/game'`
- **Scene Architecture**:
  - All scenes extend `BaseScene` (from `@aquila/game`)
  - `StoryScene` extends `BaseScene` and adds checkpoint/save functionality, choice system, progress map
  - Scenes use section-based navigation via `SceneDirectory` and `sectionKey`
  - Dialogue UI automatically created with Enter/Backspace navigation
- **Character System**:
  - Characters defined in `packages/dialogue/src/characters/CharacterId.ts` with unique IDs
  - `CharacterDirectory` provides lookup by ID and name (supports both real names and legacy aliases)
  - Player name substitution built into `BaseScene.showDialogue()`
- **Dialogue Content**:
  - Store in `packages/dialogue/src/stories/[storyName]/` as TypeScript objects
  - Use `DialogueMap` type: `{ [sceneId: string]: DialogueEntry[] }`
  - Support for multi-language via locale-specific files organized by story (e.g., `trainAdventure/en.ts`, `trainAdventure/zh.ts`)
  - Access via helper functions like `getTrainAdventureStory(locale)`
- **Integration**: Astro pages initialize Phaser scenes with `game.scene.start()` and pass data via registry

### Component Architecture

- **Astro Components** (`.astro`): Minimal server-rendered templates - extract logic to TypeScript modules
- **TypeScript Logic Modules**: Complex behavior lives in `apps/web/src/lib/` as manager/controller classes
- **Svelte Components** (`.svelte`): Interactive UI elements requiring `client:load` directive in Astro
- **Button Variants**: Use `Button.svelte` with `variant="menu"` for glassmorphism game UI
- **Path Aliases**: `@/` maps to `apps/web/src/` within web app workspace
- **Manager Pattern**: Create manager classes (e.g., `ReaderManager`) in `apps/web/src/lib/` to handle business logic, state management, and DOM manipulation separately from Astro pages

### Astro Page Best Practices

- **Keep pages minimal**: Astro files should be templates with minimal `<script>` logic
- **Extract TypeScript**: Move all business logic, state management, and DOM manipulation to separate `.ts` files
- **Initialization only**: `<script>` tags should only import managers and call initialization methods
- **Example structure**:

  ```astro
  ---
  // Frontmatter: imports and server-side data
  const locale = 'en';
  ---
  <MainLayout>
    <div id="container"></div>

    <script define:vars={{ locale }}>
      import { Manager } from '@/lib/manager';
      document.addEventListener('DOMContentLoaded', () => {
        new Manager(locale).initialize();
      });
    </script>
  </MainLayout>
  ```

### Translation & Internationalization (i18n)

- **Central location**: All user-facing text lives in `packages/dialogue/src/translations/` (JSON files)
- **Access pattern**: Import and use `getTranslations(locale)` from `@aquila/dialogue`
- **No hardcoded text**: Never put UI strings directly in components - always reference translation keys
- **Consistency**: Add new keys to both `en.json` and `zh.json` simultaneously

### DOM Manipulation Safety

- **Never use `innerHTML`**: Security risk and bypasses sanitization
- **Safe methods**: Use `document.createElement()`, `textContent`, `appendChild()`, `removeChild()`
- **Helper functions**: Create reusable DOM builders like `createCard()`, `createButton()`
- **Type safety**: Properly type DOM elements and event handlers

### API Development

- **Route Pattern**: Files in `apps/web/src/pages/api/*.ts` export HTTP method functions (`GET`, `POST`, etc.)
- **Type Safety**: Use `APIRoute` type from Astro for route handlers
- **Authentication**: Better Auth integration via `/api/auth/[...all]` catch-all route
- **Repository Calls**: API routes delegate to repository class methods
- **Error Handling**: Return consistent JSON responses with appropriate status codes

### Styling System

- **Tailwind v4**: Uses inline `@theme` configuration in `apps/web/src/styles/global.css`
- **Design Tokens**: CSS custom properties for theming (light/dark variants)
- **Utility Function**: `cn()` in `apps/web/src/lib/utils.ts` combines `clsx` + `tailwind-merge`
- **Visual Style**: Glassmorphism UI patterns (`bg-white/10 backdrop-blur-sm`)

### Game-Web Integration

- **URL parameters**: Pass character names and story selections via query strings
- **Scene data**: Initialize Phaser scenes with `game.scene.start('SceneName', { data })`
- **Navigation flow**: Web setup → character creation → Phaser game initialization
- **Asset management**: Game assets loaded through Phaser, UI assets through Astro/Vite

## Testing Guidelines

- **Unit Tests (Vitest)**:
  - Located in `apps/web/src/**/__tests__/*.test.ts`
  - Run with `bun --filter web test`
  - Use `jsdom` environment for browser API mocking
- **E2E Tests (Playwright)**:
  - Located in `apps/web/tests/`
  - Port consistency: Dev server must run on port 5090
  - Viewport testing: Desktop + mobile (Pixel 5, iPhone 12)
  - Page objects: Use `MainMenuPage`, `StoriesPage` from `tests/utils.ts`
  - Categories: Homepage UI, Stories navigation, responsive design, accessibility

## Key File Locations

### Workspace Packages

- **`packages/game/src/`**: Phaser scenes (`BaseScene`, `StoryScene`), `SceneDirectory`, `CheckpointStorage`, progress system
- **`packages/dialogue/src/`**:
  - `characters/CharacterId.ts` - Character definitions with `CharacterDirectory`
  - `stories/[storyName]/` - Story dialogue organized by locale
  - `translations/` - UI text translations (`en.json`, `zh.json`)
  - `types.ts` - Core type definitions (`DialogueMap`, `ChoiceMap`, etc.)
- **`packages/assets/`**: Shared game assets (images, audio)

### Web App (`apps/web/src/`)

- **Database**: `lib/drizzle/` (schema, repositories, migrations)
- **UI Components**: `components/` (Astro) + `components/ui/` (Svelte)
- **Pages**: `pages/` (routes) + `pages/api/` (API endpoints)
- **Styles**: `styles/global.css` (Tailwind v4 config + CSS variables)
- **Authentication**: `lib/auth.ts` (Better Auth config)
- **Business Logic**: `lib/` (manager classes, utilities)

## Environment Requirements

- **Package Manager**: Bun 1.1.26+ (enforced via `packageManager` field in `package.json`)
- **Monorepo Tool**: Turbo for parallel task execution and caching
- **Node/Runtime Version**: Bun v1.1.26+ (includes TypeScript 5.9+)
- **Database**: PostgreSQL-compatible database (CockroachDB staging or managed PostgreSQL in production)
- **Required Environment Variables**: `DATABASE_URL` for PostgreSQL connection
- **Optional Environment Variables**: `DB_ALLOW_SELF_SIGNED`, `DB_POOL_MAX`, `BETTER_AUTH_URL`, `ALLOW_COCKROACH_MIGRATIONS`
- **Migration Tools**: `drizzle-kit` for migrations, Bun's native TypeScript execution for scripts
- **Development Tools**: ESLint with Astro + Svelte plugins, Prettier with lint-staged (Husky hooks)
