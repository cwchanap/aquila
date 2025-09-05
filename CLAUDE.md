# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Development
- `pnpm dev` - Start both app server (port 5090) and database server (port 8080) in parallel
- `pnpm dev:app` - Start Astro app server only on port 5090
- `pnpm dev:db` - Start Turso database server on port 8080

### Database Operations
- `pnpm db:migrate` - Run migrations against production database
- `pnpm db:migrate:local` - Run migrations against local database (port 8080)
- `pnpm db:migrate:down` - Rollback the last migration
- `pnpm db:setup` - Initialize local database with migrations and test data
- `pnpm db:test` - Test database connection
- `pnpm db:verify` - Run database verification script

### Testing
- `pnpm test` - Run Playwright tests
- `pnpm test:ui` - Run tests with interactive UI
- `pnpm test:headed` - Run tests in headed mode (visible browser)
- `pnpm test:debug` - Run tests in debug mode

### Build and Lint
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues automatically

## Architecture Overview

Aquila is a hybrid web game application that combines:

- **Web UI Layer**: Astro for server-side rendering with Svelte components for interactivity
- **Game Engine Layer**: Phaser 3 for interactive game scenes and dialogue systems
- **Database Layer**: Turso (LibSQL) with Kysely ORM for type-safe queries
- **Deployment**: Vercel serverless functions with SSR support

## Key Patterns

### Database Development
- **Migration Pattern**: Create TypeScript files in `src/lib/migrations/` with `up()` and `down()` functions
- **Schema Types**: Update `src/lib/db-types.ts` to match migration changes
- **Repository Pattern**: Use `UserRepository` and other repository classes instead of direct SQL queries
- **Local Development**: Always use `TURSO_DATABASE_URL=http://127.0.0.1:8080` for local database connections

### Game Development
- **Scene Architecture**: All game scenes extend `BaseScene` which provides dialogue UI system
- **Character System**: Extend `BaseCharacter` class for game entities with sprite management and `speak()` method
- **Dialogue Data**: Store dialogue objects in `src/game/dialogue/` keyed by scene name
- **Integration**: Astro pages initialize Phaser scenes via `<script>` tags with DOM-ready handlers

### Component Architecture
- **Astro Components** (`.astro`): Server-rendered layouts and pages with integrated scripts
- **Svelte Components** (`.svelte`): Interactive UI elements requiring `client:load` directive
- **Button Variants**: Use `Button.svelte` with `variant="menu"` for consistent glassmorphism styling
- **Path Aliases**: `@/` maps to `src/` directory for clean imports

### API Development
- **Route Pattern**: Files in `src/pages/api/*.ts` export HTTP method functions (`GET`, `POST`, etc.)
- **Type Safety**: Use `APIRoute` type from Astro for route handlers
- **Repository Calls**: API routes delegate to static repository class methods
- **Error Handling**: Return consistent JSON responses with status codes

### Styling System
- **Tailwind v4**: Uses new inline `@theme` configuration in `src/styles/global.css`
- **Design Tokens**: CSS custom properties for theming with light/dark variants
- **Utility Function**: `cn()` function combines `clsx` + `tailwind-merge` for conditional classes
- **Visual Style**: Glassmorphism UI with `bg-white/10 backdrop-blur-sm` patterns

## Testing Guidelines
- **Port Consistency**: Tests expect dev server on port 5090
- **Viewport Testing**: Tests run on desktop + mobile (Pixel 5, iPhone 12) viewports
- **Page Objects**: Use `MainMenuPage`, `StoriesPage` classes from `tests/utils.ts`
- **Categories**: Homepage UI, Stories navigation, responsive design, accessibility

## Key File Locations
- **Game Logic**: `src/game/` (scenes, characters, dialogue)
- **Database**: `src/lib/` (connection, types, migrations, repositories)  
- **UI Components**: `src/components/` (Astro) + `src/components/ui/` (Svelte)
- **Pages & API**: `src/pages/` (routes) + `src/pages/api/` (endpoints)
- **Styles**: `src/styles/global.css` (Tailwind config + CSS variables)

## Environment Requirements
- **Package Manager**: pnpm (required, specified in package.json)
- **Database**: Turso database URL in environment variables
- **Migration Tool**: tsx for running TypeScript migration files
- **Development Tools**: ESLint with Astro and Svelte plugins configured