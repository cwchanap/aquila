# HPA-233 Implementation Plan — Task 7: Extract Browser Delivery Probes and Add Remote-Only Playwright Configuration

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 7: Extract Browser Delivery Probes and Add Remote-Only Playwright Configuration

**Files:**
- Create: `packages/e2e/tests/support/r2-browser-probe.ts`
- Modify: `packages/e2e/tests/r2-delivery.spec.ts`
- Create: `packages/e2e/playwright.release-gate.config.ts`
- Create: `packages/e2e/playwright.release-gate.config.test.ts`
- Modify: `packages/e2e/package.json`

**Interfaces:**
- Consumes: existing `r2-delivery.spec.ts` page probe logic and Playwright devices.
- Produces: `probeJsonFromPage`, `probeImageFromPage`, `cacheDirectives`, `assertCorsReadable`, and an exported `createReleaseGatePlaywrightConfig(env)` testable factory.

- [ ] **Step 1: Write extraction-preservation tests for page probes**

Move pure parsing and failure-message tests into a testable support module. Test timeout, blocked CORS, HTTP error, invalid JSON, failed decode, cache directive parsing, and decoded size.

- [ ] **Step 2: Extract the probe helpers without changing fixed smoke behavior**

`r2-delivery.spec.ts` must retain its fixed story, preview ID, `R2_LIVE_CHECK` gate, skip reason, and assertions. Only the shared implementation moves.

- [ ] **Step 3: Run the fixed smoke spec in collection mode**

```bash
bun --filter e2e test:e2e tests/r2-delivery.spec.ts --project=chromium
```

Expected without `R2_LIVE_CHECK`: existing tests are skipped with the documented reason; no collection errors.

- [ ] **Step 4: Write failing remote-config tests with Bun's built-in test runner**

Create `packages/e2e/playwright.release-gate.config.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
it('rejects localhost and omits webServer', () => {
    expect(() => createReleaseGatePlaywrightConfig({ BASE_URL: 'http://localhost:5090' })).toThrow();
    const config = createReleaseGatePlaywrightConfig({
        BASE_URL: 'https://preview.example.com',
        RELEASE_GATE_TARGET: 'preview',
        AQUILA_PRODUCTION_WEB_ORIGIN: 'https://aquila.example.com',
    });
    expect(config.webServer).toBeUndefined();
    expect(config.projects?.map(project => project.name)).toEqual([
        'release-gate-chromium',
        'release-gate-mobile-chrome',
    ]);
});
```

- [ ] **Step 5: Implement `playwright.release-gate.config.ts`**

Use an exported factory for tests, then `export default createReleaseGatePlaywrightConfig(process.env)`. Require absolute HTTPS `BASE_URL`, `RELEASE_GATE_TARGET=preview|production`, production-origin guard, no localhost, no `webServer`, exactly Desktop Chrome and Pixel 5, explicit `testMatch` for release-gate and production-smoke specs, and the structured reporter.

- [ ] **Step 6: Add explicit scripts**

```json
{
  "scripts": {
    "test:release-gate": "playwright test --config=playwright.release-gate.config.ts tests/visual-novel-release-gate.spec.ts",
    "test:production-smoke": "playwright test --config=playwright.release-gate.config.ts tests/visual-novel-production-smoke.spec.ts"
  }
}
```

Do not set `PUBLIC_ASSET_*` in these scripts.

- [ ] **Step 7: Run E2E support/config validation**

```bash
bun test packages/e2e/playwright.release-gate.config.test.ts
bun --filter e2e test:e2e tests/r2-delivery.spec.ts --project=chromium
```

Expected: the config unit test passes without a remote deployment; the fixed smoke spec collects and skips when `R2_LIVE_CHECK` is absent.

- [ ] **Step 8: Commit shared probes and remote config**

```bash
git add packages/e2e
git commit -m "test(e2e): add remote visual release gate harness"
```

---
