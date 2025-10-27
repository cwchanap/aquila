# Aquila Game Project - AI Agent Instructions

## Architecture Overview

Aquila is a **hybrid web game application** combining Astro for web pages and Phaser 3 for interactive game scenes. The architecture separates concerns between:

- **Web UI Layer**: Astro pages + Svelte components for menus, setup forms, and navigation
- **Game Engine Layer**: Phaser 3 scenes for interactive gameplay with dialogue systems
- **Data Layer**: Turso (LibSQL) database with Kysely ORM and file-based migrations
- **Deployment**: Vercel serverless functions with SSR support

## Critical Development Workflows

### Database Development
- **Local setup**: `pnpm dev:db` (starts Turso dev server on :8080) + `pnpm drizzle:migrate`
- **Migration pattern**: Update `src/lib/drizzle/schema.ts`, then run `pnpm drizzle:generate`
- **Schema types**: Update Drizzle schema and repositories together
- **Repository pattern**: Use `UserRepository` class methods, not direct SQL
- **CockroachDB note**: `pnpm drizzle:migrate` blocks Cockroach URLs. Only run `pnpm drizzle:migrate:allow-cockroach` with `ALLOW_COCKROACH_MIGRATIONS=true` after staging validation.
- **Environment requirement**: Ensure `DATABASE_URL` is set for local dev, CI, and deployment. Optional tuning variables: `DB_ALLOW_SELF_SIGNED` (only for non-production self-signed certs) and `DB_POOL_MAX` (pool size).

### Game Development
- **Scene inheritance**: All game scenes extend `BaseScene` which provides dialogue UI system
- **Dialogue pattern**: Store dialogue data in `src/game/dialogue/` as objects keyed by scene name
- **Character system**: Extend `BaseCharacter` for game entities with `speak()` and sprite management
- **Integration**: Astro pages import Phaser scenes via `<script>` tags with DOM-ready initialization

### Testing Strategy
- **Port consistency**: Dev server always runs on `:5090`, tests expect this port
- **Test categories**: Homepage (UI), Stories (navigation), Navigation (responsive), Accessibility
- **Page objects**: Use `MainMenuPage`, `StoriesPage` classes from `tests/utils.ts`
- **Viewport testing**: Tests run on desktop + mobile (Pixel 5, iPhone 12) viewports

## Project-Specific Patterns

### Component Architecture
- **Astro components** (`.astro`): Minimal server-rendered templates - extract logic to TypeScript modules
- **TypeScript logic modules**: Complex behavior lives in `apps/web/src/lib/` as manager/controller classes
- **Svelte components** (`.svelte`): Interactive UI elements requiring `client:load` directive in Astro
- **Button variants**: Use `Button.svelte` with `variant="menu"` for glassmorphism game UI
- **Path aliases**: `@/` maps to `src/` directory for clean imports

### Astro Page Best Practices
- **Keep pages minimal**: Astro files should be templates with minimal `<script>` logic
- **Extract TypeScript**: Move all business logic, state management, and DOM manipulation to separate `.ts` files
- **Manager pattern**: Create manager classes (e.g., `BookmarksManager`, `ReaderManager`) in `apps/web/src/lib/`
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

### Styling System
- **Tailwind v4**: Uses new inline `@theme` configuration in `src/styles/global.css`
- **Design tokens**: CSS custom properties for consistent theming with light/dark variants
- **Utility pattern**: `cn()` function combines `clsx` + `tailwind-merge` for conditional classes
- **Visual style**: Glassmorphism UI with `bg-white/10 backdrop-blur-sm` patterns

### API Development
- **Route pattern**: `src/pages/api/*.ts` files export HTTP method functions (`GET`, `POST`, etc.)
- **Error handling**: Consistent JSON response format with status codes and error messages
- **Repository calls**: API routes delegate to static `Repository` class methods
- **Type safety**: Use `APIRoute` type from Astro for route handlers

### Game-Web Integration
- **URL parameters**: Pass character names and story selections via query strings
- **Scene data**: Initialize Phaser scenes with `game.scene.start('SceneName', { data })`
- **Navigation flow**: Web setup → character creation → Phaser game initialization
- **Asset management**: Game assets loaded through Phaser, UI assets through Astro/Vite

## Environment Configuration

- **Database URLs**: `TURSO_DATABASE_URL` defaults to `http://127.0.0.1:8080` for local development
- **Migration execution**: Use `tsx` for TypeScript migration files, not Node.js directly
- **Development tools**: pnpm for package management, ESLint with Astro+Svelte plugins

## Key File Locations

- **Game logic**: `src/game/` (scenes, characters, dialogue)
- **Database**: `src/lib/` (connection, types, migrations, repositories)
- **UI components**: `src/components/` (Astro) + `src/components/ui/` (Svelte)
- **Pages**: `src/pages/` (routes) + `src/pages/api/` (API endpoints)
- **Styles**: `src/styles/global.css` (Tailwind configuration + CSS variables)

Always verify the database connection when adding new features and maintain the separation between web UI (Astro/Svelte) and game logic (Phaser) layers.
