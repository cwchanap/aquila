# HPA-233 KISS Visual Novel Release Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release `the_seventh_mirror` from an exact commit already merged to `main` by qualifying one preview, pausing for GitHub Environment approval, activating the exact immutable R2 release, and running a production smoke test.

**Architecture:** Build this on a fresh branch from `main`, not on PR #46. Reuse the existing immutable publisher unchanged; add only stable reader release identity, one remote Playwright smoke suite, one two-job GitHub Actions workflow, and a concise runbook. GitHub logs, protected-environment approval, publisher JSON reports, and Playwright artifacts are the release record.

**Tech Stack:** Bun 1.3.1, Node.js 22, TypeScript, Svelte 5, Astro 5, Vitest, Bun test, Playwright Chromium, GitHub Actions, Vercel CLI, Cloudflare R2, and the existing `@aquila/infra-cloudflare` publisher.

## Global Constraints

- Start implementation from the latest `main`. PR #46 is reference material only; do not retarget it or broadly cherry-pick its commits.
- Do not add a `workflow_run` trust bridge, candidate archive, custom tar parser, artifact attestation, evidence graph, FFI filesystem validation, manual-review JSON, workflow-approval JSON, activation-readiness CLI, stage timing, or new release-gate package.
- Do not change the publisher's production code or contracts. Use its existing `publish --no-activate`, `mirror-preview`, `activate`, `verify`, `releases`, and `rollback` commands.
- V1 supports only `the_seventh_mirror`. Do not add a generic multi-story matrix until a second production story needs it.
- The workflow accepts no candidate SHA, release ID, checksum, preview ID, artifact name, or scenario path from the operator.
- A dispatch must fail unless `github.ref == refs/heads/main`.
- The release ID and manifest SHA-256 come only from the publisher's JSON output.
- Preview qualification runs Desktop Chromium and Mobile Chromium. Production smoke runs Desktop Chromium only.
- Production activation runs only after approval of the `visual-novel-release-approval` GitHub Environment.
- Ordinary protected-branch checks remain responsible for compile, unit, build, lint, local E2E, PostgreSQL, fallback injection, history, bookmarks, reduced motion, and lazy-loading coverage. The release workflow does not repeat them.
- A real dispatch requires the HPA-231 production release plan and source assets to be present on `main`.
- Before approving production, confirm Vercel's normal production deployment for the dispatched `main` commit is ready. The workflow deploys a release preview; it does not create a second production web deployment.
- The release preview must be reachable from GitHub-hosted runners without an interactive deployment-protection page.
- Do not add runtime dependencies. The E2E environment parser uses Bun's test runner and existing runtime-assets exports.
- Do not auto-rollback. A failed production smoke prints the exact existing rollback command using the previously active release.

## File Map

### Create

- `.github/workflows/visual-novel-release.yml` — manual `main`-only preview qualification and protected production activation.
- `packages/e2e/release-smoke-env.ts` — strict but small environment parser.
- `packages/e2e/release-smoke-env.test.ts` — parser tests with Bun.
- `packages/e2e/playwright.release-smoke.config.ts` — remote-only Chromium config with no local server.
- `packages/e2e/tests/visual-novel-release-smoke.spec.ts` — one representative deployed-reader flow.
- `docs/infrastructure/visual-novel-release.md` — operator setup, release, failure, and rollback instructions.

### Modify

- `apps/web/src/lib/visual-assets/types.ts`
- `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/components/ReaderShell.svelte`
- `apps/web/src/components/__tests__/ReaderShell.test.ts`
- `packages/e2e/package.json`
- `packages/e2e/playwright.config.ts`
- `.github/workflows/r2-publisher-preview.yml`
- `docs/infrastructure/visual-asset-publisher.md`

---

### Task 1: Publish validated release identity from the visual controller

**Files:**
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Test: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`

**Interfaces:**
- Consumes: `AssetResolver.source`, `ValidatedAssetRelease.pointer.releaseId`, and `ValidatedAssetRelease.pointer.manifestSha256`.
- Produces:

```ts
export type VisualReleaseIdentity = {
    assetEnvironment: AssetResolverSource['environment'];
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};
```

- Produces: `VisualSnapshot.releaseIdentity: VisualReleaseIdentity | null`.
- Invariant: identity is non-null only while `release` is `ready` or `stale-but-usable`.

- [ ] **Step 1: Extend the release fixture and write the failing controller test**

In `visual-state-controller.test.ts`, define valid identity constants and update the existing `release()` helper:

```ts
const releaseId = `sha256-${'a'.repeat(64)}`;
const manifestSha256 = 'b'.repeat(64);

