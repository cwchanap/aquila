# CockroachDB → Prisma Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Aquila's web app off CockroachDB onto Prisma Postgres while keeping Drizzle ORM, the schema, the migrations, and the Better Auth Drizzle adapter unchanged.

**Architecture:** Only the Postgres endpoint changes. A new pure helper module (`connection.ts`) centralizes connection-string resolution (so the app picks up the Vercel integration's prefixed env var) and TLS policy (so SSL is on for remote hosts, not just production). Both `db.ts` (runtime) and `run-migration.ts` (manual migrator) consume it. The CockroachDB-specific migrate guard, scripts, and docs are removed. Migrations then run against Prisma Postgres via the existing `drizzle:migrate`.

**Tech Stack:** Astro SSR, Drizzle ORM (`drizzle-orm@^0.33`), `pg@^8`, `drizzle-kit@^0.24`, Better Auth (Drizzle adapter), Vitest, Bun workspaces + Turbo.

## Global Constraints

- Keep Drizzle ORM. Do NOT adopt Prisma ORM / Prisma Client / Accelerate. Prisma Postgres is treated as vanilla PostgreSQL.
- Connection-string resolution order (runtime, `db.ts`): `DATABASE_URL` → `POSTGRES_URL` → `aquila_DATABASE_URL` → `aquila_POSTGRES_URL`, then the existing `import.meta.env.DATABASE_URL` fallback.
- TLS policy (`resolveSsl`): SSL enabled (`{ rejectUnauthorized: !allowSelfSigned }`) when ANY of: `NODE_ENV==='production'`, `DB_ALLOW_SELF_SIGNED==='true'`, the connection string contains `sslmode=require`, or the host is non-local. Otherwise `false`. Local hosts = `localhost`, `127.0.0.1`, `::1`.
- Preserve the exact missing-connection error message: `DATABASE_URL environment variable is not set`.
- All `bun --filter web test` and `bun lint` must stay green. No `innerHTML`. Add new translation keys to both locales (N/A here — no UI text).
- Out of scope: merging `google-only-auth`, renaming the Vercel env-var prefix, production promotion beyond verifying preview.

---

### Task 1: Connection + TLS helper, wired into `db.ts`

**Files:**
- Create: `apps/web/src/lib/drizzle/connection.ts`
- Create: `apps/web/src/lib/drizzle/__tests__/connection.test.ts`
- Modify: `apps/web/src/lib/drizzle/db.ts`
- Modify: `apps/web/src/lib/drizzle/__tests__/db.test.ts` (add env keys to save list + new SSL/resolution tests)

**Interfaces:**
- Produces:
  - `resolveConnectionString(env?: NodeJS.ProcessEnv): string | undefined`
  - `resolveSsl(connectionString: string, env?: NodeJS.ProcessEnv): boolean | { rejectUnauthorized: boolean }`
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write failing tests for `connection.ts`**

Create `apps/web/src/lib/drizzle/__tests__/connection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveConnectionString, resolveSsl } from '../connection';

describe('resolveConnectionString', () => {
    it('prefers DATABASE_URL above all', () => {
        expect(
            resolveConnectionString({
                DATABASE_URL: 'postgres://a/db',
                POSTGRES_URL: 'postgres://b/db',
                aquila_DATABASE_URL: 'postgres://c/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://a/db');
    });

    it('falls back to POSTGRES_URL when DATABASE_URL is unset', () => {
        expect(
            resolveConnectionString({
                POSTGRES_URL: 'postgres://b/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://b/db');
    });

    it('falls back to aquila_DATABASE_URL then aquila_POSTGRES_URL', () => {
        expect(
            resolveConnectionString({
                aquila_DATABASE_URL: 'postgres://c/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://c/db');
        expect(
            resolveConnectionString({
                aquila_POSTGRES_URL: 'postgres://d/db',
            } as NodeJS.ProcessEnv)
        ).toBe('postgres://d/db');
    });

    it('returns undefined when none are set or all empty', () => {
        expect(resolveConnectionString({} as NodeJS.ProcessEnv)).toBeUndefined();
        expect(
            resolveConnectionString({ DATABASE_URL: '' } as NodeJS.ProcessEnv)
        ).toBeUndefined();
    });
});

describe('resolveSsl', () => {
    const local = 'postgres://localhost:5432/aquila';
    const remote = 'postgres://u:p@db.prisma.io:5432/postgres';
    const remoteSslMode = 'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require';

    it('returns false for a local host in dev with no flags', () => {
        expect(resolveSsl(local, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(
            false
        );
    });

    it('enables verifying SSL for a remote host even outside production', () => {
        expect(
            resolveSsl(remote, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('enables verifying SSL when the string carries sslmode=require', () => {
        expect(
            resolveSsl(remoteSslMode, { NODE_ENV: 'test' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('enables verifying SSL in production for a local host', () => {
        expect(
            resolveSsl(local, { NODE_ENV: 'production' } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: true });
    });

    it('disables verification when DB_ALLOW_SELF_SIGNED=true (even local/dev)', () => {
        expect(
            resolveSsl(local, {
                NODE_ENV: 'development',
                DB_ALLOW_SELF_SIGNED: 'true',
            } as NodeJS.ProcessEnv)
        ).toEqual({ rejectUnauthorized: false });
    });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bun --filter web test src/lib/drizzle/__tests__/connection.test.ts`
Expected: FAIL — `Cannot find module '../connection'`.

- [ ] **Step 3: Implement `connection.ts`**

Create `apps/web/src/lib/drizzle/connection.ts`:

```typescript
export type SslConfig = boolean | { rejectUnauthorized: boolean };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * Resolve the Postgres connection string, preferring the canonical
 * DATABASE_URL but falling back to the names the Vercel Prisma Postgres
 * integration provisions (which carry a project prefix). Returns the first
 * non-empty value, or undefined.
 */
export function resolveConnectionString(
    env: NodeJS.ProcessEnv = process.env
): string | undefined {
    return (
        env.DATABASE_URL ||
        env.POSTGRES_URL ||
        env.aquila_DATABASE_URL ||
        env.aquila_POSTGRES_URL ||
        undefined
    );
}

function isRemoteHost(connectionString: string): boolean {
    try {
        const host = new URL(connectionString).hostname.toLowerCase();
        if (!host) return false;
        return !LOCAL_HOSTS.has(host);
    } catch {
        return false;
    }
}

/**
 * Decide the `pg` SSL config. SSL is enabled whenever the target requires it:
 * production, an explicit `sslmode=require`, a remote (non-local) host, or
 * DB_ALLOW_SELF_SIGNED. Local/insecure connections stay SSL-off.
 */
export function resolveSsl(
    connectionString: string,
    env: NodeJS.ProcessEnv = process.env
): SslConfig {
    const allowSelfSigned = env.DB_ALLOW_SELF_SIGNED === 'true';
    const isProduction = env.NODE_ENV === 'production';
    const requiresSsl =
        allowSelfSigned ||
        isProduction ||
        /sslmode=require/i.test(connectionString) ||
        isRemoteHost(connectionString);

    if (!requiresSsl) {
        return false;
    }
    return { rejectUnauthorized: !allowSelfSigned };
}
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bun --filter web test src/lib/drizzle/__tests__/connection.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Refactor `db.ts` to use the helpers**

Replace the body of `getDb()` in `apps/web/src/lib/drizzle/db.ts`. Full new file:

```typescript
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { resolveConnectionString, resolveSsl } from './connection';

// Lazy-load db instance to avoid loading before env vars are available
let _db: NodePgDatabase<typeof schema> | null = null;

function getDb() {
    if (!_db) {
        const connectionString =
            resolveConnectionString() ??
            (typeof import.meta !== 'undefined'
                ? import.meta.env?.DATABASE_URL
                : undefined);

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is not set');
        }

        const poolMaxEnv = process.env.DB_POOL_MAX;
        const parsedPoolMax = poolMaxEnv
            ? Number.parseInt(poolMaxEnv, 10)
            : NaN;
        const poolMax =
            !Number.isNaN(parsedPoolMax) && parsedPoolMax > 0
                ? parsedPoolMax
                : 10;

        // Create PostgreSQL connection pool
        const pool = new Pool({
            connectionString,
            ssl: resolveSsl(connectionString),
            max: poolMax,
        });

        // Create Drizzle DB instance
        _db = drizzle(pool, { schema });
    }

    return _db;
}

