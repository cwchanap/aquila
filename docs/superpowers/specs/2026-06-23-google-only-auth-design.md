# Google-Only Authentication — Design

**Date:** 2026-06-23
**Status:** Approved (design)
**Scope:** Web app (`apps/web`) only. The Tauri desktop app does not use auth.

## Summary

Migrate authentication from email/password to **Google OAuth only**. Email/password
sign-in, sign-up, and password-change are removed entirely. Sign-in becomes a single
"Continue with Google" action that handles both new and returning users.

This is a **greenfield** change: there are no existing email/password users to preserve,
so no account-linking or data migration is required.

## Goals

- Users authenticate exclusively via Google OAuth.
- "Log in" and "sign up" collapse into one action on a single auth page.
- Remove all email/password scaffolding (forms, password-change endpoint, bcrypt).
- No database migration.

## Non-Goals

- Account linking / migrating existing credential accounts (greenfield — none exist).
- Supporting any other social provider (Google only; nothing else planned).
- Dropping the unused `accounts.password` column or `verification_tokens` table
  (left in place; optional future cleanup, out of scope).
- Automating the full external Google consent flow in E2E tests.

## Current State (baseline)

- **Better Auth v1.3.7** + Drizzle adapter (PostgreSQL), configured in
  `apps/web/src/lib/auth.ts` with `emailAndPassword.enabled: true`.
- Client (`apps/web/src/lib/auth-client.ts`) exports `signIn`, `signUp`, `signOut`, `useSession`.
- Catch-all auth route `apps/web/src/pages/api/auth/[...all].ts` serves Better Auth
  (this already covers the future `/api/auth/callback/google` route).
- `login.astro` (email/password form via `signIn.email`), `signup.astro` (via `signUp.email`).
- `profile.astro` + `api/auth/change-password.ts` (bcrypt, in-memory rate limiting) for password changes.
- `AccountRepository.findCredentialAccount` / `updatePassword` support the change-password flow.
- `accounts` table already has all OAuth columns (`accountId`, `providerId`, `accessToken`,
  `refreshToken`, `idToken`, token expiries, `scope`, `password`).
- Many pages/APIs check the session via `getSessionUser` / `requireAuth` — these are
  **provider-agnostic** and unaffected by *how* a user signs in.
- Translations live in `@aquila/stories` (`packages/stories/src/translations/{en,zh}.json`).

## Approach

Use **Better Auth's built-in Google social provider**. Flip `emailAndPassword` off, add a
`socialProviders.google` block, and rely on the existing catch-all route for the OAuth
callback. The `accounts` table already supports OAuth, so **no schema migration is needed**.

*Rejected:* a generic/custom OAuth plugin (unnecessary — Google is first-class in Better Auth);
replacing Better Auth or hand-rolling OAuth (discards working session infrastructure for no gain).

## Detailed Design

### 1. Better Auth server config — `apps/web/src/lib/auth.ts`

