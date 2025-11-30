# Implementation Plan: Supabase Auth Integration (Shared Supabase Project)

**Branch**: `001-supabase-auth` | **Date**: 2025-11-29 | **Spec**: `specs/001-supabase-auth/spec.md`
**Input**: Feature specification from `/specs/001-supabase-auth/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Integrate the Aquila web app with an existing shared Supabase project for authentication only, while keeping all profile and gameplay data in the existing Cockroach/Postgres database. Supabase provides email/password authentication and session management; the web app creates or loads an `Application User` record in Cockroach/Postgres keyed by the Supabase user ID and uses that record for all game logic and progress.

The technical approach is to replace the current Better Auth integration in `apps/web` with Supabase Auth (via `@supabase/supabase-js`), introduce or adapt a `supabaseUserId` link in the Drizzle schema, and update API routes and UI flows to use Supabase sessions. Throughout, we preserve the repository pattern, translation-first i18n, DOM safety rules, and existing testing discipline.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Bun 1.1.26+ runtime with TypeScript 5.9+ (Astro 5.x, Svelte 5.x)  
**Primary Dependencies**: Astro 5 (SSR), Svelte 5, `@supabase/supabase-js`, Drizzle ORM, Better Auth (to be deprecated for web), Playwright, Vitest  
**Storage**: CockroachDB (Postgres-compatible) via Drizzle repositories in `apps/web/src/lib/drizzle/`  
**Testing**: Vitest (unit tests in `apps/web`), Playwright (E2E tests in `packages/e2e`), plus existing linting via `bun lint`  
**Target Platform**: Web browser via Astro SSR (deployed to Vercel or equivalent), local development via Bun on macOS  
**Project Type**: Monorepo with Astro web app + shared packages (`@aquila/game`, `@aquila/dialogue`, `@aquila/assets`, `@aquila/e2e`)  
**Performance Goals**: Auth flows should keep sign-in under 3 seconds for at least 95% of successful attempts and must not materially slow down existing page loads.  
**Constraints**: Supabase is used **only** for authentication; all profile and gameplay data remain in the existing Cockroach/Postgres database. No social login or other identity providers are introduced in this feature. No production migration of existing Supabase users is required.  
**Scale/Scope**: Designed to support at least tens of thousands of player accounts across multiple applications sharing the same Supabase project, with Aquila responsible only for its own `Application User` records.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Monorepo Package Architecture (OK)**: Changes are confined to the `apps/web` workspace and do not bypass existing `@aquila/game`, `@aquila/dialogue`, or `@aquila/assets` package boundaries.
- **Type Safety & Repository Pattern (OK)**: Any schema or data changes for linking Supabase users MUST go through `apps/web/src/lib/drizzle/schema.ts` and repository methods in `apps/web/src/lib/drizzle/repositories.ts`. Direct SQL is prohibited.
- **Separation of Concerns (OK)**: Supabase integration logic will live in dedicated TypeScript modules (for example, `apps/web/src/lib/auth/supabaseClient.ts` and related managers). Astro page files remain thin initializers.
- **DOM Safety & Security (OK)**: Auth-related UI MUST avoid `innerHTML` and use safe DOM APIs only. Supabase auth flows are invoked via SDK calls and standard forms, not via unsanitized HTML injection.
- **Translation-First Internationalization (OK)**: All new user-facing auth strings (buttons, errors, prompts) MUST be added to `packages/dialogue/src/translations/` for all supported locales and consumed via `getTranslations(locale)`.
- **Testing Discipline (OK)**: New auth flows MUST be covered by Vitest unit tests and Playwright E2E tests (happy paths plus basic failure cases) without breaking the existing test suite.
- **Technology Constraint – Authentication (OK)**: The constitution now specifies Supabase Auth for the web app with PostgreSQL-backed application data. This feature migrates the web app to Supabase Auth to share identity with other applications using the same Supabase project and to offload credential management; the tradeoff is documented in the Complexity Tracking table.

## Project Structure

### Documentation (this feature)

```text
specs/001-supabase-auth/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
apps/
├── web/                      # Astro SSR web app (Supabase auth integration lives here)
│   ├── src/
│   │   ├── lib/
│   │   │   ├── auth.ts                   # Current Better Auth integration (to be replaced/retired)
│   │   │   ├── drizzle/
│   │   │   │   ├── schema.ts            # DB schema (user/app tables, Supabase link field)
│   │   │   │   └── repositories.ts      # Repository pattern for all DB access
│   │   │   └── auth/
│   │   │       └── supabaseClient.ts    # New Supabase auth client + helpers (to be added)
│   │   ├── pages/
│   │   │   ├── index.astro
│   │   │   └── api/
│   │   │       └── ...                  # Existing API routes, including auth/session endpoints
│   │   └── components/
│   └── tests/
│       └── ...                          # Vitest tests for web app
├── desktop/
│   └── ...                              # Desktop app (not directly changed by this feature)
packages/
├── game/                                # Phaser scenes and game logic
├── dialogue/                            # Dialogue content and translations (auth UI strings here)
├── assets/                              # Shared assets
└── e2e/
    └── tests/                           # Playwright tests, including auth journeys
```

**Structure Decision**: Use the existing monorepo layout. All implementation work for this feature lives in `apps/web` and reuses existing packages (`@aquila/game`, `@aquila/dialogue`, `@aquila/assets`, `@aquila/e2e`) without introducing new workspaces or cross-cutting dependencies.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                                            | Why Needed                                                                                                                                                         | Simpler Alternative Rejected Because                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Switch from Better Auth to Supabase Auth for web app | Need to share identity and credentials with other applications using a shared Supabase project and offload authentication/security concerns to a managed provider. | Keeping Better Auth would require maintaining a separate auth system per app, make cross-app SSO impossible or brittle, and increase long-term security and maintenance burden. |