// Export db instance via getter
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
    get(_, prop) {
        const dbInstance = getDb();
        return dbInstance[prop as keyof typeof dbInstance];
    },
});

// Type export
export type DrizzleDB = NodePgDatabase<typeof schema>;
```

- [ ] **Step 6: Extend `db.test.ts` save-list and add coverage**

In `apps/web/src/lib/drizzle/__tests__/db.test.ts`, add the new env keys to the `beforeEach` save loop so they don't leak between tests. Change the key array (around line 22) to:

```typescript
        for (const key of [
            'DATABASE_URL',
            'POSTGRES_URL',
            'aquila_DATABASE_URL',
            'aquila_POSTGRES_URL',
            'NODE_ENV',
            'DB_ALLOW_SELF_SIGNED',
            'DB_POOL_MAX',
        ]) {
```

Then append these tests inside the `describe('Database module (db.ts)')` block (the Pool/drizzle mocks already exist):

```typescript
    it('falls back to POSTGRES_URL when DATABASE_URL is unset', async () => {
        delete process.env.DATABASE_URL;
        process.env.POSTGRES_URL = 'postgres://localhost/fallbackdb';
        process.env.NODE_ENV = 'test';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString: 'postgres://localhost/fallbackdb',
            })
        );
    });

    it('falls back to aquila_DATABASE_URL when DATABASE_URL and POSTGRES_URL are unset', async () => {
        delete process.env.DATABASE_URL;
        delete process.env.POSTGRES_URL;
        process.env.aquila_DATABASE_URL = 'postgres://localhost/prismadb';
        process.env.NODE_ENV = 'test';

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString: 'postgres://localhost/prismadb',
            })
        );
    });

    it('enables verifying SSL for a remote host outside production', async () => {
        process.env.DATABASE_URL =
            'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require';
        process.env.NODE_ENV = 'test';
        delete process.env.DB_ALLOW_SELF_SIGNED;

        const { db } = await import('../db');
        void (db as unknown as Record<string, unknown>).select;

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({ ssl: { rejectUnauthorized: true } })
        );
    });
