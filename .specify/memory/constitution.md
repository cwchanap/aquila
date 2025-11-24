<!--
Sync Impact Report:
- Version: INITIAL → 1.0.0 (new constitution)
- Modified principles: N/A (initial creation)
- Added sections: All core principles, Technology Constraints, Development Workflow, Governance
- Removed sections: N/A
- Templates requiring updates:
  ✅ spec-template.md (aligned with user story testing requirements)
  ✅ plan-template.md (includes Constitution Check section)
  ✅ tasks-template.md (aligned with testing discipline and parallel execution)
- Follow-up TODOs: None
-->

# Aquila Constitution

## Core Principles

### I. Monorepo Package Architecture

Every feature MUST be organized into appropriate workspace packages following clear separation of concerns:

- Game logic lives in `@aquila/game` package - independently testable scenes, game mechanics, and engine code
- Content and narrative live in `@aquila/dialogue` package - dialogue trees, character definitions, translations
- Web application imports packages as dependencies - no direct coupling to package internals
- Each package MUST have clear, documented public APIs
- Packages MUST be independently testable without requiring full application context
- Cross-package dependencies MUST be explicit and justified

**Rationale**: Monorepo architecture enables code reuse between web and desktop applications while maintaining clear boundaries. Independent packages ensure testability and prevent tight coupling.

### II. Type Safety & Repository Pattern

All database interactions MUST use type-safe patterns:

- Schema changes defined in `apps/web/src/lib/drizzle/schema.ts`
- Database access MUST go through repository class methods in `drizzle/repositories.ts`
- Direct SQL queries are PROHIBITED - use Drizzle ORM exclusively
- All database operations MUST be type-safe at compile time
- Migration safety: CockroachDB migrations require explicit opt-in via `ALLOW_COCKROACH_MIGRATIONS=true` after staging validation
- Default to managed PostgreSQL for production environments

**Rationale**: Type safety catches errors at compile time. Repository pattern provides a single source of truth for data access, making changes traceable and testable. Migration safety prevents production issues from pre-release database dialects.

### III. Separation of Concerns (Manager Pattern)

Complex business logic MUST be extracted from UI templates into dedicated modules:

- Astro components (`.astro`) MUST be minimal server-rendered templates
- TypeScript logic modules in `apps/web/src/lib/` handle business logic, state management, DOM manipulation
- Svelte components (`.svelte`) for interactive UI elements requiring `client:load` directive
- Manager classes (e.g., `ReaderManager`) centralize complex behavior outside page files
- `<script>` tags in Astro pages MUST only import and initialize - no business logic

**Rationale**: Separation of concerns improves testability, maintainability, and code reuse. Templates remain readable and focused on structure, while logic lives in testable TypeScript modules.

### IV. DOM Safety & Security (NON-NEGOTIABLE)

DOM manipulation MUST follow security-first patterns:

- `innerHTML` is PROHIBITED - security risk and bypasses sanitization
- Use safe methods EXCLUSIVELY: `document.createElement()`, `textContent`, `appendChild()`, `removeChild()`
- Create reusable DOM builder helper functions (e.g., `createCard()`, `createButton()`)
- All DOM elements and event handlers MUST be properly typed
- User input MUST be sanitized before rendering
- XSS prevention is mandatory at all DOM interaction points

**Rationale**: Security vulnerabilities like XSS can compromise user data and application integrity. Safe DOM patterns are non-negotiable to protect users.

### V. Translation-First Internationalization

All user-facing text MUST go through the translation system:

- Central location: `packages/dialogue/src/translations/` (JSON files per locale)
- Access pattern: Import and use `getTranslations(locale)` from `@aquila/dialogue`
- Hardcoded UI strings in components are PROHIBITED
- Add new keys to ALL locale files simultaneously (`en.json`, `zh.json`)
- Dialogue content organized by story in `packages/dialogue/src/stories/[storyName]/`
- Support locale-specific files per story (e.g., `trainAdventure/en.ts`, `trainAdventure/zh.ts`)

**Rationale**: Centralized translations ensure consistency, prevent missing translations, and enable rapid localization to new languages. Content-as-data architecture separates narrative from code.

### VI. Testing Discipline

