#!/usr/bin/env node
/* eslint-env node */
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const { console } = globalThis;

function hasCockroachSignature(url) {
  if (!url) return false;
  const lowered = url.toLowerCase();
  return (
    lowered.includes('cockroach') ||
    lowered.includes('26257') ||
    lowered.includes('crdb')
  );
}

const databaseUrl = process.env.DATABASE_URL ?? '';
const isCockroach = hasCockroachSignature(databaseUrl);
const allowCockroach = process.env.ALLOW_COCKROACH_MIGRATIONS === 'true';

if (isCockroach && !allowCockroach) {
  console.error(
    '\n⚠️  WARNING: drizzle-kit migrate is blocked for CockroachDB URLs.\n' +
      'CockroachDB support in drizzle-orm is pre-release and may corrupt schema state.\n' +
      'Set ALLOW_COCKROACH_MIGRATIONS=true if you have verified compatibility in staging.'
  );
  process.exit(1);
}

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