```

- [ ] **Step 7: Run the full web suite**

Run: `bun --filter web test src/lib/drizzle/__tests__/connection.test.ts src/lib/drizzle/__tests__/db.test.ts`
Expected: PASS — all existing db.test.ts tests still green (localhost SSL=false and DB_ALLOW_SELF_SIGNED cases unchanged) plus the new ones.

- [ ] **Step 8: Lint**

Run: `bun --filter web lint`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/drizzle/connection.ts apps/web/src/lib/drizzle/db.ts apps/web/src/lib/drizzle/__tests__/connection.test.ts apps/web/src/lib/drizzle/__tests__/db.test.ts
git commit -m "feat(db): connection-string + TLS resolution for Prisma Postgres"
```

---

### Task 2: Repoint `run-migration.ts` TLS to Prisma Postgres

**Files:**
- Modify: `apps/web/src/lib/drizzle/run-migration.ts`
- Modify: `apps/web/src/lib/drizzle/__tests__/run-migration.test.ts`

**Interfaces:**
- Consumes: `resolveSsl(connectionString, env?)` from `./connection` (Task 1).
- Produces: nothing for later tasks.

- [ ] **Step 1: Update the test for the new SSL behavior (red)**

In `apps/web/src/lib/drizzle/__tests__/run-migration.test.ts`:

1. Remove `'DB_CA_PATH'` from the `savedEnv` key array (line ~38) so it reads `['DATABASE_URL', 'NODE_ENV']`.
2. Delete the test `'creates Pool with ssl.ca object in production when DB_CA_PATH is set'` (lines ~224-246).
3. Delete the test `'throws when in production and DB_CA_PATH is not set (lines 40-43)'` (lines ~418-432).
4. Add this test next to the existing `'creates Pool with ssl=false in non-production'` test:

