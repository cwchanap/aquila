# HPA-233 Visual Novel Release Check — Implementation Plan

> Design: [`../specs/2026-08-02-hpa-233-visual-novel-release-gate-design.md`](../specs/2026-08-02-hpa-233-visual-novel-release-gate-design.md)

**Goal:** Before flipping the production asset pointer, prove one release works from the public CDN, in a real browser, in the deployed reader.

**Approach:** Generalize the public CDN verifier that already exists, expose resolved release identity on the reader, add one deployed-browser spec, and wire them into one manually-triggered workflow. No new module tree, no evidence schemas, no approval protocol — see the design's non-goals.

**Stack:** Bun, TypeScript, Vitest, Playwright, GitHub Actions, existing `@aquila/stories/runtime-assets` contracts.

## Constraints

- Do not add a new workspace, a second manifest/pointer/resolver/publisher, or a new release identity algorithm.
- Import path helpers, parsers, and digest utilities from `@aquila/stories/runtime-assets`.
- `assets` publisher commands and their exit taxonomy are untouched.
- The workflow may write only to a preview namespace; it must never invoke a command that can move the production pointer.
- Remote Playwright must not start or reuse the local dev server.

## File map

**Task 1 — public CDN verification**
- Modify `packages/infra-cloudflare/src/verify.ts` — accept story/target/release/checksum/base-url as arguments; add candidate mode; keep no-arg defaults.
- Modify `packages/infra-cloudflare/src/__tests__/verify.test.ts` — candidate-mode and argument-parsing coverage.

**Task 2 — reader release identity**
- Modify `apps/web/src/lib/visual-assets/types.ts` — add `releaseIdentity` to `VisualSnapshot`.
- Modify `apps/web/src/lib/visual-assets/visual-state-controller.ts` — publish/clear identity with release state.
- Modify `apps/web/src/lib/visual-assets/source-factory.ts` — pass validated source identity into the controller instead of rereading `import.meta.env` downstream.
- Modify `apps/web/src/components/ReaderShell.svelte` — render `data-asset-*` on the existing `data-testid="reader-ready"` host (line 351).
- Modify `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`, `apps/web/src/components/__tests__/ReaderShell.test.ts`.

**Task 3 — deployed browser spec**
- Create `packages/e2e/tests/support/r2-browser-probe.ts` — helpers extracted from `r2-delivery.spec.ts`.
- Modify `packages/e2e/tests/r2-delivery.spec.ts` — consume the extracted helpers, behaviour unchanged.
- Create `packages/e2e/playwright.release-gate.config.ts` — no `webServer`, HTTPS-only `BASE_URL`, Desktop + Mobile Chromium.
- Create `packages/e2e/tests/visual-novel-deployed.spec.ts` — env-driven preview/production flow.
- Modify `packages/e2e/package.json` — add the remote script.

**Task 4 — workflow and runbook**
- Create `.github/workflows/visual-novel-release-gate.yml` — one `workflow_dispatch` job.
- Create/extend `docs/infrastructure/visual-novel-release-gate.md` — qualify → activate → verify → roll back.
- Modify `.env.example` if the gate preview variables are not already documented.

---

## Task 1: Parameterize public CDN verification

`src/verify.ts` already performs the right checks (CORS, immutable cache headers, content type, byte checksum, decoded dimensions, forbidden fields, pointer revalidation) but hardcodes `STORY_ID`, `PREVIEW_ID`, and `TARGET`, and only resolves through `current.json`.

- [ ] **Step 1: Write the candidate-mode test first**

```ts
it('verifies an immutable candidate without reading the active pointer', async () => {
    const requests: string[] = [];
    const result = await verifyPublicRelease({
        storyId: 'the_seventh_mirror',
        target: { kind: 'preview', previewId: 'hpa-233' },
        assetBaseUrl: new URL('https://assets.example.dev'),
        releaseId: FIXTURE_RELEASE_ID,
        expectedManifestSha256: FIXTURE_MANIFEST_SHA256,
    }, { fetch: fixtureFetch(requests) });

    expect(result.status).toBe('passed');
    expect(requests).not.toContainEqual(expect.stringContaining('/current.json'));
});
```

Add cases for: active mode still deriving identity from `current.json`; a manifest checksum that disagrees with `--expect-manifest-sha256`; wrong CORS; mutable cache headers on an immutable object; a forbidden prompt field in the manifest.

- [ ] **Step 2: Run it and confirm it fails**