Comprehensive test coverage MUST be maintained across all layers:

- Unit tests (Vitest) in `apps/web/src/**/__tests__/*.test.ts` for business logic
- E2E tests (Playwright) in `packages/e2e/tests/` for user journeys
- Port consistency: Dev server MUST run on port 5090 for E2E tests
- Test both desktop and mobile viewports (Pixel 5, iPhone 12)
- Use page objects pattern for E2E tests (e.g., `MainMenuPage`, `StoriesPage`)
- Categories: Homepage UI, navigation, responsive design, accessibility
- Run `bun test` before any PR - all tests MUST pass

**Rationale**: Testing prevents regressions, ensures features work across devices, and validates accessibility. Comprehensive test coverage is essential for a quality user experience.

## Technology Constraints

**Package Manager**: Bun 1.1.26+ (enforced via `packageManager` field)  
**Monorepo Tool**: Turborepo for parallel task execution and caching  
**Database**: PostgreSQL-compatible (managed PostgreSQL preferred, CockroachDB staging only with explicit opt-in)  
**Web Framework**: Astro 5.x with SSR  
**Components**: Svelte 5.x with Tailwind CSS v4  
**Game Engine**: Phaser 3.x  
**Desktop**: Tauri v2 + SvelteKit (SPA mode, no SSR)  
**ORM**: Drizzle with type-safe queries  
**Authentication**: Better Auth with PostgreSQL backend  
**Testing**: Vitest (unit) + Playwright (E2E)

**Visual Design**: Glassmorphism UI patterns (`bg-white/10 backdrop-blur-sm`), consistent `Button.svelte` variants

## Development Workflow

### Code Organization

- Web app path alias: `@/` maps to `apps/web/src/`
- Manager pattern for business logic in `apps/web/src/lib/`
- Scene architecture: All game scenes extend `BaseScene` from `@aquila/game`
- `StoryScene` adds checkpoint/save functionality, choice system, progress tracking
- Character system: Unique IDs in `packages/dialogue/src/characters/CharacterId.ts`

### Database Changes

1. Modify `apps/web/src/lib/drizzle/schema.ts`
2. Run `bun drizzle:generate` to create migration files
3. Review generated SQL in `apps/web/src/lib/drizzle/migrations/`
4. Apply with `bun drizzle:migrate` (guards against CockroachDB)
5. Use `ALLOW_COCKROACH_MIGRATIONS=true` only after staging validation

### Adding Stories

1. Create dialogue files in `packages/dialogue/src/stories/[storyName]/`
2. Add locale-specific content (`en.ts`, `zh.ts`) using `DialogueMap` type
3. Export via story loader function (e.g., `getTrainAdventureStory(locale)`)
4. Register in `packages/dialogue/src/stories/index.ts`
5. Update translations in `packages/dialogue/src/translations/` if new UI text needed

### Testing Gates

- All unit tests MUST pass: `bun --filter web test`
- All E2E tests MUST pass: `bun test:e2e`
- Lint checks MUST pass: `bun lint`
- Git hooks enforce lint-staged checks via Husky

### Integration Pattern

- URL parameters pass character names and story selections via query strings
- Phaser scenes initialized with `game.scene.start('SceneName', { data })`
- Navigation flow: Web setup → character creation → Phaser game initialization
- Game assets loaded through Phaser, UI assets through Astro/Vite

## Governance

This constitution supersedes all other development practices. All code reviews, PRs, and feature implementations MUST verify compliance with constitutional principles.

**Amendment Procedure**: Amendments require documented justification, approval from project maintainers, and migration plan for affected code. Version increments follow semantic versioning:

- **MAJOR**: Backward incompatible governance/principle removals or redefinitions
- **MINOR**: New principle/section added or materially expanded guidance
- **PATCH**: Clarifications, wording, typo fixes, non-semantic refinements

**Compliance Reviews**: Violations MUST be justified in plan.md Complexity Tracking table. Complexity MUST be justified against simpler alternatives.

**Runtime Guidance**: See `CLAUDE.md` and `AGENTS.md` for detailed development patterns, file locations, and command reference.

**Version**: 1.0.0 | **Ratified**: 2025-11-24 | **Last Amended**: 2025-11-24
