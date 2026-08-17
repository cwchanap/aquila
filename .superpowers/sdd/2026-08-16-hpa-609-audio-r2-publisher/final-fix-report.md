# HPA-609 audio publisher final-fix wave

Status: DONE_WITH_CONCERNS

Base: `190cda81`

Final implementation commits: `05cb7b53` (`fix: close final audio publisher review gaps`) and this follow-up changeset (`fix: require pointer metadata snapshots`)

## Scope completed

- I1: moved audio forbidden metadata stems into the shared runtime validation rule, used that same boundary-aware rule for the verifier's audio raw-JSON scan, and covered request/compiler/generation/selection/candidate/source forms.
- I2: active audio verification now checks manifest CORS; visual active verification and candidate behavior remain unchanged.
- I3: audio publication candidates require empty custom metadata, immutable reuse/read-back and deep verification reject contaminated audio objects, and advisory/activation audio pointer paths reject contaminated metadata. Existing-pointer snapshots require custom metadata from every store implementation, and visual reuse remains conditional on its existing candidate contract.
- M1: audio omission accumulation uses a null-prototype record so an own `__proto__` key reaches unknown/unused validation.
- M2: the audio integration ordering assertion now uses one total timeline covering process availability/probes, progress, source and receipt archive operations, delivery object/manifest operations, and deep verification.

## TDD evidence

Each review item had a focused regression before the corresponding implementation/test correction.

### I1

- RED: `bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts` — 1 failed, 10 passed; the six newly listed audio metadata forms were accepted.
- RED: `bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts` — 1 failed, 57 passed; the audio raw scanner returned no finding for `requestIds`.
- GREEN: the same focused commands — stories 11/11 passed; infra verifier 58/58 passed (before the I2 test was added).

### I2

- RED: `bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts` — 1 failed, 58 passed; active audio verification incorrectly passed a manifest with invalid CORS.
- GREEN: the same command — 59/59 passed.

### I3

- RED: `bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/audio-candidate-verifier.test.ts src/publisher/__tests__/audio-publication-plan.test.ts src/publisher/__tests__/activation.test.ts` — 5 failed, 42 passed; contaminated reused objects, deep verification, advisory planning, and audio no-op activation were accepted.
- GREEN: the same command — 47/47 passed.
- Additional visual/store regression: `bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/local-delivery-store.test.ts src/publisher/__tests__/r2-delivery-store.test.ts src/publisher/__tests__/publication-plan.test.ts src/publisher/__tests__/publish.integration.test.ts` — 79/79 passed.

### M1

- RED: `bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts` — 1 failed, 10 passed; an own `__proto__` omission was silently dropped.
- GREEN: the same command — 11/11 passed.

### M2

- RED: `bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts` with the progress callback still writing only to its separate event list — 1 failed, 5 passed; the shared subsequence correctly reported the missing validation progress marker.
- GREEN: the restored shared timeline command — 6/6 passed.

## Verification

- `bun --filter @aquila/stories test` — 34 files, 354 tests passed.
- `bun --filter @aquila/stories typecheck` — passed.
- `bun --filter @aquila/infra-cloudflare test` — 37 files, 531 tests passed.
- `bun --filter @aquila/infra-cloudflare typecheck` — passed.
- `bun --filter @aquila/stories lint` — passed.
- `bun --filter @aquila/infra-cloudflare lint` — passed.
- `bun run lint` — passed (4 lint tasks ran; other workspaces have no lint task).
- Scoped `bunx prettier --check ...` — passed.
- `git diff --check` — passed.

## Changed files

`packages/stories/src/runtime-assets/{validation.ts,audio.ts,index.ts,__tests__/audio.test.ts}`

`packages/infra-cloudflare/src/{assertions.ts,verify.ts,__tests__/verify.test.ts}`

`packages/infra-cloudflare/src/publisher/{immutable-candidate.ts,audio-candidate-verifier.ts,audio-publication-plan.ts,audio-source.ts,activation.ts}`

`packages/infra-cloudflare/src/publisher/stores/{delivery-store.ts,local-delivery-store.ts,r2-delivery-store.ts}`

Focused publisher tests under `packages/infra-cloudflare/src/publisher/__tests__/` for activation, candidate verification/planning, ordering, source omissions, immutable candidates, and widened pointer fixtures.

## Remaining concern

The inherited live R2 credential-separation and isolated preview smoke gate remains unrun: this checkout has no safe configured R2 credentials or fixture. All local source/runtime, verifier, store, publisher, typecheck, lint, formatting, and full stories/infra test evidence above is green.

## Follow-up I1 category-stem correction

The scoped re-review identified seven additional audio provenance forms that were not covered by the prior suffix list. The audio rule now uses boundary-aware `candidate`, `request`, `compiler`, `source`, `selection`, `generation`, `receipt`, and `model` category stems; visual matching remains unchanged.

- RED: `bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts` — 1 failed, 11 passed after adding the named forms and boundary negatives.
- RED: `bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts` — 1 failed, 59 passed; the raw scan returned no finding for `candidate`.
- GREEN: stories focused test — 12/12 passed.
- GREEN: infra focused verifier test — 60/60 passed.
- GREEN: `bun --filter @aquila/infra-cloudflare test -- src/__tests__/assertions.test.ts src/__tests__/verify.test.ts` — 107 tests passed.
- GREEN: full stories suite — 34 files, 355 tests passed.
- GREEN: full infra suite — 37 files, 532 tests passed.
- GREEN: both package typechecks, root lint, scoped Prettier, and `git diff --check`.

Follow-up implementation commit: this changeset (`fix: broaden audio provenance category stems`).

## Follow-up I1 lowercase-variant correction

The scoped re-review found that singular stems did not catch lowercase plurals or compact lowercase provenance names. Plural category stems and the known compact forms are now explicit entries, still evaluated by the existing boundary matcher; no arbitrary substring heuristic was added.

- RED: `bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts` — 1 failed, 11 passed after adding every listed lowercase form and compound boundary negatives.
- RED: `bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts` — 1 failed, 59 passed; the raw scan returned no finding for `candidates`.
- GREEN: stories focused test — 12/12 passed.
- GREEN: infra assertions/verifier focused tests — 107/107 passed.
- GREEN: full stories suite — 34 files, 355 tests passed.
- GREEN: full infra suite — 37 files, 532 tests passed.
- GREEN: both package typechecks, root lint, scoped Prettier, and `git diff --check`.

Follow-up implementation commit: this changeset (`fix: cover lowercase audio provenance variants`).
