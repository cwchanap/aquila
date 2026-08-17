# HPA-609 Task 9 Report

## Status

DONE

## Scope

Extended the existing activation, release-history, rollback, and reactivation
machinery with optional `media?: PublisherMedia` (`visual` by default).
Activation now selects the pointer path, pointer parser, and stored-release
deep verifier for audio or visual while retaining shared timestamp, CAS,
conflict, confirmation, and result logic. Release history now dispatches
manifest paths, pointer paths/parsers, manifest parsers, canonical release
content, release identity checks, and shallow/deep verification for both media.
Audio rollback/reactivation reports and writes are isolated to the audio
pointer namespace; visual defaults remain unchanged.

## TDD evidence

### RED

Activation RED command:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/activation.test.ts
```

Result before media dispatch: exit 1; 2 audio tests failed in the visual-only
`candidate-verifier` while trying to read the audio release path.

History RED command:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/release-history.test.ts
```

Result before media dispatch: exit 1; 5 audio tests failed because history
listed no audio releases, used visual paths, or rejected the audio rollback
target.

### GREEN

The focused combined command after implementation passed:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/activation.test.ts src/publisher/__tests__/release-history.test.ts
```

Result: exit 0; 2 test files and 42 tests passed. Coverage proves first and
second audio activation reads, no-op/reactivation, stale CAS override, visual
pointer preservation, production/preview audio history, shallow/deep status,
active and invalid pointer handling, namespace isolation, rollback, and
reactivation.

## Verification

- `bun --filter @aquila/infra-cloudflare test` — PASS; 37 test files and 488 tests.
- `bun --filter @aquila/infra-cloudflare typecheck` — PASS; exit 0.
- `bun --filter @aquila/infra-cloudflare lint` — PASS; exit 0.
- `bun run lint` — PASS; 4 lint tasks successful.
- `bun --filter @aquila/stories test` — PASS; 34 test files and 354 tests.
- `bun --filter @aquila/stories typecheck` — PASS; exit 0.
- `bun run build` — PASS; 4 build tasks successful. Existing chunk-size and
  adapter warnings were emitted; no build task failed.
- `bunx prettier --check packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/release-history.ts packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts` — PASS.
- `git diff --check` — PASS.

The full infra run emitted existing story/audio fixture warnings about unused
audio-plan entries; no test failed.

## Files

- `packages/infra-cloudflare/src/publisher/activation.ts`
- `packages/infra-cloudflare/src/publisher/release-history.ts`
- `packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts`
- `packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts`
- `.superpowers/sdd/2026-08-16-hpa-609-audio-r2-publisher/task-9-report.md`

## Commit

`feat: activate and rollback audio releases`

## Blockers

None known within Task 9 scope. CLI/public-verifier media dispatch remains
intentionally outside this task.