function release(source: 'network' | 'last-validated-release' = 'network') {
    return {
        pointer: { releaseId, manifestSha256 },
        manifest: {},
        validatedAt: '2026-07-26T00:00:00.000Z',
        source,
    } as ValidatedAssetRelease;
}
```

Add `releaseIdentity: null` to the existing initial snapshot expectation. Add this test:

```ts
it('publishes the exact release identity and clears it after failed revalidation', async () => {
    let now = 0;
    const loadRelease = vi
        .fn<() => Promise<ValidatedAssetRelease>>()
        .mockResolvedValueOnce(release())
        .mockRejectedValueOnce(
            new AssetResolverError('integrity', 'Manifest checksum mismatch')
        );
    const { controller, latest } = createHarness({
        loadRelease,
        now: () => now,
    });

    controller.update(
        input([{ dialogue: 'Validated release', background: 'room' }])
    );
    await flushAsyncWork();

    expect(latest().releaseIdentity).toEqual({
        assetEnvironment: 'local',
        previewId: 'hpa-228-test',
        releaseId,
        manifestSha256,
    });

    now = 60_001;
    await controller.softRevalidate();

    expect(latest().release).toBe('invalid');
    expect(latest().releaseIdentity).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
bun --filter web test -- src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: FAIL because `VisualSnapshot` has no `releaseIdentity`.

- [ ] **Step 3: Add the identity types**

At the top of `types.ts` add:

```ts
import type { AssetResolverSource } from '@aquila/stories/runtime-assets';
```

Add:

```ts
export type VisualReleaseIdentity = {
    assetEnvironment: AssetResolverSource['environment'];
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};
```

Add `releaseIdentity` immediately after `release` in `VisualSnapshot`:

```ts
export type VisualSnapshot = {
    release: VisualReleaseState;
    releaseIdentity: VisualReleaseIdentity | null;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portrait: VisualPortraitLayer;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

- [ ] **Step 4: Implement identity publication with the existing resolver source**

Import `VisualReleaseIdentity` in `visual-state-controller.ts`. Add `releaseIdentity: null` to `initialSnapshot()`.

Add this helper after `initialSnapshot()`:

```ts
function validatedReleaseIdentity(
    source: AssetResolver['source'],
    releaseId: string,
    manifestSha256: string
): VisualReleaseIdentity {
    return Object.freeze({
        assetEnvironment: source.environment,
        previewId:
            source.target.kind === 'preview' ? source.target.previewId : null,
        releaseId,
        manifestSha256,
    });
}
```

In `loadRelease()`, replace the single loading publish with:

```ts
if (!hadUsableRelease) {
    this.publish({ release: 'loading', releaseIdentity: null });
}
```

Add identity to the successful publish:

```ts
this.publish({
    release:
        validated.source === 'last-validated-release'
            ? 'stale-but-usable'
            : 'ready',
    releaseIdentity: validatedReleaseIdentity(
        resolver.source,
        validated.pointer.releaseId,
        validated.pointer.manifestSha256
    ),
});
```

Replace the failure publish with:

```ts
this.publish({
    release: releaseStateForError(error),
    releaseIdentity: null,
});
```

In `publish()`, normalize stale identity away whenever the release is no longer usable:

```ts
this.snapshot = Object.freeze({
    ...candidate,
    releaseIdentity:
        candidate.release === 'ready' ||
        candidate.release === 'stale-but-usable'
            ? candidate.releaseIdentity
            : null,
    status: this.statusFor(candidate),
});
```

Do not add a duplicate `source` option to `VisualStateControllerOptions`; `resolver.source` is already authoritative.

- [ ] **Step 5: Run the focused test and verify success**

```bash
bun --filter web test -- src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add \
  apps/web/src/lib/visual-assets/types.ts \
  apps/web/src/lib/visual-assets/visual-state-controller.ts \
  apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts
git commit -m "feat(web): expose validated visual release identity"
```

---

### Task 2: Expose identity on the stable reader shell

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Test: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: `VisualSnapshot.releaseIdentity` from Task 1.
- Produces optional attributes on `data-testid="reader-ready"`:
  - `data-asset-environment`
  - `data-asset-preview-id`
  - `data-asset-release-id`
  - `data-asset-manifest-sha256`
- Identity survives visual/text mode changes because the runtime is retained.
- Identity clears before runtime replacement or destruction.

- [ ] **Step 1: Make the existing test harness optionally return a validated release**

Extend the runtime-assets import in `ReaderShell.test.ts` with `ValidatedAssetRelease`.

Change the function declaration from:

```ts
function createRuntimeHarness(): {
```

to:

```ts
function createRuntimeHarness(
    options: {
        source?: AssetResolverSource;
        release?: ValidatedAssetRelease;
    } = {}
): {
```

Replace the existing `source` declaration with:

```ts
const source: AssetResolverSource =
    options.source ??
    ({
        environment: 'local',
        storyId: 'the_seventh_mirror',
        baseUrl: 'http://localhost:5090/assets/',
        target: { kind: 'preview', previewId: 'hpa-228-local' },
    } satisfies AssetResolverSource);
```

Replace only the existing `loadActiveRelease` member with:

```ts
loadActiveRelease: vi.fn(async () => {
    if (options.release) return options.release;
    throw new AssetResolverError(
        'unavailable',
        'No visual release in this component test'
    );
}),
```

No other harness member changes in this step.

- [ ] **Step 2: Write the failing stable-host test**

Add:

```ts
it('retains release identity across mode changes and clears it on story replacement', async () => {
    stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    readerState.dialogue = [{ dialogue: 'Released line without a keyed visual.' }];

    const releaseId = `sha256-${'c'.repeat(64)}`;
    const manifestSha256 = 'd'.repeat(64);
    const harness = createRuntimeHarness({
        source: {
            environment: 'preview',
            storyId: 'the_seventh_mirror',
            baseUrl: 'https://assets.example/',
            target: { kind: 'preview', previewId: 'release-123' },
        },
        release: {
            pointer: { releaseId, manifestSha256 },
            manifest: {},
            validatedAt: '2026-08-04T00:00:00.000Z',
            source: 'network',
        } as ValidatedAssetRelease,
    });

    render(ReaderShell, {
        props: {
            createVisualRuntime: requestedStoryId =>
                requestedStoryId === 'the_seventh_mirror'
                    ? harness.runtime
                    : null,
        },
    });

    const ready = screen.getByTestId('reader-ready');
    await waitFor(() => {
        expect(ready).toHaveAttribute('data-asset-environment', 'preview');
        expect(ready).toHaveAttribute(
            'data-asset-preview-id',
            'release-123'
        );
        expect(ready).toHaveAttribute('data-asset-release-id', releaseId);
        expect(ready).toHaveAttribute(
            'data-asset-manifest-sha256',
            manifestSha256
        );
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    expect(ready).toHaveAttribute('data-asset-release-id', releaseId);

    readerState.storyId = 'replacement_story';
    await waitFor(() => {
        expect(ready).not.toHaveAttribute('data-asset-environment');
        expect(ready).not.toHaveAttribute('data-asset-preview-id');
        expect(ready).not.toHaveAttribute('data-asset-release-id');
        expect(ready).not.toHaveAttribute('data-asset-manifest-sha256');
    });
});
```

The line intentionally has no background or portrait key, so this test exercises release identity without needing an asset-resolution fixture.

- [ ] **Step 3: Run the component test and verify failure**

```bash
bun --filter web test -- src/components/__tests__/ReaderShell.test.ts
```

Expected: FAIL because `reader-ready` has no release identity attributes.

- [ ] **Step 4: Subscribe the shell to identity changes**

Import `VisualReleaseIdentity` from `@/lib/visual-assets`.

Add state beside `visualStatus`:

```ts
let visualIdentity = $state<VisualReleaseIdentity | null>(null);
```

Add cleanup beside `removeVisibilityListener`:

```ts
let removeVisualIdentityListener = () => {};
```

At the beginning of `ensureVisualRuntime`, immediately before assigning `visualRuntimeStoryId`, add:

```ts
removeVisualIdentityListener();
removeVisualIdentityListener = () => {};
visualIdentity = null;
```

Immediately after `createVisualRuntime(...)`, add:

```ts
const runtime = visualRuntime;
const generation = runtimeGeneration;
if (!runtime) return;
removeVisualIdentityListener = runtime.controller.subscribe(snapshot => {
    if (
        destroyed ||
        runtimeGeneration !== generation ||
        visualRuntime !== runtime ||
        visualRuntimeStoryId !== activeStoryId
    ) {
        return;
    }
    visualIdentity = snapshot.releaseIdentity;
});
```

At the beginning of `disposeRuntimeForStoryChange`, after incrementing `runtimeGeneration`, add:

```ts
removeVisualIdentityListener();
removeVisualIdentityListener = () => {};
visualIdentity = null;
```

In `onDestroy`, after `removeVisibilityListener()`, add the same three cleanup statements.

- [ ] **Step 5: Add attributes to the stable host**

Update the `reader-ready` element:

```svelte
<div
  bind:this={readerReadyElement}
  data-testid="reader-ready"
  data-asset-environment={visualIdentity?.assetEnvironment}
  data-asset-preview-id={visualIdentity?.previewId ?? undefined}
  data-asset-release-id={visualIdentity?.releaseId}
  data-asset-manifest-sha256={visualIdentity?.manifestSha256}
  aria-hidden={isBlocking ? 'true' : undefined}
>
```

Do not add these attributes to `VisualNovelReader`; it unmounts in text mode.

- [ ] **Step 6: Run both focused suites**

```bash
bun --filter web test -- \
  src/components/__tests__/ReaderShell.test.ts \
  src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add \
  apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat(web): expose release identity on reader shell"
```

---

### Task 3: Add one remote-only smoke suite

**Files:**
- Create: `packages/e2e/release-smoke-env.ts`
- Create: `packages/e2e/release-smoke-env.test.ts`
- Create: `packages/e2e/playwright.release-smoke.config.ts`
- Create: `packages/e2e/tests/visual-novel-release-smoke.spec.ts`
- Modify: `packages/e2e/package.json`
- Modify: `packages/e2e/playwright.config.ts`

**Interfaces:**
- Requires `BASE_URL`, `AQUILA_PRODUCTION_WEB_ORIGIN`, `RELEASE_SMOKE_TARGET`, `RELEASE_SMOKE_RELEASE_ID`, and `RELEASE_SMOKE_MANIFEST_SHA256`.
- Preview additionally requires `RELEASE_SMOKE_PREVIEW_ID`.
- Preview runs `release-chromium` and `release-mobile-chrome`.
- Production selects only `release-chromium`.

- [ ] **Step 1: Write the failing parser tests**

Create `packages/e2e/release-smoke-env.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { loadReleaseSmokeContext } from './release-smoke-env';

const releaseId = `sha256-${'a'.repeat(64)}`;
const manifestSha256 = 'b'.repeat(64);

function previewEnvironment() {
    return {
        BASE_URL: 'https://preview.example.com',
        AQUILA_PRODUCTION_WEB_ORIGIN: 'https://game.example.com',
        RELEASE_SMOKE_TARGET: 'preview',
        RELEASE_SMOKE_PREVIEW_ID: 'release-123',
        RELEASE_SMOKE_RELEASE_ID: releaseId,
        RELEASE_SMOKE_MANIFEST_SHA256: manifestSha256,
    };
}

describe('loadReleaseSmokeContext', () => {
    it('loads a preview identity', () => {
        expect(loadReleaseSmokeContext(previewEnvironment())).toEqual({
            target: 'preview',
            baseUrl: 'https://preview.example.com',
            productionOrigin: 'https://game.example.com',
            previewId: 'release-123',
            releaseId,
            manifestSha256,
        });
    });

    it('rejects local and non-HTTPS base URLs', () => {
        expect(() =>
            loadReleaseSmokeContext({
                ...previewEnvironment(),
                BASE_URL: 'http://localhost:5090',
            })
        ).toThrow('BASE_URL must be a remote HTTPS origin');
    });

    it('requires production to use the configured production origin', () => {
        expect(() =>
            loadReleaseSmokeContext({
                ...previewEnvironment(),
                RELEASE_SMOKE_TARGET: 'production',
                RELEASE_SMOKE_PREVIEW_ID: undefined,
            })
        ).toThrow('Production smoke must use AQUILA_PRODUCTION_WEB_ORIGIN');
    });

    it('rejects a preview ID for production', () => {
        expect(() =>
            loadReleaseSmokeContext({
                ...previewEnvironment(),
                BASE_URL: 'https://game.example.com',
                RELEASE_SMOKE_TARGET: 'production',
            })
        ).toThrow('Production smoke must not provide RELEASE_SMOKE_PREVIEW_ID');
    });
});
```

- [ ] **Step 2: Verify the test fails because the module is absent**

```bash
cd packages/e2e
bun test release-smoke-env.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the parser**

Create `packages/e2e/release-smoke-env.ts`:

```ts
import {
    isPreviewId,
    isReleaseId,
    isSha256,
} from '@aquila/stories/runtime-assets';

export type ReleaseSmokeContext = {
    target: 'preview' | 'production';
    baseUrl: string;
    productionOrigin: string;
    previewId?: string;
    releaseId: string;
    manifestSha256: string;
};

type Environment = Readonly<Record<string, string | undefined>>;

function required(environment: Environment, name: string): string {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
}

function remoteHttpsOrigin(value: string, name: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`${name} must be a remote HTTPS origin`);
    }
    const hostname = url.hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.+$/, '');
    const local =
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname === '0.0.0.0' ||
        hostname === '::' ||
        hostname === '::1' ||
        /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (
        url.protocol !== 'https:' ||
        url.username !== '' ||
        url.password !== '' ||
        url.pathname !== '/' ||
        url.search !== '' ||
        url.hash !== '' ||
        local
    ) {
        throw new Error(`${name} must be a remote HTTPS origin`);
    }
    return url.origin;
}

export function loadReleaseSmokeContext(
    environment: Environment
): ReleaseSmokeContext {
    const target = required(environment, 'RELEASE_SMOKE_TARGET');
    if (target !== 'preview' && target !== 'production') {
        throw new Error('RELEASE_SMOKE_TARGET must be preview or production');
    }

    const baseUrl = remoteHttpsOrigin(
        required(environment, 'BASE_URL'),
        'BASE_URL'
    );
    const productionOrigin = remoteHttpsOrigin(
        required(environment, 'AQUILA_PRODUCTION_WEB_ORIGIN'),
        'AQUILA_PRODUCTION_WEB_ORIGIN'
    );
    const releaseId = required(environment, 'RELEASE_SMOKE_RELEASE_ID');
    const manifestSha256 = required(
        environment,
        'RELEASE_SMOKE_MANIFEST_SHA256'
    );
    if (!isReleaseId(releaseId)) {
        throw new Error('RELEASE_SMOKE_RELEASE_ID is invalid');
    }
    if (!isSha256(manifestSha256)) {
        throw new Error('RELEASE_SMOKE_MANIFEST_SHA256 is invalid');
    }

    const previewId = environment.RELEASE_SMOKE_PREVIEW_ID?.trim();
    if (target === 'preview') {
        if (baseUrl === productionOrigin) {
            throw new Error('Preview smoke must not use production origin');
        }
        if (!previewId || !isPreviewId(previewId)) {
            throw new Error('Preview smoke requires RELEASE_SMOKE_PREVIEW_ID');
        }
        return {
            target,
            baseUrl,
            productionOrigin,
            previewId,
            releaseId,
            manifestSha256,
        };
    }

    if (previewId) {
        throw new Error(
            'Production smoke must not provide RELEASE_SMOKE_PREVIEW_ID'
        );
    }
    if (baseUrl !== productionOrigin) {
        throw new Error(
            'Production smoke must use AQUILA_PRODUCTION_WEB_ORIGIN'
        );
    }
    return {
        target,
        baseUrl,
        productionOrigin,
        releaseId,
        manifestSha256,
    };
}
```

- [ ] **Step 4: Run the parser tests**

```bash
cd packages/e2e
bun test release-smoke-env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the remote Playwright config**

Create `packages/e2e/playwright.release-smoke.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { loadReleaseSmokeContext } from './release-smoke-env';

const context = loadReleaseSmokeContext(process.env);

export default defineConfig({
    testDir: './tests',
    testMatch: /visual-novel-release-smoke\.spec\.ts$/,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { open: 'never' }], ['list']],
    use: {
        baseURL: context.baseUrl,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'release-chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'release-mobile-chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],
});
```

- [ ] **Step 6: Add the deployed-reader smoke**

Create `packages/e2e/tests/visual-novel-release-smoke.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { loadReleaseSmokeContext } from '../release-smoke-env';
import { VisualReaderPage } from './utils';

const context = loadReleaseSmokeContext(process.env);

async function expectReleaseIdentity(page: Page): Promise<void> {
    const ready = page.getByTestId('reader-ready');
    await expect(ready).toHaveAttribute(
        'data-asset-environment',
        context.target
    );
    await expect(ready).toHaveAttribute(
        'data-asset-release-id',
        context.releaseId
    );
    await expect(ready).toHaveAttribute(
        'data-asset-manifest-sha256',
        context.manifestSha256
    );
    if (context.target === 'preview') {
        await expect(ready).toHaveAttribute(
            'data-asset-preview-id',
            context.previewId!
        );
    } else {
        await expect(ready).not.toHaveAttribute('data-asset-preview-id');
    }
}

test('opens the exact release and preserves identity through progression and a mode swap', async ({
    page,
}) => {
    const visual = new VisualReaderPage(page);
    await visual.goto(6);

    await expect(visual.root).toHaveAttribute(
        'data-visual-release-state',
        'ready'
    );
    await expect(visual.activeBackground).toHaveAttribute(
        'data-bg-state',
        'ready'
    );
    await expect(visual.portrait).toHaveAttribute(
        'data-portrait-state',
        'ready'
    );
    await expectReleaseIdentity(page);

    await visual.root.click();
    await expect(page).toHaveURL(/[?&]dialogue=7(?:&|$)/);
    await expect(visual.portrait).toHaveAttribute(
        'data-portrait-slot',
        'left'
    );
    await expectReleaseIdentity(page);

    await page.getByRole('button', { name: 'Text', exact: true }).click();
    await expect(visual.root).not.toBeAttached();
    await expect(page).toHaveURL(/[?&]dialogue=7(?:&|$)/);
    await expectReleaseIdentity(page);

    await page
        .getByRole('button', { name: 'Visual Novel', exact: true })
        .click();
    await expect(visual.root).toHaveAttribute(
        'data-visual-release-state',
        'ready'
    );
    await expectReleaseIdentity(page);
});
```

Do not duplicate fallback, history, bookmark, reduced-motion, lazy-loading, or broader navigation tests here.

- [ ] **Step 7: Add scripts and exclude the remote spec from local E2E**

Add these scripts to `packages/e2e/package.json`:

```json
"test": "bun test release-smoke-env.test.ts",
"test:release-smoke": "playwright test --config=playwright.release-smoke.config.ts"
```

In `playwright.config.ts`, add:

```ts
const LOCAL_E2E_TEST_IGNORE = [
    /visual-novel-release-smoke\.spec\.ts$/,
];
```

Set `testIgnore: LOCAL_E2E_TEST_IGNORE` at the top level. Change the Chromium project's ignore to:

```ts
testIgnore: [
    ...LOCAL_E2E_TEST_IGNORE,
    /reader-mobile\.spec\.ts/,
],
```

Add `testIgnore: LOCAL_E2E_TEST_IGNORE` to both mobile projects.

- [ ] **Step 8: Verify parser behavior and Playwright collection**

```bash
bun --filter e2e test

BASE_URL=https://preview.example.com \
AQUILA_PRODUCTION_WEB_ORIGIN=https://game.example.com \
RELEASE_SMOKE_TARGET=preview \
RELEASE_SMOKE_PREVIEW_ID=release-123 \
RELEASE_SMOKE_RELEASE_ID=sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
RELEASE_SMOKE_MANIFEST_SHA256=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
bun --filter e2e test:release-smoke -- --list
```

Expected: parser tests PASS; Playwright lists two tests and starts no local server.

- [ ] **Step 9: Commit**

```bash
git add \
  packages/e2e/release-smoke-env.ts \
  packages/e2e/release-smoke-env.test.ts \
  packages/e2e/playwright.release-smoke.config.ts \
  packages/e2e/tests/visual-novel-release-smoke.spec.ts \
  packages/e2e/package.json \
  packages/e2e/playwright.config.ts
git commit -m "test(e2e): add remote visual release smoke"
```

---

### Task 4: Add the single two-job release workflow

**Files:**
- Create: `.github/workflows/visual-novel-release.yml`

**Interfaces:**
- Repository secrets: `R2_PUBLISHER_ACCESS_KEY_ID`, `R2_PUBLISHER_SECRET_ACCESS_KEY`, `VERCEL_TOKEN`.
- Repository variables: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PUBLIC_ASSET_BASE_URL`, `AQUILA_PRODUCTION_WEB_ORIGIN`.
- GitHub Environment: `visual-novel-release-approval`, configured with a required reviewer.
- `qualify-preview` outputs `release_id`, `manifest_sha256`, `preview_id`, and `deployment_url`.
- `activate-production` consumes those exact outputs.

- [ ] **Step 1: Create the workflow header and preview job setup**

Create `.github/workflows/visual-novel-release.yml` with:

```yaml
name: Visual Novel Release

on:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: visual-novel-release
  cancel-in-progress: false

env:
  BUN_VERSION: '1.3.1'
  NODE_VERSION: '22'
  VERCEL_CLI_VERSION: '54.17.2'
  STORY_ID: the_seventh_mirror
  PREVIEW_ID: release-${{ github.run_id }}-${{ github.run_attempt }}
  RELEASE_DIR: .release
  TURBO_TELEMETRY_DISABLED: '1'
  CI: 'true'

jobs:
  qualify-preview:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    outputs:
      release_id: ${{ steps.candidate.outputs.release_id }}
      manifest_sha256: ${{ steps.candidate.outputs.manifest_sha256 }}
      preview_id: ${{ steps.candidate.outputs.preview_id }}
      deployment_url: ${{ steps.deploy.outputs.deployment_url }}
    steps:
      - name: Require a main-branch dispatch
        shell: bash
        run: |
          set -euo pipefail
          if [[ "$GITHUB_REF" != "refs/heads/main" ]]; then
            echo 'Visual releases must be dispatched from main.' >&2
            exit 1
          fi

      - name: Checkout exact main commit
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          ref: ${{ github.sha }}
          persist-credentials: false

      - name: Setup Bun
        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile
```

- [ ] **Step 2: Validate configuration and publish the immutable candidate**

Append to `qualify-preview.steps`:

```yaml
      - name: Validate release configuration
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
          PUBLIC_ASSET_BASE_URL: ${{ vars.PUBLIC_ASSET_BASE_URL }}
          AQUILA_PRODUCTION_WEB_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
        shell: bash
        run: |
          set -euo pipefail
          for variable in \
            R2_PUBLISHER_ACCESS_KEY_ID \
            R2_PUBLISHER_SECRET_ACCESS_KEY \
            VERCEL_TOKEN \
            VERCEL_ORG_ID \
            VERCEL_PROJECT_ID \
            PUBLIC_ASSET_BASE_URL \
            AQUILA_PRODUCTION_WEB_ORIGIN
          do
            if [[ -z "${!variable:-}" ]]; then
              echo "$variable is not configured." >&2
              exit 1
            fi
          done

      - name: Publish production candidate without activation
        id: candidate
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p "$RELEASE_DIR/reports"
          bun --filter @aquila/infra-cloudflare assets -- publish \
            --story "$STORY_ID" \
            --environment production \
            --destination r2 \
            --no-activate \
            --json > "$RELEASE_DIR/reports/publish-candidate.json"

          jq -e '
            (.status == "success" or .status == "no-op") and
            (.releaseId | type == "string") and
            (.manifestSha256 | type == "string") and
            (.counts.pointersWritten == 0) and
            ((.pointer.changed // false) == false)
          ' "$RELEASE_DIR/reports/publish-candidate.json" > /dev/null

          release_id="$(jq -r '.releaseId' "$RELEASE_DIR/reports/publish-candidate.json")"
          manifest_sha256="$(jq -r '.manifestSha256' "$RELEASE_DIR/reports/publish-candidate.json")"
          [[ "$release_id" =~ ^sha256-[a-f0-9]{64}$ ]]
          [[ "$manifest_sha256" =~ ^[a-f0-9]{64}$ ]]
          {
            echo "release_id=$release_id"
            echo "manifest_sha256=$manifest_sha256"
            echo "preview_id=$PREVIEW_ID"
          } >> "$GITHUB_OUTPUT"
```

- [ ] **Step 3: Mirror and activate only the run-scoped preview**

Append:

```yaml
      - name: Mirror and activate the exact preview release
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
          RELEASE_ID: ${{ steps.candidate.outputs.release_id }}
          MANIFEST_SHA256: ${{ steps.candidate.outputs.manifest_sha256 }}
        shell: bash
        run: |
          set -euo pipefail
          bun --filter @aquila/infra-cloudflare assets -- mirror-preview \
            --story "$STORY_ID" \
            --release "$RELEASE_ID" \
            --preview-id "$PREVIEW_ID" \
            --expect-manifest-sha256 "$MANIFEST_SHA256" \
            --destination r2 \
            --json > "$RELEASE_DIR/reports/mirror-preview.json"

          bun --filter @aquila/infra-cloudflare assets -- activate \
            --story "$STORY_ID" \
            --environment preview \
            --preview-id "$PREVIEW_ID" \
            --release "$RELEASE_ID" \
            --expect-manifest-sha256 "$MANIFEST_SHA256" \
            --destination r2 \
            --json > "$RELEASE_DIR/reports/activate-preview.json"

          jq -e --arg release "$RELEASE_ID" '
            (.status == "success" or .status == "no-op") and
            (.releaseId == $release)
          ' "$RELEASE_DIR/reports/activate-preview.json" > /dev/null
```

Do not add a second evidence-binding layer; these publisher commands already verify exact immutable identities.

- [ ] **Step 4: Deploy the exact checkout as a Vercel preview**

Append:

```yaml
      - name: Link the Vercel preview project
        working-directory: apps/web
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
        run: >-
          bunx --bun "vercel@${VERCEL_CLI_VERSION}" pull
          --yes
          --environment=preview
          --token "$VERCEL_TOKEN"

      - name: Deploy exact preview build
        id: deploy
        working-directory: apps/web
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
          PUBLIC_ASSET_BASE_URL: ${{ vars.PUBLIC_ASSET_BASE_URL }}
        shell: bash
        run: |
          set -euo pipefail
          deployment_url="$(bunx --bun "vercel@${VERCEL_CLI_VERSION}" deploy \
            --yes \
            --token "$VERCEL_TOKEN" \
            --build-env "PUBLIC_ASSET_BASE_URL=$PUBLIC_ASSET_BASE_URL" \
            --build-env "PUBLIC_ASSET_ENVIRONMENT=preview" \
            --build-env "PUBLIC_ASSET_PREVIEW_ID=$PREVIEW_ID")"
          deployment_url="${deployment_url%/}"
          if [[ "$deployment_url" == *$'\n'* ]] || \
             [[ ! "$deployment_url" =~ ^https://[^[:space:]]+$ ]]; then
            echo 'Vercel did not return one HTTPS deployment URL.' >&2
            exit 1
          fi
          echo "deployment_url=$deployment_url" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 5: Run the preview smoke and retain standard reports**

Append:

```yaml
      - name: Install Playwright Chromium
        working-directory: packages/e2e
        run: bunx playwright install --with-deps chromium

      - name: Run deployed preview smoke
        env:
          BASE_URL: ${{ steps.deploy.outputs.deployment_url }}
          AQUILA_PRODUCTION_WEB_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
          RELEASE_SMOKE_TARGET: preview
          RELEASE_SMOKE_PREVIEW_ID: ${{ env.PREVIEW_ID }}
          RELEASE_SMOKE_RELEASE_ID: ${{ steps.candidate.outputs.release_id }}
          RELEASE_SMOKE_MANIFEST_SHA256: ${{ steps.candidate.outputs.manifest_sha256 }}
        run: bun --filter e2e test:release-smoke

      - name: Write preview summary
        if: ${{ success() }}
        env:
          RELEASE_ID: ${{ steps.candidate.outputs.release_id }}
          DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment_url }}
        shell: bash
        run: |
          {
            echo '## Visual novel preview qualified'
            echo ''
            echo "- Commit: \`$GITHUB_SHA\`"
            echo "- Story: \`$STORY_ID\`"
            echo "- Preview: \`$PREVIEW_ID\`"
            echo "- Release: \`$RELEASE_ID\`"
            echo "- Deployment: $DEPLOYMENT_URL"
            echo ''
            echo 'Production requires approval of visual-novel-release-approval.'
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Upload preview reports
        if: ${{ always() }}
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: visual-novel-preview-${{ github.run_id }}
          path: |
            .release/reports/*.json
            packages/e2e/playwright-report/**
            packages/e2e/test-results/**
          if-no-files-found: warn
          retention-days: 14
          overwrite: false
```

- [ ] **Step 6: Add the protected production job and capture the current release**

Append a second job:

```yaml
  activate-production:
    needs: qualify-preview
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment:
      name: visual-novel-release-approval
      url: ${{ needs.qualify-preview.outputs.deployment_url }}
    steps:
      - name: Checkout exact qualified commit
        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4
        with:
          ref: ${{ github.sha }}
          persist-credentials: false

      - name: Setup Bun
        uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Require the production web origin to be reachable
        env:
          PRODUCTION_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
        run: >-
          curl --fail --silent --show-error --location
          --max-time 30 "$PRODUCTION_ORIGIN/" > /dev/null

      - name: Capture prior active production release
        id: previous
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p "$RELEASE_DIR/reports"
          bun --filter @aquila/infra-cloudflare assets -- releases \
            --story "$STORY_ID" \
            --environment production \
            --destination r2 \
            --deep \
            --json > "$RELEASE_DIR/reports/releases-before.json"

          active_count="$(jq '[.releases[]? | select(.active == true)] | length' "$RELEASE_DIR/reports/releases-before.json")"
          if [[ "$active_count" -gt 1 ]]; then
            echo 'Publisher reported more than one active release.' >&2
            exit 1
          fi
          if [[ "$active_count" -eq 1 ]]; then
            release_id="$(jq -r '.releases[] | select(.active == true) | .releaseId' "$RELEASE_DIR/reports/releases-before.json")"
            manifest_sha256="$(jq -r '.releases[] | select(.active == true) | .manifestSha256' "$RELEASE_DIR/reports/releases-before.json")"
            [[ "$release_id" =~ ^sha256-[a-f0-9]{64}$ ]]
            [[ "$manifest_sha256" =~ ^[a-f0-9]{64}$ ]]
            {
              echo "release_id=$release_id"
              echo "manifest_sha256=$manifest_sha256"
            } >> "$GITHUB_OUTPUT"
          fi
```

- [ ] **Step 7: Reverify and activate the exact qualified candidate**

Append:

```yaml
      - name: Deep verify exact production candidate
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
          RELEASE_ID: ${{ needs.qualify-preview.outputs.release_id }}
          MANIFEST_SHA256: ${{ needs.qualify-preview.outputs.manifest_sha256 }}
        shell: bash
        run: |
          set -euo pipefail
          bun --filter @aquila/infra-cloudflare assets -- verify \
            --story "$STORY_ID" \
            --environment production \
            --release "$RELEASE_ID" \
            --expect-manifest-sha256 "$MANIFEST_SHA256" \
            --destination r2 \
            --deep \
            --json > "$RELEASE_DIR/reports/verify-before-activation.json"

      - name: Activate exact production release
        id: activate
        env:
          R2_PUBLISHER_ACCESS_KEY_ID: ${{ secrets.R2_PUBLISHER_ACCESS_KEY_ID }}
          R2_PUBLISHER_SECRET_ACCESS_KEY: ${{ secrets.R2_PUBLISHER_SECRET_ACCESS_KEY }}
          RELEASE_ID: ${{ needs.qualify-preview.outputs.release_id }}
          MANIFEST_SHA256: ${{ needs.qualify-preview.outputs.manifest_sha256 }}
        shell: bash
        run: |
          set -euo pipefail
          bun --filter @aquila/infra-cloudflare assets -- activate \
            --story "$STORY_ID" \
            --environment production \
            --release "$RELEASE_ID" \
            --expect-manifest-sha256 "$MANIFEST_SHA256" \
            --confirm-production "$STORY_ID" \
            --destination r2 \
            --json > "$RELEASE_DIR/reports/activate-production.json"

          jq -e --arg release "$RELEASE_ID" '
            (.status == "success" or .status == "no-op") and
            (.releaseId == $release) and
            (.pointer.afterReleaseId == $release)
          ' "$RELEASE_DIR/reports/activate-production.json" > /dev/null
```

- [ ] **Step 8: Run production smoke and emit rollback guidance**

Append:

```yaml
      - name: Install Playwright Chromium
        working-directory: packages/e2e
        run: bunx playwright install --with-deps chromium

      - name: Run production smoke
        env:
          BASE_URL: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
          AQUILA_PRODUCTION_WEB_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
          RELEASE_SMOKE_TARGET: production
          RELEASE_SMOKE_RELEASE_ID: ${{ needs.qualify-preview.outputs.release_id }}
          RELEASE_SMOKE_MANIFEST_SHA256: ${{ needs.qualify-preview.outputs.manifest_sha256 }}
        run: bun --filter e2e test:release-smoke -- --project=release-chromium

      - name: Write rollback guidance after post-activation failure
        if: ${{ failure() && steps.activate.outcome == 'success' }}
        env:
          PREVIOUS_RELEASE_ID: ${{ steps.previous.outputs.release_id }}
          PREVIOUS_MANIFEST_SHA256: ${{ steps.previous.outputs.manifest_sha256 }}
        shell: bash
        run: |
          {
            echo '## Production verification failed after activation'
            echo ''
            if [[ -n "$PREVIOUS_RELEASE_ID" && -n "$PREVIOUS_MANIFEST_SHA256" ]]; then
              echo 'Review the failure, then use:'
              echo ''
              echo '```bash'
              echo 'bun --filter @aquila/infra-cloudflare assets -- rollback \'
              echo "  --story $STORY_ID \\"
              echo '  --environment production \'
              echo "  --release $PREVIOUS_RELEASE_ID \\"
              echo "  --expect-manifest-sha256 $PREVIOUS_MANIFEST_SHA256 \\"
              echo "  --confirm-production $STORY_ID \\"
              echo '  --destination r2 \'
              echo '  --json'
              echo '```'
            else
              echo 'No prior active release was available for rollback.'
            fi
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Write successful production summary
        if: ${{ success() }}
        env:
          RELEASE_ID: ${{ needs.qualify-preview.outputs.release_id }}
          PRODUCTION_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
        shell: bash
        run: |
          {
            echo '## Visual novel production release passed'
            echo ''
            echo "- Commit: \`$GITHUB_SHA\`"
            echo "- Release: \`$RELEASE_ID\`"
            echo "- Production: $PRODUCTION_ORIGIN"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Upload production reports
        if: ${{ always() }}
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with:
          name: visual-novel-production-${{ github.run_id }}
          path: |
            .release/reports/*.json
            packages/e2e/playwright-report/**
            packages/e2e/test-results/**
          if-no-files-found: warn
          retention-days: 30
          overwrite: false
```

- [ ] **Step 9: Validate workflow syntax and architecture scope**

```bash
actionlint .github/workflows/visual-novel-release.yml

git diff --unified=0 main...HEAD -- \
  .github/workflows/visual-novel-release.yml \
  packages/e2e \
  apps/web/src \
  | rg "workflow_run|actions/attest|release-gate-workflow-evidence|manual-review|workflow-approval|bun:ffi|openat"
```

Expected: `actionlint` exits 0. The `git diff | rg` command exits 1 because none of the forbidden architecture appears in changed lines.

- [ ] **Step 10: Commit**

```bash
git add .github/workflows/visual-novel-release.yml
git commit -m "ci: add simplified visual novel release workflow"
```

---

### Task 5: Document operations and verify the complete change

**Files:**
- Create: `docs/infrastructure/visual-novel-release.md`
- Modify: `docs/infrastructure/visual-asset-publisher.md`
- Modify: `.github/workflows/r2-publisher-preview.yml`

- [ ] **Step 1: Rename the existing publisher workflow only**

Change the first line of `.github/workflows/r2-publisher-preview.yml` to:

```yaml
name: R2 Publisher Regression Gate
```

Do not change any fixture or publisher behavior in that workflow.

- [ ] **Step 2: Write the release runbook**

Create `docs/infrastructure/visual-novel-release.md` with these sections and exact operational decisions:

```markdown
# Visual novel release workflow

`Visual Novel Release` releases `the_seventh_mirror` from the exact commit used
for a manual `main` dispatch. It reuses the immutable publisher and does not add
a second release, pointer, verifier, approval, or rollback model.

## Repository setup

Secrets:

- `R2_PUBLISHER_ACCESS_KEY_ID`
- `R2_PUBLISHER_SECRET_ACCESS_KEY`
- `VERCEL_TOKEN`

Variables:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `PUBLIC_ASSET_BASE_URL`
- `AQUILA_PRODUCTION_WEB_ORIGIN`

Create the `visual-novel-release-approval` GitHub Environment with a required
reviewer. Its review URL is the qualified preview deployment. The preview must
be reachable by GitHub-hosted Playwright without interactive deployment
protection.

## Before dispatch

1. Merge through the protected `main` path and wait for normal CI.
2. Confirm the HPA-231 production release plan and source assets are present.
3. Confirm Vercel's normal production deployment for that `main` commit is
   ready.
4. Dispatch `Visual Novel Release` from `main`.

## Preview qualification

The workflow derives a run-scoped preview ID, publishes an immutable production
candidate without activating production, mirrors and activates only the preview
pointer, deploys the exact checkout with preview asset configuration, and runs
Desktop and Mobile Chromium smoke tests. Release ID and manifest checksum come
from the publisher JSON report, never operator input.

## Approval and production

Review the preview URL shown by the protected environment. Approve only when the
story opens, the expected visuals decode, progression works, and the reader's
release identity matches the workflow summary. The production job deep-verifies
that same immutable candidate, atomically activates it, and runs Desktop
Chromium against the configured production origin.

## Preview-only rehearsal

After the workflow first lands, dispatch it from `main`, inspect the preview and
artifacts, leave the protected production job unapproved, and cancel the run.
This validates the non-production path without changing production.

## Failures and rollback

Failure before production approval leaves the production pointer unchanged.
Immutable candidate objects may remain and are safe to reuse. The workflow does
not auto-rollback. If post-activation verification fails, inspect the retained
publisher and Playwright reports, then use the prior release identity recorded
in `releases-before.json`:

```bash
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story the_seventh_mirror \
  --environment production \
  --release "$PREVIOUS_RELEASE_ID" \
  --expect-manifest-sha256 "$PREVIOUS_MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2 \
  --json > production-rollback.json
```

## Ownership

- `R2 Publisher Regression Gate` owns isolated publisher lifecycle regression.
- `Visual Novel Release` owns the real story's preview, approval, activation,
  and production smoke.
- Ordinary CI owns broad application regression coverage.
- The existing publisher owns immutable release verification, pointer mutation,
  concurrency protection, release listing, and rollback.
```

- [ ] **Step 3: Link the existing publisher runbook**

In `docs/infrastructure/visual-asset-publisher.md`, replace the sentence assigning run-scoped browser verification to HPA-233 with:

```markdown
Routine run-scoped browser verification is performed by the
[Visual novel release workflow](./visual-novel-release.md). The fixed HPA-229
public verifier remains a regression check for its seeded `smoke` preview; it is
not the release workflow.
```

At the beginning of `## Activate production after approval`, replace the current approval sentence with:

```markdown
For routine releases, use the
[Visual novel release workflow](./visual-novel-release.md), which derives the
release ID and checksum from publisher output and pauses at the protected GitHub
Environment before running this activation. The manual command remains useful
for incident recovery and publisher diagnosis:
```

Keep the existing manual activation command unchanged.

- [ ] **Step 4: Run focused verification**

```bash
bun --filter web test -- \
  src/components/__tests__/ReaderShell.test.ts \
  src/lib/visual-assets/__tests__/visual-state-controller.test.ts
bun --filter e2e test

actionlint \
  .github/workflows/visual-novel-release.yml \
  .github/workflows/r2-publisher-preview.yml

git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 5: Run repository verification**

```bash
bun run test -- --force
bun run lint -- --force
bun run build -- --force
```

Expected: all Turbo tasks pass. Ordinary local E2E does not collect `visual-novel-release-smoke.spec.ts`.

- [ ] **Step 6: Confirm the YAGNI boundary**

```bash
git diff --stat main...HEAD

git diff --name-only main...HEAD | sort

git diff --unified=0 main...HEAD | \
  rg "workflow_run|actions/attest|candidate-output\.v1\.tar|manual-review|workflow-approval|bun:ffi|openat"
```

Expected:

- Changes are limited to the files listed in this plan.
- No new `packages/infra-cloudflare/src/release-gate` directory exists.
- No release-gate workflow utility exists.
- The final `rg` exits 1 because the removed architecture is absent from changed lines.

- [ ] **Step 7: Commit**

```bash
git add \
  .github/workflows/r2-publisher-preview.yml \
  docs/infrastructure/visual-novel-release.md \
  docs/infrastructure/visual-asset-publisher.md
git commit -m "docs: document simplified visual novel releases"
```

---

## Pull Request and Operational Handoff

- Open a new implementation PR from a fresh branch based on `main`.
- State that PR #46 is superseded because hostile-candidate sealing, evidence graphs, attestations, and duplicated prepare/finalize runs were deliberately removed under YAGNI/KISS.
- Merge only after Unit Tests, Build & Lint, and ordinary E2E are green.
- After merge, perform the preview-only rehearsal and cancel while approval is pending.
- Close PR #46 as superseded only after that rehearsal succeeds.
- Use the same workflow for the first production release; approve only after inspecting the exact preview and commit identity.

## Deferred Pre-Release Hardening

Reconsider candidate sealing, attestations, independent prepare/finalize runs, evidence digest graphs, or descriptor-level evidence confinement only after a concrete trigger: multiple release operators, untrusted release initiators, recurring artifact mix-ups, compliance requirements, or an actual tampering incident.