```bash
bun --filter @aquila/infra-cloudflare test src/__tests__/verify.test.ts
```

- [ ] **Step 3: Lift the constants into an input type**

```ts
export type PublicVerifyInput = {
    storyId: string;
    target: PublicationTarget;
    assetBaseUrl: URL;
    browserOrigin: URL;
    releaseId?: string;          // candidate mode when present
    expectedManifestSha256?: ManifestByteSha256;
};
```

Candidate mode calls `getReleaseManifestPath(target, storyId, releaseId)` directly. Active mode keeps today's path: fetch `current.json`, `parseActiveReleasePointer`, then `validatePointerManifestPair`. Both compare against `expectedManifestSha256` when it is supplied.

Reject non-HTTPS and credential-bearing base URLs.

- [ ] **Step 4: Add argument parsing with today's behaviour as the default**

No arguments must still mean `the_seventh_mirror` / preview `smoke` / active mode, so the HPA-229 smoke invocation is unaffected. Add `--json` writing one result to stdout with progress on stderr. Exit `0` pass, `1` fail.

- [ ] **Step 5: Run package tests**

```bash
bun --filter @aquila/infra-cloudflare test
```

Expected: PASS, including the pre-existing verify tests unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/infra-cloudflare/src/verify.ts packages/infra-cloudflare/src/__tests__/verify.test.ts
git commit -m "feat(infra): verify arbitrary candidate releases on the public CDN"
```

---

## Task 2: Expose validated release identity on `ReaderShell`

- [ ] **Step 1: Write controller tests for publication and clearing**

```ts
it('publishes validated identity when the release becomes ready', async () => {
    const controller = createController({ resolver: readyPreviewResolver() });
    const snapshots: VisualSnapshot[] = [];
    controller.subscribe(s => snapshots.push(s));
    controller.update(FIXTURE_INPUT);
    await flushPromises();

    expect(snapshots.at(-1)?.releaseIdentity).toEqual({
        assetEnvironment: 'preview',
        previewId: 'hpa-233',
        releaseId: FIXTURE_RELEASE_ID,
        manifestSha256: FIXTURE_MANIFEST_SHA256,
    });
});