```typescript
    it('creates Pool with verifying SSL for a remote sslmode=require connection', async () => {
        process.env.DATABASE_URL =
            'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require';
        process.env.NODE_ENV = 'test';

        mockReaddirSync.mockReturnValue([]);
        mockQuery.mockResolvedValue({ rows: [] });

        await import('../run-migration');

        expect(mockPoolConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                connectionString:
                    'postgres://u:p@db.prisma.io:5432/postgres?sslmode=require',
                ssl: { rejectUnauthorized: true },
                max: 1,
            })
        );
    });
```

- [ ] **Step 2: Run the test, verify the new test fails**

Run: `bun --filter web test src/lib/drizzle/__tests__/run-migration.test.ts`
Expected: FAIL — the remote-SSL test fails because `run-migration.ts` still builds `ssl` from `DB_CA_PATH`/`false`.

- [ ] **Step 3: Update `run-migration.ts`**

In `apps/web/src/lib/drizzle/run-migration.ts`:

1. Add the import near the top (after the existing imports):

```typescript
import { resolveSsl } from './connection';
```

2. Replace the SSL block (the `console.log('🔗 Connecting to CockroachDB...')` line and the entire `let ssl ... ` / `if (process.env.NODE_ENV === 'production') { ... }` block, currently lines ~34-46) with:

```typescript
    console.log('🔗 Connecting to Postgres...');

    const ssl = resolveSsl(connectionString);
```

Leave the `Pool({ connectionString, ssl, max: 1 })` construction, the `readFileSync`/`readdirSync` imports, and everything else unchanged. (`readFileSync` is still used to read migration `.sql` files.)

- [ ] **Step 4: Run the test, verify it passes**

Run: `bun --filter web test src/lib/drizzle/__tests__/run-migration.test.ts`
Expected: PASS — remote-SSL test green; `ssl=false` non-production test still green; the two DB_CA_PATH tests are gone.

- [ ] **Step 5: Lint**

Run: `bun --filter web lint`
Expected: clean (no unused `DB_CA_PATH`/CA references remain).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/drizzle/run-migration.ts apps/web/src/lib/drizzle/__tests__/run-migration.test.ts
git commit -m "refactor(db): use shared TLS resolver in run-migration, drop CockroachDB CA path"
```

---

### Task 3: Remove the CockroachDB guard from the migrate wrapper

**Files:**
- Modify: `apps/web/scripts/drizzle-migrate-safe.mjs`
- Modify: `apps/web/scripts/__tests__/drizzle-migrate-safe.test.ts`

**Interfaces:**
- Consumes: nothing. Produces: nothing.

- [ ] **Step 1: Trim the test (red/cleanup)**

In `apps/web/scripts/__tests__/drizzle-migrate-safe.test.ts`:

1. Update the file header comment: replace "optionally blocks on CockroachDB detection, then always calls spawnSync + process.exit" with "is a thin wrapper that calls spawnSync(drizzle-kit migrate) + process.exit".
2. Delete the entire `describe('CockroachDB URL detection', () => { ... })` block (the 6 tests, lines ~83-148).
3. In `beforeEach`/`afterEach`, remove the `originalAllowCockroachMigrations` declaration, its save (`originalAllowCockroachMigrations = process.env.ALLOW_COCKROACH_MIGRATIONS;`), the `delete process.env.ALLOW_COCKROACH_MIGRATIONS;` line, and its restore block. Keep the `process.exit`/`console.error` spies and `vi.resetModules()` / `vi.clearAllMocks()`. The `DATABASE_URL` default set and save/restore may stay (harmless — the wrapper no longer reads it).
4. Keep the entire `describe('spawnSync result handling', ...)` block unchanged.

- [ ] **Step 2: Run the test, verify the suite shape**

Run: `bun --filter web test scripts/__tests__/drizzle-migrate-safe.test.ts`
Expected: The `spawnSync result handling` tests run. They currently still pass against the old script (the old script also spawns), so this step's purpose is confirming no leftover references to the deleted block. If any test references `ALLOW_COCKROACH_MIGRATIONS`, remove it.

- [ ] **Step 3: Simplify the script**

Replace `apps/web/scripts/drizzle-migrate-safe.mjs` entirely with:

```javascript
#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { console } = globalThis;

