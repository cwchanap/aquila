# HPA-232 final-review fixes report

## Outcome

Implemented the confirmed ready-state `popstate` fix without changing initial or pre-payload default-story behavior. When an active reader payload exists and a `popstate` URL omits `story`, `ReaderManager` now:

- cancels the pending throttled URL replacement;
- increments the load generation and clears the pending replacement intent;
- keeps the active story, scene, dialogue index, dialogue payload, flow, and persisted session unchanged;
- restores `ready` state and clears the error overlay;
- replaces the destination URL with the active session's canonical URL; and
- makes no story-loader request.

The late-resolution regression test confirms that a replacement load started before the missing-story event cannot apply afterward.

Safe review follow-ups also landed: async loader cache isolation is covered across distinct story IDs and `en`/`zh` locale keys, the rapid A to B to A browser test asserts exactly one A entry request and one B entry request, and `docs/reader-state-architecture.md` now documents reader intents, async load/error state, generation guards, and `activeFlow` ownership.

## TDD evidence

RED command:

```text
rtk bun --filter web test src/lib/__tests__/reader-manager.test.ts -t "missing-story|omits story"
```

Expected RED result: 2 failing tests. The ready non-default case observed a second loader call; the pending-replacement case observed a third/default loader call. Both failures demonstrated the missing active-session soft-reject boundary.

GREEN command:

```text
rtk bun --filter web test src/lib/__tests__/reader-manager.test.ts -t "missing-story|omits story"
```

GREEN result: 2 passed.

## Verification

- `rtk bun --filter web test src/lib/__tests__/reader-manager.test.ts` — 80 passed.
- `rtk bun --filter @aquila/stories test src/async/__tests__/loader.test.ts` — 6 passed.
- `rtk bun --filter @aquila/stories typecheck` — passed.
- `rtk bun lint` — 3 lint-enabled package tasks passed (`web`, `@aquila/stories`, `@aquila/game`).
- `rtk bun --filter e2e test:e2e tests/reader-lazy-loading.spec.ts --project=chromium -g "rapid A to B to A"` — 1 passed on the host after the sandboxed Chromium launch was denied by macOS Mach port permissions.
- `rtk bun --filter web build` — passed, including all three lazy story chunk-boundary assertions.
- Focused Prettier check and `git diff --check` — passed.

## Commits

- `f5c3d98` — `fix(reader): reject active popstate without story`
- Report-only follow-up commit contains this file.

## Concerns and intentional exclusions

- No unresolved product concerns found in the scoped changes.
- The first Playwright attempt did not execute the test because sandboxed Chromium failed during launch with a macOS `MachPortRendezvousServer` permission error. The identical focused command passed when rerun with host browser permission.
- `packages/e2e/scripts/measure-reader-runtime.ts` and its timing-buffer behavior were intentionally not changed, preserving baseline/after same-method reproducibility as directed.
- The production build still emits its existing Vite large-chunk and empty-chunk warnings; the build and explicit story chunk-boundary verifier pass.