it('clears identity on invalid release and on story replacement', async () => {
    expect(finalSnapshot.releaseIdentity).toBeNull();
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

- [ ] **Step 3: Extend the snapshot type**

```ts
export type VisualReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};
```

Add `releaseIdentity: VisualReleaseIdentity | null` to `VisualSnapshot` and to every initial/empty snapshot.

- [ ] **Step 4: Populate it from the validated release**

Thread the validated `AssetResolverSource` into the controller from `source-factory.ts` rather than rereading `import.meta.env` — the existing comment there about static member expressions explains why that matters. Build identity from the source environment/target plus the validated pointer's release ID and manifest checksum. Clear on invalid, unavailable, disposed, or story change.

- [ ] **Step 5: Write `ReaderShell` DOM tests**

```ts
it('hosts release identity on reader-ready across mode changes', async () => {
    render(ReaderShell, { createVisualRuntime: readyRuntimeFactory() });
    await user.click(screen.getByRole('button', { name: /visual novel/i }));
    const host = await screen.findByTestId('reader-ready');
    expect(host).toHaveAttribute('data-asset-release-id', FIXTURE_RELEASE_ID);

    await user.click(screen.getByRole('button', { name: /text mode/i }));
    expect(host).toHaveAttribute('data-asset-release-id', FIXTURE_RELEASE_ID);
});
```

Also assert: absent before ready, absent after invalidation, and not present on the `VisualNovelReader` leaf.

- [ ] **Step 6: Render the attributes**

```svelte
<div
  data-testid="reader-ready"
  data-asset-environment={visualIdentity?.assetEnvironment}
  data-asset-preview-id={visualIdentity?.previewId ?? undefined}
  data-asset-release-id={visualIdentity?.releaseId}
  data-asset-manifest-sha256={visualIdentity?.manifestSha256}
>
```

Hold the identity in `ReaderShell` state from the runtime subscription so it survives leaf unmounts at breakpoints and mode switches.

- [ ] **Step 7: Verify**

```bash
bun --filter web test
```

- [ ] **Step 8: Commit**

```bash
git add apps/web
git commit -m "feat(web): expose resolved visual release identity on the reader shell"
```

---

## Task 3: Deployed-browser spec

- [ ] **Step 1: Extract the browser probe helpers**

Move the page-side CORS fetch, header assertion, decode, and dimension helpers out of `r2-delivery.spec.ts` into `tests/support/r2-browser-probe.ts`. That spec keeps identical behaviour — run it to confirm before moving on.

- [ ] **Step 2: Add the remote-only config**

`playwright.release-gate.config.ts`: no `webServer`; `BASE_URL` required, HTTPS, non-localhost, otherwise throw at config load; Desktop Chromium and Mobile Chromium projects only; `testMatch` limited to `visual-novel-deployed.spec.ts`; traces and screenshots retained.

- [ ] **Step 3: Write the deployed flow**

Env: `RELEASE_GATE_STORY_ID`, `RELEASE_GATE_RELEASE_ID`, `RELEASE_GATE_MANIFEST_SHA256`, `RELEASE_GATE_PREVIEW_ID` (preview only), `BASE_URL`.

1. Open the story in visual mode at a non-zero position.
2. Wait for visual release state `ready`, then assert every expected `data-asset-*` value on `reader-ready`. Missing attribute, `local` environment, or mismatched release/checksum fails.
3. Advance through a background change and a portrait change.
4. Switch visual↔text — same line, same identity.
5. Resize desktop↔mobile — same line, same identity.
6. Restore a bookmark; take one choice.
7. Exercise one intentionally-omitted asset; confirm fallback does not block.

When `RELEASE_GATE_PREVIEW_ID` is unset, treat the run as production and additionally assert `data-asset-preview-id` is absent.

- [ ] **Step 4: Add the script**

```json
"test:release-gate": "playwright test --config playwright.release-gate.config.ts"
```

- [ ] **Step 5: Verify locally against a preview deploy**

```bash
bun --filter e2e test:e2e tests/r2-delivery.spec.ts   # unchanged behaviour
BASE_URL=https://<preview> RELEASE_GATE_STORY_ID=... bun --filter e2e test:release-gate
```

Also confirm the config rejects `BASE_URL=http://localhost:5090`.

- [ ] **Step 6: Commit**

```bash
git add packages/e2e
git commit -m "test(e2e): verify the deployed reader serves a specific release"
```

---

## Task 4: Release workflow and runbook

- [ ] **Step 1: Add the workflow**

`workflow_dispatch` inputs: `story`, `release_id`, `manifest_sha256`, `preview_id`, `preview_url`. One job:

1. `assets verify --story … --release … --expect-manifest-sha256 … --deep` (storage).
2. `assets mirror-preview` then `assets activate --environment preview --preview-id …`.
3. `bun --filter @aquila/infra-cloudflare verify --story … --preview-id … --release … --expect-manifest-sha256 … --asset-base-url …` (public CDN).
4. `bun --filter e2e test:release-gate` against `preview_url`.
5. Summary step printing story, release, checksum, preview URL, and each step's result.

No production commands anywhere in the file. Upload the Playwright report on failure.

- [ ] **Step 2: Confirm the production pointer is unreachable**

Grep the workflow for `--environment production`, `--confirm-production`, `rollback`, and `activate` outside the preview step. Nothing should match except the preview activation.

- [ ] **Step 3: Write the runbook**

`docs/infrastructure/visual-novel-release-gate.md`, one page, copy-pasteable:
- Publish a candidate and get its release ID and manifest checksum.
- Set `PUBLIC_ASSET_PREVIEW_ID` on the preview deploy and run the workflow.
- Read the result.
- Activate production manually (`assets activate --environment production --confirm-production <story>`).
- Verify production: rerun the public verifier and the deployed spec against production URLs, with no preview ID.
- Roll back (`assets rollback`).

- [ ] **Step 4: Verify the whole branch**

```bash
bun run lint
bun run test
bun run compile:check
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/visual-novel-release-gate.yml docs/infrastructure .env.example
git commit -m "ci: add visual novel release check workflow and runbook"
```

---

## Done when

- [ ] `verify.ts` verifies an arbitrary candidate without reading `current.json`; the no-arg invocation is byte-identical in behaviour to today.
- [ ] The deployed reader reports its resolved release, and identity survives mode and breakpoint changes.
- [ ] The deployed spec fails on a stale release, wrong preview ID, or local fallback.
- [ ] The remote config cannot start or reach a local server.
- [ ] One workflow run gives a clear go/no-go and cannot move the production pointer.
- [ ] The runbook has working qualify → activate → verify → roll back commands for HPA-231.
