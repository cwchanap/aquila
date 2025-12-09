---
description: Supabase authentication overview for Aquila web
---

# Supabase Auth – Aquila Web

This document summarizes how the Aquila web app uses Supabase for email/password authentication and how it links Supabase users to the existing Application User data model.

## 1. Environment configuration

Configure these variables in the **repo root** `.env`:

```bash
# Existing database (unchanged)
DATABASE_URL=postgresql://...

# Server-side Supabase config (used by Node/SSR and API routes)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_...

# Client-side Supabase config (exposed to the browser via import.meta.env)
PUBLIC_SUPABASE_URL=$SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
```

Key points:

- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are used on the server (e.g. `/api/auth/logout`).
- `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` are read in the browser via `import.meta.env` by `apps/web/src/lib/auth/supabaseClient.ts`.
- The Supabase project is shared with other apps; Aquila links identities via `supabaseUserId` in the Application User table.

## 2. Core helpers and data model

- Supabase client factory: `apps/web/src/lib/auth/supabaseClient.ts`
  - Creates a singleton Supabase client using the env vars above.
  - Uses `persistSession: true` so browser sessions survive reloads.
- Auth helpers: `apps/web/src/lib/auth.ts`
  - `getSupabaseAuthClient()` – returns the shared Supabase client.
  - `getCurrentSession()` – retrieves the current Supabase session.
  - `getCurrentUser()` – calls `/api/me` with the access token and returns the linked Application User.
- Server auth mapping: `apps/web/src/lib/auth/server.ts`
  - `requireSupabaseUser(request)` – validates a bearer token with Supabase, then loads or creates the Application User by `supabaseUserId`.

The Application User schema includes `supabaseUserId`, used to join Supabase identities to Aquila game/profile data.

## 3. UI flows

### 3.1 Sign in (US1)

- Route: `/en/login` (and `/zh/login`).
- Implementation: `apps/web/src/pages/en/login.astro`.
- Behavior:
  - Collects email + password and calls `supabase.auth.signInWithPassword`.
  - On success, redirects to `/${locale}/` (main menu).
  - On failure, shows a localized error banner.

The main menu page (`apps/web/src/pages/en/index.astro`) calls `getCurrentUser()` on load and redirects unauthenticated users back to `/en/login`.

### 3.2 Sign up (US2)

- Route: `/en/signup` (and `/zh/signup`).
- Implementation: `apps/web/src/pages/en/signup.astro`.
- Behavior:
  - Collects email, password, and name.
  - Calls `supabase.auth.signUp({ email, password, options: { data: { full_name: name }}})`.
  - Assumes email confirmation is configured so that the test environment gets an active session.
  - On success, redirects to `/${locale}/` and `/api/me` links the Supabase user to an Application User record via `supabaseUserId`.

### 3.3 Logout (US3)

- UI: `UserStatus.svelte` (user menu in the top-right of the main menu).
- Behavior:
  - Calls `supabase.auth.signOut()` on the client.
  - Then calls `POST /api/auth/logout` to clear any server-side context or legacy cookies.
  - Finally redirects the browser to `/${locale}/login`.

`/api/auth/logout` is implemented in `apps/web/src/pages/api/auth/logout.ts` and uses the access token to revoke the Supabase session.

### 3.4 Password reset and recovery (US3)

- **Request reset** – login page (`apps/web/src/pages/en/login.astro`):
  - "Forgot your password?" link triggers `supabase.auth.resetPasswordForEmail(email, { redirectTo })`.
  - Shows success or error banners (`#success-message`, `#error-message`).
- **Complete reset** – reset page (`apps/web/src/pages/en/reset.astro`):
  - Restores the Supabase session from the URL hash.
  - Allows the user to choose a new password via `supabase.auth.updateUser`.
  - Redirects back to `/en/login` on success.

## 4. Supabase auth E2E tests

Located in `packages/e2e/tests/`:

- `auth-existing-supabase-user.spec.ts` – US1: existing user sign-in.
- `auth-new-user-signup.spec.ts` – US2: new user signup to main menu and stories page.
- `auth-account-management.spec.ts` – US3: sign up, logout, password-reset request, and recovery login.

Run them individually from `packages/e2e`:

```bash
cd packages/e2e

# US1 – existing Supabase user login
bun run test:e2e -- tests/auth-existing-supabase-user.spec.ts

# US2 – new user signup
bun run test:e2e -- tests/auth-new-user-signup.spec.ts

# US3 – account management (logout, reset, recovery)
bun run test:e2e -- tests/auth-account-management.spec.ts
```

## 5. Development workflow

1. Ensure `.env` is configured as above.
2. From repo root, start dev:

   ```bash
   bun dev
   ```

3. Visit `http://localhost:5090/en/login` or `/en/signup` to exercise the Supabase auth flows.
4. Use the Playwright specs to validate that US1–US3 remain green after changes.

## 6. Data Integrity

A verification script is available to audit the link between Supabase Identity and Aquila Application Users.

**Usage:**

```bash
# Run from repo root or apps/web
bun apps/web/scripts/verify-supabase-links.ts
```

**What it checks:**

1. Fetches all users from the linked Supabase project (via `SUPABASE_SERVICE_ROLE_KEY`).
2. Fetches all Aquila `Application User` records that have a `supabaseUserId`.
3. Reports inconsistencies:
   - **Missing in App**: Supabase user exists but has no corresponding Application User. (Expected for new users who haven't signed into Aquila yet, or users of _other_ apps sharing the project).
   - **Orphaned App User**: Application User has a `supabaseUserId` that does not exist in Supabase. (Critical data integrity issue).

**Interpretation:**

- "Missing in App" is often benign in a shared-project environment.
- "Orphaned App User" requires manual intervention to fix (e.g., clear the invalid ID or delete the user).

## 7. Operational Support

### Monitoring

- **Sign-in Latency**: Watch the p95 latency for the sign-in flow. Latency > 3s indicates degraded UX.
- **Support Tickets**: Tag tickets related to auth with `auth` and `supabase`.
- **Common Issues**:
  - "Connection Error" / 500 on login: Check Supabase status and `SUPABASE_SERVICE_ROLE_KEY` validity.
  - "User already exists": Check if email is taken in Supabase.

### Post-Release Review

Run a review after the first 1000 users or 1 week of traffic:

1. Run `verify-supabase-links.ts` to ensure no data drift.
2. Check Playwright test pass rates.
3. Review support ticket volume for `auth` tag.
