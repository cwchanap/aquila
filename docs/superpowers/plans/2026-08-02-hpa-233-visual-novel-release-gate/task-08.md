# HPA-233 Implementation Plan — Task 8: Implement Structured Release-Gate and Production-Smoke Browser Flows

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 8: Implement Structured Release-Gate and Production-Smoke Browser Flows

**Files:**
- Create: `packages/e2e/reporters/release-gate-reporter.ts`
- Create: `packages/e2e/tests/visual-novel-release-gate.spec.ts`
- Create: `packages/e2e/tests/visual-novel-production-smoke.spec.ts`
- Create: `packages/e2e/fixtures/visual-release-gates/hpa_233_fixture.v1.json`
- Create: `packages/e2e/tests/support/release-gate-env.ts`
- Create: `packages/e2e/tests/support/release-gate-evidence.ts`

**Interfaces:**
- Consumes: Task 1 scenario shape, Task 6 DOM identity, Task 7 remote config/probes.
- Produces one strict browser evidence JSON document containing project, story, target, preview, release, checksum, scenario digest, identity, request paths, scenario cases, status, traces, and screenshots.

- [ ] **Step 1: Write environment and scenario parser tests**

```ts
it('requires preview id for preview and rejects it for production', () => {
    expect(() => parseReleaseGateEnv(PREVIEW_ENV_WITHOUT_ID)).toThrow();
    expect(() => parseReleaseGateEnv(PRODUCTION_ENV_WITH_ID)).toThrow();
});
```

Add `@aquila/infra-cloudflare` as a workspace dependency of `packages/e2e` and import strict parsers from `@aquila/infra-cloudflare/release-gate`. The exported subpath is parser/type-only and must not import R2 stores, CLI process state, or activation code, preventing a runtime cycle.

- [ ] **Step 2: Implement settled web-identity assertion**

```ts
async function expectSettledIdentity(page: Page, expected: ExpectedWebIdentity): Promise<void> {
    const visual = page.getByTestId('visual-novel-reader');
    await expect(visual).toHaveAttribute('data-visual-release-state', 'ready');

    const host = page.getByTestId('reader-ready');
    await expect(host).toHaveAttribute('data-asset-environment', expected.assetEnvironment);
    await expect(host).toHaveAttribute('data-asset-release-id', expected.releaseId);
    await expect(host).toHaveAttribute('data-asset-manifest-sha256', expected.manifestSha256);
    if (expected.previewId) {
        await expect(host).toHaveAttribute('data-asset-preview-id', expected.previewId);
    } else {
        await expect(host).not.toHaveAttribute('data-asset-preview-id');
    }
}
```

Missing attributes after ready must fail, not skip.

- [ ] **Step 3: Capture pointer, manifest, and unrelated-story network requests**

Register `page.on('request')` before navigation. Store sanitized HTTPS URLs only. Require the pointer path to match expected target and the manifest path to match expected release. Fail if `/assets/vn/` local fixture paths are used in remote mode.

- [ ] **Step 4: Implement the complete preview browser flow**

Cover, in order:

1. Direct non-zero route under scenario locale.
2. Ready identity and request paths.
3. Background and portrait transition.
4. Visual → text → visual preserving exact route/line and stable identity.
5. Desktop/mobile viewport swap preserving exact route/line and stable identity.
6. History open/close with focus restoration.
7. Bookmark restore.
8. Intentional omission/unavailable fallback with continued dialogue.
9. Deterministic choice to expected scene.
10. Reload with locale preserved and no unrelated story chunk request.

Use data/test selectors already owned by reader tests. Do not use pixel snapshots.

- [ ] **Step 5: Implement the smaller production-smoke browser flow**

The production spec verifies production web identity, expected release/checksum, direct route opening, one representative background and portrait decode, one progression action, and no write/mutation endpoint. It does not run the full choice/bookmark/history matrix.

- [ ] **Step 6: Implement the structured reporter**

The reporter writes exactly one JSON file under `RELEASE_GATE_EVIDENCE_DIR`, one per project, then a deterministic aggregate index. Include failure trace/screenshot paths relative to the evidence directory. Never include cookies, headers, credentials, signed URLs, or private environment values.

- [ ] **Step 7: Validate project membership without a deployment**

```bash
BASE_URL=https://preview.invalid \
RELEASE_GATE_TARGET=preview \
RELEASE_GATE_STORY_ID=hpa_233_fixture \
RELEASE_GATE_PREVIEW_ID=hpa-233-fixture \
RELEASE_GATE_RELEASE_ID=rel_aaaaaaaaaaaaaaaa \
RELEASE_GATE_MANIFEST_SHA256=$(printf 'a%.0s' {1..64}) \
RELEASE_GATE_SCENARIO=fixtures/visual-release-gates/hpa_233_fixture.v1.json \
AQUILA_PRODUCTION_WEB_ORIGIN=https://aquila.example.com \
bun --filter e2e test:release-gate --list
```

Expected: both `release-gate-chromium` and `release-gate-mobile-chrome` collect the release-gate spec; no local server starts.

- [ ] **Step 8: Run local regression suites**

```bash
bun --filter e2e test:e2e tests/reader-visual.spec.ts --project=chromium --project=mobile-chrome
bun --filter e2e test:e2e tests/reader-lazy-loading.spec.ts --project=chromium
```

- [ ] **Step 9: Commit browser flows**

```bash
git add packages/e2e
git commit -m "test(e2e): add deployed visual release gate flows"
```

---
