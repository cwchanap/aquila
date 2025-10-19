---
trigger: always_on
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Development

- `pnpm dev` - Start web app (port 5090), desktop app, and database server (port 5091) in parallel via Turbo
- `pnpm dev:web` - Start Astro web app only on port 5090
- `pnpm dev:db` - Start Turso database server on port 5091

### Database Operations

- `pnpm db:migrate` - Run migrations against production database
- `pnpm db:migrate:local` - Run migrations against local database (port 5091)
- `pnpm db:migrate:down` - Rollback the last migration
- `pnpm db:setup` - Initialize local database with migrations and test data
- `pnpm db:test` - Test database connection
- `pnpm db:verify` - Run database verification script
- `pnpm drizzle:generate` - Generate Drizzle migrations (web app only)
- `pnpm drizzle:migrate` - Run Drizzle migrations (web app only)
- `pnpm drizzle:studio` - Open Drizzle Studio GUI (web app only)

### Testing

- `pnpm test` - Run all tests (Turbo runs unit + E2E across workspaces)
- `pnpm test:e2e` - Run Playwright E2E tests (web app)
- `pnpm test:ui` - Run Playwright tests with interactive UI
- `pnpm test:headed` - Run E2E tests in headed mode (visible browser)
- `pnpm test:debug` - Run E2E tests in debug mode
- `pnpm test:report` - Show Playwright test report
- `pnpm --filter web test` - Run Vitest unit tests (web app only)
- `pnpm --filter web test:ui` - Run Vitest with interactive UI

### Build and Lint

- `pnpm build` - Build all workspaces for production (via Turbo)
- `pnpm preview` - Preview production build (web app)
- `pnpm lint` - Run ESLint across all workspaces (via Turbo)
- `pnpm lint:fix` - Fix ESLint issues automatically

## Architecture Overview

Aquila is a **monorepo** using Turbo and pnpm workspaces containing:

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
- **Database Layer**: Dual migration system - Kysely for legacy + Drizzle ORM for new features
- **Deployment**: Vercel serverless (web) with SSR support

## Key Patterns

### Database Development

- **Dual Migration System**:
  - **Kysely** (legacy): Create `.ts` files in `apps/web/src/lib/migrations/` with `up()` and `down()` functions
  - **Drizzle** (preferred): Use `pnpm drizzle:generate` after schema changes in `apps/web/src/lib/drizzle/schema.ts`
- **Schema Types**:
  - Update `apps/web/src/lib/db-types.ts` for Kysely
  - Update `apps/web/src/lib/drizzle/schema.ts` for Drizzle
- **Repository Pattern**: Use repository classes in `repositories.ts` or `drizzle/repositories.ts`, not direct SQL
- **Local Development**: Database runs on port 5091, use `TURSO_DATABASE_URL=http://127.0.0.1:5091`
- **Environment Variables**: Production uses `DATABASE_URL` (Drizzle) and `TURSO_DATABASE_URL` (Kysely)

### Game Development

- **Package Structure**:
  - Game logic lives in `packages/game/src/` as `@aquila/game` workspace package
  - Dialogue content lives in `packages/dialogue/src/` as `@aquila/dialogue` workspace package
  - Web app imports both: `import { BaseScene } from '@aquila/game'`
- **Scene Architecture**:
  - All scenes extend `BaseScene` (from `@aquila/game`)
  - Scenes use section-based navigation via `SceneDirectory` and `sectionKey`
  - Dialogue UI automatically created with Enter/Backspace navigation
- **Character System**:
  - Characters defined in `packages/dialogue/src/characters/` with unique IDs
  - `CharacterDirectory` maps IDs to display names and info
  - Player name substitution built into `BaseScene.showDialogue()`
- **Dialogue Content**:
  - Store in `packages/dialogue/src/stories/[storyName]/` as TypeScript objects
  - Use `DialogueMap` type: `{ [sceneId: string]: DialogueEntry[] }`
  - Support for multi-language via locale-specific files (e.g., `en.ts`, `zh.ts`)
- **Integration**: Astro pages in `apps/web` initialize Phaser with registry data (`playerName`, `locale`)

### Component Architecture

- **Astro Components** (`.astro`): Server-rendered layouts/pages in `apps/web/src/components/`
- **Svelte Components** (`.svelte`): Interactive UI requiring `client:load` directive in Astro
- **Button Variants**: Use `Button.svelte` with `variant="menu"` for glassmorphism styling
- **Path Aliases**: `@/` maps to `apps/web/src/` within web app workspace

### API Development

- **Route Pattern**: Files in `apps/web/src/pages/api/*.ts` export HTTP method functions (`GET`, `POST`, etc.)
- **Type Safety**: Use `APIRoute` type from Astro for route handlers
- **Authentication**: Better Auth integration via `/api/auth/[...all]` catch-all route
- **Repository Calls**: API routes delegate to repository class methods (Kysely or Drizzle)
- **Error Handling**: Return consistent JSON responses with appropriate status codes

### Styling System

- **Tailwind v4**: Uses inline `@theme` configuration in `apps/web/src/styles/global.css`
- **Design Tokens**: CSS custom properties for theming (light/dark variants)
- **Utility Function**: `cn()` in `apps/web/src/lib/utils.ts` combines `clsx` + `tailwind-merge`
- **Visual Style**: Glassmorphism UI patterns (`bg-white/10 backdrop-blur-sm`)

## Testing Guidelines

- **Unit Tests (Vitest)**:
  - Located in `apps/web/src/**/__tests__/*.test.ts`
  - Run with `pnpm --filter web test`
  - Use `jsdom` environment for browser API mocking
- **E2E Tests (Playwright)**:
  - Located in `apps/web/tests/`
  - Port consistency: Dev server must run on port 5090
  - Viewport testing: Desktop + mobile (Pixel 5, iPhone 12)
  - Page objects: Use `MainMenuPage`, `StoriesPage` from `tests/utils.ts`
  - Categories: Homepage UI, Stories navigation, responsive design, accessibility

## Key File Locations

### Workspace Packages

- **`packages/game/src/`**: Phaser scenes (`BaseScene`, `StoryScene`), character classes, scene directory
- **`packages/dialogue/src/`**: Dialogue content, character definitions, story data
- **`packages/assets/`**: Shared game assets (images, audio)

### Web App (`apps/web/src/`)

- **Database**: `lib/` (Kysely: `db.ts`, `migrations/`; Drizzle: `drizzle/`)
- **UI Components**: `components/` (Astro) + `components/ui/` (Svelte)
- **Pages**: `pages/` (routes) + `pages/api/` (API endpoints)
- **Styles**: `styles/global.css` (Tailwind v4 config + CSS variables)
- **Authentication**: `lib/auth.ts` (Better Auth config)

## Environment Requirements

- **Package Manager**: pnpm 10.8.0+ (enforced via `packageManager` field)
- **Monorepo Tool**: Turbo for parallel task execution and caching
- **Node Version**: Uses Node.js with TypeScript 5.9+
- **Database**:
  - Local: Turso dev server on port 5091
  - Production: `DATABASE_URL` (PostgreSQL via Drizzle) or `TURSO_DATABASE_URL` (LibSQL via Kysely)
- **Migration Tools**:
  - `tsx` for TypeScript migration execution
  - `drizzle-kit` for Drizzle migrations
- **Development Tools**: ESLint with Astro + Svelte plugins, Prettier with lint-staged (Husky hooks)
