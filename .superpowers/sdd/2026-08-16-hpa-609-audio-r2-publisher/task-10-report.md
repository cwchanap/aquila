# HPA-609 Task 10 Report

## Status

DONE

## Scope

Added the publisher CLI's explicit `--media audio` dispatch while retaining
visual as the default. Audio plan/publish now require a safe raw story folder;
audio activation, verification, release history, and rollback dispatch through
the existing media-aware Task 9 services. Audio publish remains immutable and
does not activate or mutate a pointer.

The local destination layout is now `<destination>/delivery` for runtime
objects/manifests and `<destination>/source` for audio archives. R2 audio uses
the delivery bucket with `R2_PUBLISHER_*` and the source bucket with
`R2_SOURCE_ARCHIVE_*`. Audio plan opens only delivery. Visual local roots and
visual R2 factory calls remain unchanged.

The existing destination safety helper accepts canonicalized additional input
paths. Audio local plan/publish checks both destination delivery/source roots
against the resolved HPA-608 generation root and optional omissions file in
both containment directions. Audio publish also performs a pre-write
`ffmpeg`/`ffprobe` `-version` check; missing tools fail as configuration before
any source archive or delivery immutable write, including an empty source plan.

## TDD evidence

### RED: command matrix and path safety

The required first focused command was run after adding the command-matrix and
path-safety tests, before the CLI implementation:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts
```

Result: exit 1; 90 tests ran, with the five new valid audio dispatch cases
failing because the visual-only CLI did not yet accept audio plan/publish or
audio lifecycle commands. Existing visual and rejection cases remained green.

### GREEN: command matrix and path safety

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts
```

Result: exit 0; 2 files and 107 tests passed. This covers visual default and
unknown-media rejection, story-folder requirements/exclusions, audio
mirror-preview and pointer-mutation rejection, local delivery/source roots,
R2 delivery/source bucket selection and credential gating, and both generation
root containment directions before store construction or dispatch.

### RED/GREEN: pre-write executable gate

After adding the empty-source prerequisite test, the focused audio-publish
command first failed as intended:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
```

Result before the hook: exit 1; 5 tests ran and the new test resolved with a
manifest write instead of rejecting when the injected tool runner returned
exit 127.

After adding the shared audio-tool preflight and updating the injected runner
seam to recognize `-version`:

```text
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
```

Result: exit 0; 6 tests passed, including independent missing-`ffmpeg` and
missing-`ffprobe` zero-write cases.

## Verification

- `bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts src/publisher/__tests__/audio-publish.integration.test.ts` — PASS; 3 files and 113 tests.
- `bun --filter @aquila/infra-cloudflare test` — PASS; 37 files and 506 tests.
- `bun --filter @aquila/infra-cloudflare typecheck` — PASS.
- `bun --filter @aquila/infra-cloudflare lint` — PASS.
- `bun --filter @aquila/stories test` — PASS; 34 files and 354 tests.
- `bun --filter @aquila/stories typecheck` — PASS.
- `bun run lint` — PASS; 4 Turbo tasks successful.
- `bun run build` — PASS; 4 Turbo tasks successful. Existing chunk-size and desktop tsconfig warnings were emitted without failures.
- `bunx prettier --check packages/infra-cloudflare/src/publisher/cli.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/audio-encoder.ts packages/infra-cloudflare/src/publisher/audio-publish.ts packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts` — PASS.
- `git diff --check` — PASS.

The existing report sanitizer/redaction tests already cover audio source-path,
generation-root, receipt, candidate, and omission-detail sentinels; no report
serializer change was necessary. Task 11's public HTTP verifier and docs were
not modified.

## Files

- `packages/infra-cloudflare/src/publisher/cli.ts`
- `packages/infra-cloudflare/src/publisher/types.ts`
- `packages/infra-cloudflare/src/publisher/activation.ts` (shared media type re-export)
- `packages/infra-cloudflare/src/publisher/audio-encoder.ts` (pre-write tool gate)
- `packages/infra-cloudflare/src/publisher/audio-publish.ts` (shared source-plan normalization seam and gate call)
- `packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts`
- `packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts`
- `.superpowers/sdd/2026-08-16-hpa-609-audio-r2-publisher/task-10-report.md`

## Commit

`feat: add audio publisher CLI dispatch`

## Blockers

None known within Task 10 scope. The explicit pre-write hook is limited to the
required executable prerequisite and reuses the existing injected process
runner; no generic CLI framework, public verifier, activation redesign, or
additional storage subsystem was introduced.
