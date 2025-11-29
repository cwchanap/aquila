# Research: Supabase Auth Integration (Shared Supabase Project)

## Decision 1: Use Supabase Auth with `@supabase/supabase-js`

- **Decision**: Use the official `@supabase/supabase-js` client library to integrate the Aquila web app with the shared Supabase project. Use cookie-based sessions where possible and rely on Supabase-managed email/password auth flows.
- **Rationale**:
  - Aligns with Supabase best practices and reduces custom auth code.
  - Allows other applications that already use the same Supabase project to share identities with Aquila.
  - Offloads password handling, email verification, and session management to Supabase.
- **Alternatives considered**:
  - **Custom JWT auth backed by Supabase tables**: Rejected because it would re-implement auth primitives that Supabase already provides and complicate integration with other apps.
  - **Keeping Better Auth and syncing to Supabase**: Rejected because it would require complex two-way synchronization and would not provide a single shared identity across apps.

## Decision 2: Application User linked to Supabase user ID

- **Decision**: Represent Aquila-specific user data in an `Application User` record stored in the existing Cockroach/Postgres database and link it 1:1 to a Supabase user via a `supabaseUserId` field.
- **Rationale**:
  - Keeps game and profile data in the existing database, consistent with the constitution and feature spec.
  - Enables simple authorization checks based on the Supabase user ID as the primary identity.
  - Avoids duplication of Supabase-managed data (passwords, verification state) in the application database.
- **Alternatives considered**:
  - **Storing game data directly in Supabase tables**: Rejected because the project already uses Cockroach/Postgres and Drizzle as the source of truth for application data.
  - **Using email as the only link**: Rejected due to potential collisions or changes in email, and because Supabase exposes a stable user identifier that is better suited as a foreign key.

## Decision 3: Email/password only for initial rollout

- **Decision**: Support Supabase's default email/password auth (with Supabase-managed email verification and password reset) as the only identity method in scope for this feature.
- **Rationale**:
  - Keeps the initial integration small and testable.
  - Matches the requirement that Supabase is used only for auth, without adding social providers yet.
  - Simplifies UX and error handling for the first iteration.
- **Alternatives considered**:
  - **Adding social login providers (e.g., Google, Apple)**: Rejected for this feature to avoid expanding scope, UI variants, and edge cases. Can be added later as a separate feature.
  - **Magic-link-only passwordless auth**: Rejected for now because it changes user expectations and depends heavily on email deliverability; email/password is a more conservative initial choice.

## Decision 4: Integrate with existing shared Supabase users without migration

- **Decision**: Treat the existing Supabase user table as the canonical identity store for all apps in the shared project and integrate Aquila with those users as-is. Aquila creates or loads its own `Application User` record on first successful sign-in but does not migrate or alter Supabase identity records.
- **Rationale**:
  - Matches the requirement that there is already an existing shared Supabase user table used by other apps.
  - Avoids risky production data migration work for auth identities.
  - Keeps Aquila's responsibility focused on its own domain data in Cockroach/Postgres.
- **Alternatives considered**:
  - **Running a one-time migration from a legacy auth system into Supabase**: Explicitly out of scope for this feature and would add significant operational risk.
  - **Forking to a separate Supabase project just for Aquila**: Rejected because it would break the shared identity model across apps.

## Decision 5: Minimal server-side contracts on top of Supabase

- **Decision**: Keep the server-side API surface for auth minimal and focused on mapping Supabase sessions to `Application User` records (for example, `GET /api/me` and a sign-out endpoint), while letting Supabase handle signup/signin endpoints directly.
- **Rationale**:
  - Reduces the amount of custom auth-related API surface area to maintain.
  - Keeps the Aquila codebase focused on its own domain concerns (mapping identities to game data) rather than duplicating Supabase endpoints.
- **Alternatives considered**:
  - **Building a complete façade over all Supabase auth endpoints**: Rejected for now to limit scope and avoid becoming a pass-through layer that must constantly track Supabase API changes.