- Remove the `emailAndPassword` block.
- Add a `socialProviders.google` block reading `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Add a **production guard**: throw if either Google credential is missing when
  `PROD`/`NODE_ENV === 'production'`, mirroring the existing `BETTER_AUTH_SECRET` and
  `TRUSTED_ORIGINS` guards. In non-production, fall back to empty strings (auth simply
  won't complete until creds are set locally).
- Keep all `modelName` mappings, session config, `secret`, and `trustedOrigins` unchanged.

```ts
socialProviders: {
    google: {
        clientId: (() => {
            const id = import.meta.env?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
            if (!id && (import.meta.env?.PROD || process.env.NODE_ENV === 'production')) {
                throw new Error('GOOGLE_CLIENT_ID must be set in production environment');
            }
            return id || '';
        })(),
        clientSecret: (() => {
            const secret = import.meta.env?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
            if (!secret && (import.meta.env?.PROD || process.env.NODE_ENV === 'production')) {
                throw new Error('GOOGLE_CLIENT_SECRET must be set in production environment');
            }
            return secret || '';
        })(),
    },
},
```

### 2. Client — `apps/web/src/lib/auth-client.ts`

- Drop the `signUp` export (no longer used). Keep `signIn` (used as `signIn.social`),
  `signOut`, `useSession`.

### 3. Single auth page

- **`apps/web/src/pages/[locale]/login.astro`**: replace the email/password form and the
  "Sign up here" link with a single **"Continue with Google"** button. Client script:

  ```ts
  import { signIn } from '../../lib/auth-client';
  await signIn.social({ provider: 'google', callbackURL: `/${locale}/` });
  ```

  On error, show `login.signInError`. Preserve the existing ocean/glassmorphism styling and
  back button. Remove the `login-translations` payload keys that are no longer referenced
  (keep only what the page uses).

- **`apps/web/src/pages/[locale]/signup.astro`**: replace the whole page body with a redirect:
  `return Astro.redirect(`/${locale}/login`)`. The `pages/zh/signup.astro` proxy is
  auto-generated by `scripts/generate-zh-proxy-pages.ts` and regenerates on `dev`/`build` —
  **do not edit it by hand**.

### 4. Profile page — `apps/web/src/pages/[locale]/profile.astro`

- Remove the "Change Password" `<form>` section and its client `<script>` block (and the
  `profile-translations` payload it depends on).
- Keep the read-only name/email display, the "Back to Menu" button, and decorative elements.
- (Optional, out of scope: a "Signed in with Google" indicator.)

### 5. Removals

- Delete `apps/web/src/pages/api/auth/change-password.ts`.
- Delete `apps/web/src/pages/api/__tests__/change-password.test.ts` and
  `apps/web/src/pages/api/__tests__/change-password-cleanup.test.ts`.
- Remove `AccountRepository.findCredentialAccount` and `AccountRepository.updatePassword`
  from `apps/web/src/lib/drizzle/repositories.ts`, plus their cases in
  `apps/web/src/lib/drizzle/__tests__/repositories.test.ts`.
- Remove the `bcryptjs` dependency from `apps/web/package.json` and the bcrypt mock in
  `apps/web/src/lib/test-setup.ts` (bcrypt is only used by change-password).
- **Schema untouched** — no Drizzle migration. The `accounts.password` column and
  `verification_tokens` table remain (Better Auth's account model includes them).

### 6. Environment & Google Cloud setup

New env vars (web app):

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 Web client secret |

Existing vars that remain relevant: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
`PUBLIC_AUTH_URL`, `TRUSTED_ORIGINS`, `DATABASE_URL`.

Add the two new vars (names only, no values) to the root `.env.example`.

**Google Cloud Console setup (documented manual steps):**

1. Create (or select) a Google Cloud project.
2. Configure the **OAuth consent screen** (External; app name, support email, scopes:
   `email`, `profile`, `openid`).
3. Create credentials → **OAuth client ID** → application type **Web application**.
4. **Authorized JavaScript origins:** `http://localhost:5090` (dev) and the production origin.
5. **Authorized redirect URIs:** `{BETTER_AUTH_URL}/api/auth/callback/google` for each
   environment — e.g. `http://localhost:5090/api/auth/callback/google` (dev) and the
   production equivalent.
6. Copy the generated Client ID and Client Secret into `GOOGLE_CLIENT_ID` /
   `GOOGLE_CLIENT_SECRET` for local dev, CI, and Vercel.

### 7. Translations — `packages/stories/src/translations/{en,zh}.json`

- **Add:** `login.continueWithGoogle`, `login.signInError`.
- **Remove** the now-dead email/password keys under `login`: `email`, `emailPlaceholder`,
  `password`, `passwordPlaceholder`, `name`, `namePlaceholder`, `loginButton`,
  `signupButton`, `description`, `loginFailed`, `invalidCredentials`, `signupFailed`,
  `emailRequired`, `nameRequired`, `missingRequiredFields`, `emailAlreadyInUse`,
  `dbConnectionError`, `internalServerError`, `signupFailedRetry`. Keep `title`/`heading`
  if still referenced; otherwise prune.
- Keep `common.login` / `common.logout`. Apply identical key changes to both `en` and `zh`.
- Remove any `profile.*` password-change keys no longer referenced (`passwordChanged`,
  `failedPasswordChange`, `networkError`, `changePassword`, `currentPassword`, `newPassword`,
  `confirmPassword`, `updatePassword`).

### 8. Tests

- `apps/web/src/lib/__tests__/auth.test.ts`: assert Google social provider is configured and
  email/password is not enabled.
- `apps/web/src/lib/__tests__/auth-env.test.ts`: cover the new production guard for missing
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- `apps/web/src/lib/__tests__/auth-client.test.ts`: drop assertions on the removed `signUp`
  export.
- `packages/e2e/tests/simple-auth-e2e.spec.ts`: replace the email/password flow with assertions
  that the "Continue with Google" button renders and that activating it navigates toward
  Google's OAuth endpoint (`accounts.google.com` / the `/api/auth/sign-in/social` redirect).
  **Do not** automate the external Google consent screen.

## Verification

- `bun --filter web test` (unit) and `bun lint` pass.
- `bun build` succeeds (no references to removed exports/keys/files).
- Manual: with real Google creds set, `bun dev` → `/en/login` → "Continue with Google" →
  Google consent → redirected back to `/en/` as an authenticated user; session visible in
  the header; logout works.

## Risks / Notes

- **Redirect URI mismatch** is the most common OAuth failure — the callback URI registered in
  Google Cloud must exactly match `{BETTER_AUTH_URL}/api/auth/callback/google` per environment.
- Without Google creds set locally, sign-in cannot complete; the production guard prevents
  shipping an unconfigured build.
