# Data Model: Supabase Auth Integration (Shared Supabase Project)

## Overview

This feature introduces a clear separation between **identity** (managed by Supabase) and **application data** (managed by the existing Cockroach/Postgres database via Drizzle). The main change is to link Aquila's `Application User` records to Supabase user identities.

## Entities

### Supabase Identity (external)

- **Source**: Existing shared Supabase project used by multiple applications.
- **Key fields used by Aquila** (conceptual, not stored in our DB):
  - `id` (UUID): Stable Supabase user identifier.
  - `email` (string): User's email address.
  - `email_confirmed_at` / equivalent (timestamp): Used to gate certain flows if needed.
  - `created_at` (timestamp): When the Supabase user was created.
- **Relationships**:
  - 1:1 with Aquila `Application User` (enforced by unique `supabaseUserId` on the Aquila side).

### Application User (Aquila)

- **Storage**: Existing Cockroach/Postgres database via Drizzle.
- **Purpose**: Represents a player within Aquila, including game-related and profile data.
- **Key fields (logical view)**:
  - `id` (UUID): Primary key for Aquila user.
  - `supabaseUserId` (UUID, not null, unique): Foreign key-style reference to Supabase Identity `id`.
  - `displayName` (string, optional): Player-facing name (source of truth in app DB).
  - `avatarUrl` (string, optional): Profile image reference if supported.
  - `locale` (string, optional): Preferred locale for translations.
  - `createdAt` (timestamp): When the Aquila user record was created.
  - `updatedAt` (timestamp): Last update timestamp.
  - `...existing game/profile fields...`: Any additional columns already defined in the Drizzle schema (progress, settings, etc.).
- **Relationships**:
  - 1:1 with Supabase Identity via `supabaseUserId`.
  - 1:N with other game-domain entities (progress, saves, etc.) as already modeled in the schema.

## Validation Rules

- `supabaseUserId` **MUST** be present for any authenticated `Application User` and **MUST** be unique.
- On sign-in, Aquila MUST NOT create a second `Application User` row for the same `supabaseUserId`.
- Email uniqueness and password rules are delegated to Supabase; Aquila does not store or validate passwords directly.
- Profile fields stored in Aquila (e.g., `displayName`, `avatarUrl`, `locale`) are validated according to existing UI and domain rules (length limits, allowed formats, etc.).

## State Transitions

### First successful sign-in to Aquila

1. Supabase authenticates the user and returns a valid session containing the Supabase user ID.
2. Aquila checks for an `Application User` row with `supabaseUserId = <Supabase user ID>`.
3. If **found**, that row is used as the current player identity.
4. If **not found**, Aquila creates a new `Application User` row with:
   - A new `id`.
   - `supabaseUserId` set to the Supabase user ID.
   - Any default profile/game fields (e.g., initial progress, default locale).

### Subsequent sign-ins

1. Supabase authenticates the user and returns the same Supabase user ID.
2. Aquila loads the existing `Application User` row by `supabaseUserId`.
3. No new `Application User` row is created; relationships to game data remain stable.

### Sign-out

- Supabase session is cleared via the SDK or a dedicated sign-out endpoint.
- Aquila clears any cached client-side state that depends on the authenticated user.
- No database changes are required for sign-out.

### Out of scope for this feature

- Account deletion or merging.
- Migration of legacy-auth users into Supabase.
- Cross-application profile synchronization beyond sharing the Supabase identity.
