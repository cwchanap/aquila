# Quickstart: Supabase Auth Integration (Shared Supabase Project)

## Prerequisites

- Access to the existing **shared Supabase project** used by other applications.
- Supabase credentials available as environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
- Aquila monorepo checked out and dependencies installed (Bun 1.1.26+).

## 1. Configure environment

1. Open the repo root `.env` (or appropriate environment file for the web app).
2. Add or update the following variables (values from the shared Supabase project):

   ```bash
   # Server-side Supabase config (Node/SSR, API routes)
   SUPABASE_URL=...       # e.g., https://your-project.supabase.co
   SUPABASE_ANON_KEY=...  # public anon key for server-side and scripts

   # Client-side Supabase config (exposed to the browser via import.meta.env)
   PUBLIC_SUPABASE_URL=$SUPABASE_URL
   PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

   # Optional: service-role key for server-to-server use, if needed later
   # SUPABASE_SERVICE_ROLE_KEY=...
   ```

3. Ensure existing database-related env vars (e.g., `DATABASE_URL`) remain unchanged.

## 2. Run the web app with Supabase auth

1. From the repo root, start the dev server:

   ```bash
   bun dev
   ```

2. Open the web app in a browser (default):
   - `http://localhost:5090`

3. Use the new auth UI to:
   - Sign up as a **new user** (creates a Supabase user and an Aquila `Application User`).
   - Sign in using an **existing Supabase account** from another app in the same project (reuses the existing Supabase user and creates an Aquila `Application User` on first sign-in).

4. Verify that gameplay and profile data still come from the existing Cockroach/Postgres database and that the `Application User` is linked by `supabaseUserId`.

## 3. Run tests

1. Run unit tests for the web app:

   ```bash
   bun --filter web test
   ```

2. Run Playwright E2E tests (including Supabase auth journeys):

   ```bash
   # From repo root – full E2E suite (may include non-auth tests)
   bun test:e2e

   # From packages/e2e – Supabase auth journeys only
   cd packages/e2e
   bun run test:e2e -- tests/auth-existing-supabase-user.spec.ts      # US1
   bun run test:e2e -- tests/auth-new-user-signup.spec.ts             # US2
   bun run test:e2e -- tests/auth-account-management.spec.ts          # US3
   ```

3. Run linting:

   ```bash
   bun lint
   ```

All test suites MUST pass before merging changes to the `001-supabase-auth` branch.

## 4. Integration checklist

- [x] Supabase env vars configured for local development (including PUBLIC*SUPABASE*\* for client-side).
- [x] Supabase-based signup and signin flows working in the web UI.
- [x] `GET /api/me` returns the expected `Application User` for authenticated sessions.
- [x] Sign-out flow clears Supabase session and local auth context.
- [x] Existing game data and progress remain intact for returning players.
- [x] Unit and E2E tests updated to cover new auth flows and passing (US1–US3 auth specs).
