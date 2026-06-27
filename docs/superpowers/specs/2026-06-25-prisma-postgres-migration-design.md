# CockroachDB → Prisma Postgres Migration — Design

**Date:** 2026-06-25
**Status:** Approved (design); pending spec review
**Branch context:** Work currently sits on `google-only-auth` (the deployed preview). Implementation branches from there (or main) — decided at planning time.

## Goal

Move Aquila's web app off CockroachDB onto **Prisma Postgres** (the managed
Postgres database provisioned via the Vercel Marketplace integration), **keeping
Drizzle ORM**. Only the Postgres endpoint changes; the ORM, schema, migrations,
and Better Auth Drizzle adapter stay.

## Decision

"Migrate to Prisma Postgres" means swapping the **database**, not the ORM. Prisma
Postgres exposes a standard direct `postgres://` TCP connection string (GA since
2025-06-05, "connect with any ORM"), and the Vercel integration sets it as a
`postgres://...` value — Drizzle + `pg` connect to it unchanged. Adopting Prisma
ORM was explicitly rejected (large rewrite, no benefit here).

A side benefit: Prisma Postgres is vanilla PostgreSQL, so the CockroachDB
pre-release-dialect hazard disappears and `drizzle-kit migrate` runs normally
without any opt-in flag.

## Current State (facts established during brainstorming)

- `apps/web/src/lib/drizzle/db.ts`: lazy `pg` `Pool` via `drizzle('node-postgres')`.
  Reads `process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL`. SSL is enabled
  **only** when `NODE_ENV==='production'` (or `DB_ALLOW_SELF_SIGNED`).
- `apps/web/drizzle.config.ts`: `dialect: 'postgresql'`, `url: process.env.DATABASE_URL!`.
- Migrations: `apps/web/src/lib/drizzle/migrations/{0000_wild_vance_astro,0001_parched_colleen_wing,0002_wide_azazel}.sql` — plain Postgres DDL (auth tables `users`, `sessions`, `accounts`, `verification_tokens` + app tables).
- `apps/web/scripts/drizzle-migrate-safe.mjs`: wraps `drizzle-kit migrate`, **blocks** when the URL looks like CockroachDB (`cockroach`/`26257`/`crdb`) unless `ALLOW_COCKROACH_MIGRATIONS=true`.
- `apps/web/scripts/__tests__/drizzle-migrate-safe.test.ts`: tests the guard (`describe('CockroachDB URL detection')`, 6 tests) **and** the spawnSync result handling (separate block).
- `apps/web/src/lib/drizzle/run-migration.ts`: standalone manual migration runner (not wired into package.json scripts). Logs "Connecting to CockroachDB…"; in production builds SSL from a **CA file** at `DB_CA_PATH` — a CockroachDB-Cloud assumption that is wrong for Prisma Postgres (publicly-trusted certs).
- `apps/web/package.json` scripts: `drizzle:migrate` → the safe script; `drizzle:migrate:allow-cockroach` → the same with the flag; `dev:db` → echoes CockroachDB start instructions.
- Vercel project `cwchanaps-projects/aquila`: the Prisma integration provisioned **Sensitive** env vars `aquila_DATABASE_URL`, `aquila_POSTGRES_URL`, `aquila_PRISMA_DATABASE_URL` (Production + Preview). `aquila_PRISMA_DATABASE_URL` is the `prisma+postgres://` Accelerate URL; the other two are `postgres://` direct/pooled strings. Being Sensitive, `vercel env pull` returns them empty.
- CockroachDB references also live in `CLAUDE.md` and `README.md`.

## Architecture

Unchanged data path: Astro SSR → Better Auth (Drizzle adapter) → Drizzle ORM →
`pg` `Pool` → Postgres. The endpoint swap forces four kinds of change:
connection-string resolution, TLS, applying migrations to the new DB, and removal
of now-dead CockroachDB scaffolding.

## Changes

### 1. Connection-string resolution — `db.ts`

Resolve at runtime, in order:
`process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.aquila_DATABASE_URL ?? process.env.aquila_POSTGRES_URL`
(then existing `import.meta.env` fallback). All Vercel env vars are available on
`process.env` at runtime, so this picks up the integration's prefixed var with no
dashboard changes and no secret copying. Throw the same "DATABASE_URL … not set"
error if none resolve. Local `.env` continues to use plain `DATABASE_URL`.

### 2. TLS — `db.ts`

