#!/usr/bin/env bun
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { resolveConnectionString } from '../src/lib/drizzle/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { console } = globalThis;

const drizzleConfig = resolve(__dirname, '../drizzle.config.ts');

// drizzle.config.ts reads only process.env.DATABASE_URL, but runtime db.ts
// resolves the connection string from a fallback chain (DATABASE_URL,
// POSTGRES_URL, aquila_DATABASE_URL, aquila_POSTGRES_URL). Mirror that chain
// here and inject DATABASE_URL into the child env so `bun drizzle:migrate`
// works in environments (e.g. Vercel Prisma Postgres) that only provision the
// prefixed variables.
const resolvedUrl = resolveConnectionString();
const childEnv = resolvedUrl
    ? { ...process.env, DATABASE_URL: resolvedUrl }
    : process.env;

const result = spawnSync(
    'bunx',
    ['drizzle-kit', 'migrate', '--config', drizzleConfig],
    {
        stdio: 'inherit',
        env: childEnv,
    }
);

if (result.error) {
    console.error('\n❌ Failed to spawn drizzle-kit migrate:', result.error);
    process.exit(result.status ?? 1);
}

process.exit(result.status ?? 0);
