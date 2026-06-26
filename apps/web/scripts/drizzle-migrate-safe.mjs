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