const drizzleConfig = resolve(__dirname, '../drizzle.config.ts');
const result = spawnSync(
  'bunx',
  ['drizzle-kit', 'migrate', '--config', drizzleConfig],
  {
    stdio: 'inherit',
    env: process.env,
  }
);

if (result.error) {
  console.error('\n❌ Failed to spawn drizzle-kit migrate:', result.error);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `bun --filter web test scripts/__tests__/drizzle-migrate-safe.test.ts`
Expected: PASS — `spawnSync result handling` tests all green; `spawnSync` is still called with `['drizzle-kit', 'migrate', '--config', <…drizzle.config.ts>]` and `{ stdio: 'inherit', env: process.env }`.

- [ ] **Step 5: Lint**

Run: `bun --filter web lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/scripts/drizzle-migrate-safe.mjs apps/web/scripts/__tests__/drizzle-migrate-safe.test.ts
git commit -m "chore(db): drop CockroachDB guard from drizzle migrate wrapper"
```

---

### Task 4: Purge CockroachDB references from config and docs

**Files:**
- Modify: `apps/web/package.json`
- Modify: `.env.example`
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:** none.

- [ ] **Step 1: `apps/web/package.json`**

- Delete the script line `"drizzle:migrate:allow-cockroach": "ALLOW_COCKROACH_MIGRATIONS=true node ./scripts/drizzle-migrate-safe.mjs",`.
- Replace the `dev:db` script value with:
  `"dev:db": "echo 'Prisma Postgres is managed remotely — no local DB to start. Set DATABASE_URL to your Prisma Postgres connection string (Vercel → Storage).'"`

- [ ] **Step 2: `.env.example`**

Replace the whole CockroachDB-oriented database section (the `# CockroachDB Database Configuration` heading through the connection-pool note block) with:

```bash
# Database Configuration — Prisma Postgres (PostgreSQL-compatible)
# Connection string from Vercel → Storage → your Prisma Postgres store.
DATABASE_URL=postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require

# Allow self-signed SSL certificates (set "true" only for non-production self-signed certs)
# DB_ALLOW_SELF_SIGNED=false

# Maximum connections for the PostgreSQL pool (default 10; lower for serverless)
# DB_POOL_MAX=10

# Local development (optional local Postgres)
# DATABASE_URL=postgres://postgres@localhost:5432/aquila
```

Keep the existing `# Google OAuth (Better Auth social provider)` block (`GOOGLE_CLIENT_ID=` / `GOOGLE_CLIENT_SECRET=`) below it.

- [ ] **Step 3: `CLAUDE.md`**

- Line for `bun dev:db`: change to `- `bun dev:db` - Prints a reminder that Prisma Postgres is managed remotely (no local DB to start)`.
- Line for `bun drizzle:migrate`: change to `- `bun drizzle:migrate` - Run Drizzle migrations against Postgres`.
- Delete the `bun drizzle:migrate:allow-cockroach` bullet.
- Delete the `**Reminder:** Drizzle's CockroachDB dialect is pre-release …` bullet.
- In Environment Requirements, change `PostgreSQL-compatible database (CockroachDB staging or managed PostgreSQL in production)` to `Prisma Postgres (managed PostgreSQL)`.
- In the Optional Environment Variables list, remove `ALLOW_COCKROACH_MIGRATIONS`.

- [ ] **Step 4: `README.md`**

- Delete the `> **Note on CockroachDB**: …` note (line ~69), or replace with: `> **Database**: Prisma Postgres (managed PostgreSQL). Migrations run with `bun drizzle:migrate`.`
- Change `- `bun drizzle:migrate` - Apply migrations (with CockroachDB guard)` to `- `bun drizzle:migrate` - Apply migrations`.
- Delete the `- `ALLOW_COCKROACH_MIGRATIONS` - Explicitly enable CockroachDB migrations` line.

- [ ] **Step 5: Verify no stale references remain**

Run:
```bash
grep -rniE "cockroach|26257|crdb|allow_cockroach|allow-cockroach|DB_CA_PATH" \
  apps/web/package.json .env.example CLAUDE.md README.md \
  apps/web/scripts apps/web/src/lib/drizzle \
  2>/dev/null | grep -v "__tests__"
```
Expected: no output (the spec doc under `docs/` is allowed to retain historical references).

- [ ] **Step 6: Lint**

Run: `bun --filter web lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json .env.example CLAUDE.md README.md
git commit -m "docs(db): replace CockroachDB references with Prisma Postgres"
```

---

### Task 5: Apply migrations to Prisma Postgres and verify (operational)

> **Operational task — run interactively with the controller, NOT as an isolated subagent.** It needs the live Prisma Postgres connection string (a Sensitive value the CLI cannot read) and network access to the database.

**Files:**
- Modify: `apps/web/.env` (local, gitignored) — set `DATABASE_URL` to the Prisma Postgres string.

- [ ] **Step 1: Obtain the connection string**

From Vercel dashboard → Storage → the Prisma Postgres store → connection details / `.env`. Capture the pooled `DATABASE_URL` (`postgres://…?sslmode=require`) and, if shown, the direct URL.

- [ ] **Step 2: Set local `.env`**

In `apps/web/.env`, replace the existing CockroachDB `DATABASE_URL` line with the Prisma Postgres connection string (prefer the direct URL for the migration run if available; otherwise the pooled one).

- [ ] **Step 3: Run migrations**

Run: `bun --filter web drizzle:migrate`
Expected: drizzle-kit applies the 3 migrations with no error. If it errors on SSL, confirm the URL ends with `?sslmode=require`.

- [ ] **Step 4: Verify the schema**

Run (replace nothing — reads `DATABASE_URL` from `apps/web/.env`):
```bash
cd apps/web && bun -e "import('pg').then(async ({default:{Pool}})=>{const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});const {rows}=await p.query(\"select table_name from information_schema.tables where table_schema='public' order by 1\");console.log(rows.map(r=>r.table_name).join('\n'));await p.end();})"
```
Expected: includes `users`, `sessions`, `accounts`, `verification_tokens` (plus app tables). Load `apps/web/.env` first if not auto-loaded (e.g. `export $(grep DATABASE_URL apps/web/.env | xargs)`).

- [ ] **Step 5: Full verification**

Run: `bun --filter web test` and `bun lint`
Expected: all green.

Then start dev and probe auth:
```bash
bun dev:web   # in one shell
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5090/api/auth/get-session
```
Expected: non-503 (200/401 acceptable — means the DB adapter initialized).

- [ ] **Step 6: Preview verification**

Trigger a preview redeploy of the working branch and probe its `/api/auth/get-session`. Expected: non-503 (Vercel auto-resolves `aquila_DATABASE_URL` via the Task 1 chain).

- [ ] **Step 7: Final review handoff**

Use superpowers:finishing-a-development-branch.

---

## Self-Review

**Spec coverage:**
- Connection resolution chain → Task 1 (`resolveConnectionString` + tests). ✓
- TLS for remote/dev → Task 1 (`resolveSsl` + tests, preserves existing db.test.ts cases). ✓
- Apply migrations → Task 5. ✓
- Remove guard/script/allow-cockroach → Task 3 + Task 4. ✓
- `run-migration.ts` TLS fix → Task 2. ✓
- `dev:db`, `.env.example`, `CLAUDE.md`, `README.md` → Task 4. ✓
- Local `.env` swap → Task 5. ✓
- Vercel needs no dashboard change → covered by Task 1 chain; verified in Task 5 Step 6. ✓
- Verification steps → Task 5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; doc edits give exact anchors + replacement text.

**Type consistency:** `resolveConnectionString` / `resolveSsl` signatures and the `{ rejectUnauthorized: boolean }` shape are identical across Task 1 (definition), Task 1 db.ts (consumer), and Task 2 run-migration.ts (consumer). The preserved error string `DATABASE_URL environment variable is not set` matches db.test.ts's assertion.