Prisma Postgres requires TLS with a publicly-trusted certificate. Change the SSL
logic so SSL is enabled (`{ rejectUnauthorized: true }`) whenever the resolved
connection string requires it — detect via `sslmode=require` in the string, or a
non-`localhost` host — independent of `NODE_ENV`. `localhost`/insecure stays
SSL-off for local CockroachDB-free dev. `DB_ALLOW_SELF_SIGNED=true` still forces
`rejectUnauthorized: false` for edge cases. This unblocks local dev against the
remote Prisma Postgres DB.

### 3. Migrations

The three existing migrations apply unchanged (plain Postgres). Run
`bun --filter web drizzle:migrate` with `DATABASE_URL` set to the Prisma Postgres
string (local `.env` or CI env), creating all auth + app tables on the fresh DB.
Prefer the **direct** (non-pooled) string for the migration run if the integration
exposes both; pooled otherwise. Pooled-vs-direct is identified at implementation
time by host (`db.prisma.io` direct vs `*pooled*.prisma.io`).

### 4. Remove CockroachDB scaffolding

- `drizzle-migrate-safe.mjs`: delete the cockroach-signature guard and the
  `ALLOW_COCKROACH_MIGRATIONS` branch; keep it as a thin wrapper around
  `drizzle-kit migrate --config …` (still centralizes the config path).
- `drizzle-migrate-safe.test.ts`: delete the `CockroachDB URL detection` describe
  block; keep the `spawnSync result handling` block (adjust only if the wrapper's
  exit semantics change).
- `apps/web/package.json`: remove `drizzle:migrate:allow-cockroach`. Update
  `dev:db` to drop the CockroachDB start instructions (point at Prisma Postgres /
  remove). Root `package.json` already lacks the allow-cockroach script.
- `run-migration.ts`: replace the CockroachDB-specific TLS (`DB_CA_PATH` CA-file)
  and the "Connecting to CockroachDB…" log with Prisma-Postgres-appropriate TLS
  (publicly-trusted cert, `rejectUnauthorized: true`, SSL on for remote). If
  confirmed unused, removing it is acceptable instead.
- `.env.example`: replace the CockroachDB block (`26257`, `verify-full`, local
  single-node note) with a Prisma Postgres `postgres://…?sslmode=require` example.
- `apps/web/.env` (gitignored, local): replace the CockroachDB `DATABASE_URL` with
  the Prisma Postgres string.
- `CLAUDE.md` and `README.md`: replace CockroachDB references with Prisma Postgres
  (managed Postgres); drop the `ALLOW_COCKROACH_MIGRATIONS` / pre-release-dialect
  warnings and the `bun dev:db` CockroachDB instructions.

### 5. Vercel env wiring

No dashboard change required: the app's resolution chain reads
`aquila_DATABASE_URL` at runtime on both Preview and Production. (Optional future
tidy-up — renaming the integration's env-var prefix to expose plain
`DATABASE_URL` — is out of scope.)

## External Dependency

The three Prisma vars are Sensitive → unreadable via CLI. To run migrations and
populate local `.env`, the user supplies the Prisma Postgres connection
string(s) from the Vercel dashboard (Storage → the Prisma Postgres store →
connection details / `.env`): the pooled `DATABASE_URL` and, if shown, the direct
URL. Nothing on Vercel needs the cleartext value.

## Error Handling

- Missing connection string → existing explicit throw (unchanged message).
- TLS failure against remote DB → surfaced by `pg`; mitigated by enabling SSL for
  remote hosts (change #2).
- Migration applied to a fresh DB is idempotent via drizzle-kit's
  `__drizzle_migrations` ledger; re-running is safe.

## Testing / Verification

1. `bun --filter web test` (unit) green — including the trimmed migrate-safe test.
2. `bun lint` clean.
3. `bun --filter web drizzle:migrate` succeeds against Prisma Postgres; verify the
   expected tables exist (`users`, `sessions`, `accounts`, `verification_tokens`, app tables).
4. Local `bun dev` → `GET /api/auth/get-session` returns non-503.
5. Preview redeploy → `GET /api/auth/get-session` returns non-503.

## Out of Scope

- Adopting Prisma ORM / Prisma Client / Accelerate query caching.
- Merging the `google-only-auth` branch.
- Renaming the Vercel integration's env-var prefix.
- Production cutover/promotion beyond verifying preview works.

## Open Questions (resolved at implementation time, not blocking)

- Which of `aquila_DATABASE_URL` / `aquila_POSTGRES_URL` is pooled vs direct —
  determined by host inspection once the user provides the strings.
