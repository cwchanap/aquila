# HPA-233 Simplified Visual Novel Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #46's audit-grade release-gate platform with a small, maintainable release path that qualifies one `main` commit in preview, pauses for GitHub environment approval, activates the exact immutable release, and runs a production smoke check.

**Architecture:** Implement from a fresh branch cut from `main`; do not build on or broadly cherry-pick PR #46. Keep the existing immutable publisher as the only release authority, add stable reader release identity for observability, add one remote Playwright smoke suite, and add one GitHub Actions workflow with `qualify-preview` and `activate-production` jobs. Standard GitHub logs, publisher JSON reports, Playwright reports, and the protected-environment approval are sufficient evidence for this hobby project.

**Tech Stack:** Bun 1.3.1, Node.js 22, TypeScript, Svelte 5, Astro 5, Vitest, Bun test, Playwright Chromium, GitHub Actions, Vercel CLI 54.17.2, Cloudflare R2, existing `@aquila/infra-cloudflare` publisher commands.

## Global Constraints

- Start execution from the latest `main`; PR #46 is reference material only and must not be used as the implementation base.
- Do not add a `workflow_run` bridge, candidate archive sealing, custom tar parser, artifact attestation, FFI filesystem validation, evidence hashing framework, manual-review JSON, workflow-approval JSON, stage-timing protocol, activation-readiness CLI, or new release-gate schemas.
- Do not modify the publisher's release, activation, rollback, or R2 storage contracts unless a task below explicitly requires it. This plan requires no publisher production-code changes.
- V1 releases only `the_seventh_mirror`; do not generalize the workflow to multiple stories until a second production story actually needs release support.
- Release workflow dispatches must fail unless `github.ref` is exactly `refs/heads/main`.
- The release ID and manifest SHA-256 must come from the publisher's JSON output. They must never be entered as workflow inputs.
- Preview qualification runs Desktop Chromium and Mobile Chromium. Production smoke runs Desktop Chromium only.
- Production activation occurs only after approval of the `visual-novel-release-approval` GitHub Environment.
- The preview job must not start PostgreSQL or rerun the full ordinary CI matrix. Required branch checks already own compile, unit, build, lint, and normal local E2E coverage.
- Do not add runtime npm dependencies. The E2E environment parser uses existing `@aquila/stories/runtime-assets` exports and Bun's built-in test runner.
- Keep files focused. No new implementation file should exceed roughly 250 lines; the workflow may exceed that only if splitting it would obscure the single release sequence.
- Do not auto-rollback. When production smoke fails after activation, retain reports and print the exact existing rollback command using the prior active release identity.

## File Map

### Create

- `.github/workflows/visual-novel-release.yml` — one manual `main`-only workflow with preview qualification and protected production activation.
- `packages/e2e/release-smoke-env.ts` — small validated environment loader shared by the remote config and smoke spec.
- `packages/e2e/release-smoke-env.test.ts` — focused Bun tests for preview/production origin and identity validation.
- `packages/e2e/playwright.release-smoke.config.ts` — remote-only Chromium config with no `webServer`.
- `packages/e2e/tests/visual-novel-release-smoke.spec.ts` — one representative deployed-reader smoke flow.
- `docs/infrastructure/visual-novel-release.md` — concise operator runbook for dispatch, approval, activation, smoke, and rollback.

### Modify

- `apps/web/src/lib/visual-assets/types.ts` — add `VisualReleaseIdentity` and `VisualSnapshot.releaseIdentity`.
- `apps/web/src/lib/visual-assets/visual-state-controller.ts` — publish the exact validated resolver source, release ID, and manifest checksum.
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts` — pin identity publication and clearing.
- `apps/web/src/components/ReaderShell.svelte` — expose stable non-secret identity attributes on `reader-ready`.
- `apps/web/src/components/__tests__/ReaderShell.test.ts` — prove identity persists across mode changes and clears on story replacement.
- `packages/e2e/package.json` — add environment tests and the release-smoke command.
- `packages/e2e/playwright.config.ts` — exclude the remote-only release smoke from ordinary local E2E collection.
- `.github/workflows/r2-publisher-preview.yml` — rename the display name to clarify that it is a publisher regression gate, not the release workflow.
- `docs/infrastructure/visual-asset-publisher.md` — point routine production releases to the simplified workflow while preserving manual publisher commands.

---

### Task 1: Add stable validated release identity to the visual controller

**Files:**
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Test: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`

**Interfaces:**
- Consumes: `AssetResolver.source`, `ValidatedAssetRelease.pointer.releaseId`, and `ValidatedAssetRelease.pointer.manifestSha256` from the existing runtime-assets contract.
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
- Invariant: `releaseIdentity` is non-null only when `release` is `ready` or `stale-but-usable`.

- [ ] **Step 1: Extend the controller test fixtures and write the failing identity test**

In `visual-state-controller.test.ts`, add stable values near `storyId` and update `release()` so the pointer supplies both fields the controller will expose:

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

Add `releaseIdentity: null` to the existing initial-snapshot expectation, then add this test:

```ts
it('publishes the exact validated release identity and clears it after failed revalidation', async () => {
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
        input([{ dialogue: 'Validated visual', background: 'room' }])
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

- [ ] **Step 2: Run the focused test and confirm it fails for the missing property**

Run:

```bash
bun --filter web test -- src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: FAIL because `VisualSnapshot` has no `releaseIdentity` and the initial snapshot does not contain it.

- [ ] **Step 3: Add the identity type and snapshot field**

Update `types.ts`:

```ts
import type { AssetResolverSource } from '@aquila/stories/runtime-assets';

export type VisualReleaseIdentity = {
    assetEnvironment: AssetResolverSource['environment'];
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};
```

Add the field to `VisualSnapshot` immediately after `release`:

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

- [ ] **Step 4: Publish identity from the existing resolver without adding a second source dependency**

In `visual-state-controller.ts`, import `VisualReleaseIdentity`, add `releaseIdentity: null` to `initialSnapshot()`, and add this helper:

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

Update `loadRelease()` so a fresh non-usable load clears identity, a validated load sets it, and a rejection clears it:

```ts
if (!hadUsableRelease) {
    this.publish({ release: 'loading', releaseIdentity: null });
}
```

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

```ts
this.publish({
    release: releaseStateForError(error),
    releaseIdentity: null,
});
```

Finally, normalize the field in `publish()` so any non-usable release state cannot retain old identity:

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

Do not add `source` to `VisualStateControllerOptions`; `AssetResolver.source` is already authoritative.

- [ ] **Step 5: Run the focused visual-state tests**

Run:

```bash
bun --filter web test -- src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the controller identity change**

```bash
git add \
  apps/web/src/lib/visual-assets/types.ts \
  apps/web/src/lib/visual-assets/visual-state-controller.ts \
  apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts
git commit -m "feat(web): expose validated visual release identity"
```

---

### Task 2: Surface release identity on the stable reader shell

**Files:**
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Test: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: `VisualSnapshot.releaseIdentity` from Task 1.
- Produces these optional attributes on the stable `data-testid="reader-ready"` host:
  - `data-asset-environment="local|preview|production"`
  - `data-asset-preview-id="<preview-id>"` for preview only
  - `data-asset-release-id="sha256-<digest>"`
  - `data-asset-manifest-sha256="<digest>"`
- Identity must remain attached while switching between visual and text modes because the retained runtime remains valid.
- Identity must clear before an old runtime is disposed or replaced.

- [ ] **Step 1: Make the ReaderShell harness capable of returning a validated release**

In `ReaderShell.test.ts`, extend the runtime-assets import with `ValidatedAssetRelease`. Change `createRuntimeHarness` to accept optional source and release values while preserving the current unavailable default:

```ts
function createRuntimeHarness(
    options: {
        source?: AssetResolverSource;
        release?: ValidatedAssetRelease;
    } = {}
): {
    runtime: VisualReaderRuntime;
    softRevalidate: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.spyOn>;
} {
    const source: AssetResolverSource =
        options.source ??
        ({
            environment: 'local',
            storyId: 'the_seventh_mirror',
            baseUrl: 'http://localhost:5090/assets/',
            target: { kind: 'preview', previewId: 'hpa-228-local' },
        } satisfies AssetResolverSource);
    const resolver: AssetResolver = {
        source,
        loadActiveRelease: vi.fn(async () => {
            if (options.release) return options.release;
            throw new AssetResolverError(
                'unavailable',
                'No visual release in this component test'
            );
        }),
        // keep the existing resolve, prefetchNextEdge, and clear members
    };
    // keep the existing cache, controller, spies, and return value
}
```

- [ ] **Step 2: Write the failing stable-host identity test**

Add this test to `ReaderShell.test.ts`:

```ts
it('keeps validated identity on the stable shell across mode changes and clears it on story replacement', async () => {
    stubMatchMedia(false);
    localStorage.setItem(READER_MODE_KEY, 'visual');
    readerState.dialogue = [
        {
            characterId: 'narrator',
            dialogue: 'A released visual line.',
            background: 'chapter_1/room',
        },
    ];

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
        props: { createVisualRuntime: () => harness.runtime },
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

- [ ] **Step 3: Run the ReaderShell test and confirm the attributes are absent**

Run:

```bash
bun --filter web test -- src/components/__tests__/ReaderShell.test.ts
```

Expected: FAIL because `reader-ready` does not expose release identity.

- [ ] **Step 4: Subscribe ReaderShell to the retained runtime identity**

In `ReaderShell.svelte`:

1. Import `VisualReleaseIdentity` from `@/lib/visual-assets`.
2. Add state and cleanup handles:

```ts
let visualIdentity = $state<VisualReleaseIdentity | null>(null);
let removeVisualIdentityListener = () => {};
```

3. At the start of `ensureVisualRuntime`, detach any old identity listener and clear identity. After creating the runtime, subscribe with the existing generation and runtime ownership guards:

```ts
removeVisualIdentityListener();
removeVisualIdentityListener = () => {};
visualIdentity = null;
visualRuntimeStoryId = activeStoryId;
visualRuntimeAttempted = true;
visualRuntime = createVisualRuntime(
    activeStoryId,
    runtimeOrigin(),
    getSceneDialogue
);
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

4. In `disposeRuntimeForStoryChange`, clear the listener and identity before nulling or disposing the runtime:

```ts
removeVisualIdentityListener();
removeVisualIdentityListener = () => {};
visualIdentity = null;
```

5. Repeat the same cleanup in `onDestroy` before disposing the runtime.

- [ ] **Step 5: Add non-secret identity attributes to `reader-ready`**

Update the stable host:

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

Do not add the identity to `VisualNovelReader`; that component unmounts in text mode and is not the stable deployment-observability surface.

- [ ] **Step 6: Run the ReaderShell and controller tests together**

```bash
bun --filter web test -- \
  src/components/__tests__/ReaderShell.test.ts \
  src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the stable shell identity**

```bash
git add \
  apps/web/src/components/ReaderShell.svelte \
  apps/web/src/components/__tests__/ReaderShell.test.ts
git commit -m "feat(web): expose release identity on reader shell"
```

---

### Task 3: Add one remote-only release smoke suite

**Files:**
- Create: `packages/e2e/release-smoke-env.ts`
- Create: `packages/e2e/release-smoke-env.test.ts`
- Create: `packages/e2e/playwright.release-smoke.config.ts`
- Create: `packages/e2e/tests/visual-novel-release-smoke.spec.ts`
- Modify: `packages/e2e/package.json`
- Modify: `packages/e2e/playwright.config.ts`

**Interfaces:**
- Consumes these environment variables:
  - `BASE_URL`
  - `AQUILA_PRODUCTION_WEB_ORIGIN`
  - `RELEASE_SMOKE_TARGET=preview|production`
  - `RELEASE_SMOKE_RELEASE_ID`
  - `RELEASE_SMOKE_MANIFEST_SHA256`
  - `RELEASE_SMOKE_PREVIEW_ID` for preview only
- Produces: one remote Playwright suite usable for preview and production without starting a local server.
- Preview command runs two projects: `release-chromium` and `release-mobile-chrome`.
- Production command selects only `release-chromium`.

- [ ] **Step 1: Write the failing environment-parser tests**

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
    it('loads an exact preview identity', () => {
        expect(loadReleaseSmokeContext(previewEnvironment())).toEqual({
            target: 'preview',
            baseUrl: 'https://preview.example.com',
            productionOrigin: 'https://game.example.com',
            previewId: 'release-123',
            releaseId,
            manifestSha256,
        });
    });

    it('requires production smoke to use the configured production origin', () => {
        expect(() =>
            loadReleaseSmokeContext({
                ...previewEnvironment(),
                RELEASE_SMOKE_TARGET: 'production',
                RELEASE_SMOKE_PREVIEW_ID: undefined,
            })
        ).toThrow('Production smoke must use AQUILA_PRODUCTION_WEB_ORIGIN');
    });

    it('rejects localhost and non-HTTPS origins', () => {
        expect(() =>
            loadReleaseSmokeContext({
                ...previewEnvironment(),
                BASE_URL: 'http://localhost:5090',
            })
        ).toThrow('BASE_URL must be a remote HTTPS origin');
    });

    it('rejects preview identity on a production target', () => {
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

- [ ] **Step 2: Run the new test and confirm the module is missing**

```bash
cd packages/e2e
bun test release-smoke-env.test.ts
```

Expected: FAIL because `release-smoke-env.ts` does not exist.

- [ ] **Step 3: Implement the small shared environment loader**

Create `packages/e2e/release-smoke-env.ts`:

```ts
import {
    isPreviewId,
    isReleaseId,
    isSha256,
} from '@aquila/stories/runtime-assets';

export type ReleaseSmokeTarget = 'preview' | 'production';

export type ReleaseSmokeContext = {
    target: ReleaseSmokeTarget;
    baseUrl: string;
    productionOrigin: string;
    previewId?: string;
    releaseId: string;
    manifestSha256: string;
};

type ReleaseSmokeEnvironment = Readonly<
    Record<string, string | undefined>
>;

function required(
    environment: ReleaseSmokeEnvironment,
    name: string
): string {
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
    environment: ReleaseSmokeEnvironment
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

- [ ] **Step 4: Run the environment-parser tests**

```bash
cd packages/e2e
bun test release-smoke-env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the remote-only Playwright config**

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

The config intentionally has no `globalSetup` and no `webServer`.

- [ ] **Step 6: Add one representative deployed-reader smoke test**

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

test('opens the exact released visuals and preserves identity through one progression and mode swap', async ({
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

Do not duplicate the full local visual-reader matrix. Existing local E2E remains responsible for fallback injection, history, bookmarks, reduced motion, lazy loading, and broader navigation.

- [ ] **Step 7: Add package scripts and exclude the remote spec from local E2E**

Update `packages/e2e/package.json` scripts:

```json
{
  "test": "bun test release-smoke-env.test.ts",
  "test:e2e": "playwright test",
  "test:release-smoke": "playwright test --config=playwright.release-smoke.config.ts"
}
```

In `playwright.config.ts`, define and apply an ignore list so project-level settings cannot accidentally collect the remote spec:

```ts
const LOCAL_E2E_TEST_IGNORE = [
    /visual-novel-release-smoke\.spec\.ts$/,
];
```

Add `testIgnore: LOCAL_E2E_TEST_IGNORE` at the top level. For the Chromium project use:

```ts
testIgnore: [
    ...LOCAL_E2E_TEST_IGNORE,
    /reader-mobile\.spec\.ts/,
],
```

Add `testIgnore: LOCAL_E2E_TEST_IGNORE` to both mobile projects.

- [ ] **Step 8: Verify unit behavior and Playwright collection without contacting a deployment**

Run:

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

Expected: environment tests PASS; Playwright lists exactly two tests, one for each Chromium project, and starts no local server.

- [ ] **Step 9: Commit the remote smoke suite**

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

### Task 4: Add the single preview-to-production release workflow

**Files:**
- Create: `.github/workflows/visual-novel-release.yml`

**Interfaces:**
- Uses repository secrets:
  - `R2_PUBLISHER_ACCESS_KEY_ID`
  - `R2_PUBLISHER_SECRET_ACCESS_KEY`
  - `VERCEL_TOKEN`
- Uses repository variables:
  - `VERCEL_ORG_ID`
  - `VERCEL_PROJECT_ID`
  - `PUBLIC_ASSET_BASE_URL`
  - `AQUILA_PRODUCTION_WEB_ORIGIN`
- Uses protected GitHub Environment `visual-novel-release-approval` with at least one required reviewer.
- `qualify-preview` outputs: `release_id`, `manifest_sha256`, `preview_id`, and `deployment_url`.
- `activate-production` consumes those exact outputs and accepts no operator-supplied release identity.

- [ ] **Step 1: Create the workflow with one concurrency lane and a loud `main` guard**

Create `.github/workflows/visual-novel-release.yml` with this top-level structure:

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
```

Do not add workflow inputs in V1.

- [ ] **Step 2: Add `qualify-preview` setup and exact candidate extraction**

Add the first job:

```yaml
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

      - name: Publish immutable production candidate without activation
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

- [ ] **Step 3: Mirror and activate only the run-scoped preview pointer**

Continue the preview job:

```yaml
      - name: Mirror and activate exact candidate in preview
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

Do not add separate evidence binding around these reports. The mirror command already deep-verifies the production source and exact preview manifest, and activation uses the existing publisher contract.

- [ ] **Step 4: Build and deploy one Vercel preview with the exact preview ID**

Add:

```yaml
      - name: Build and deploy exact preview
        id: deploy
        working-directory: apps/web
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ vars.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ vars.VERCEL_PROJECT_ID }}
          PUBLIC_ASSET_BASE_URL: ${{ vars.PUBLIC_ASSET_BASE_URL }}
          PUBLIC_ASSET_ENVIRONMENT: preview
          PUBLIC_ASSET_PREVIEW_ID: ${{ env.PREVIEW_ID }}
          VERCEL_ENV: preview
        shell: bash
        run: |
          set -euo pipefail
          bunx --bun "vercel@${VERCEL_CLI_VERSION}" pull \
            --yes \
            --environment=preview \
            --token "$VERCEL_TOKEN"
          bunx --bun "vercel@${VERCEL_CLI_VERSION}" build \
            --token "$VERCEL_TOKEN"
          deployment_url="$(bunx --bun "vercel@${VERCEL_CLI_VERSION}" deploy \
            --prebuilt \
            --yes \
            --token "$VERCEL_TOKEN")"
          deployment_url="${deployment_url%/}"
          if [[ "$deployment_url" == *$'\n'* || ! "$deployment_url" =~ ^https://[^[:space:]]+$ ]]; then
            echo 'Vercel did not return one HTTPS deployment URL.' >&2
            exit 1
          fi
          echo "deployment_url=$deployment_url" >> "$GITHUB_OUTPUT"
```

The preview deployment must be reachable by CI without an interactive login page.

- [ ] **Step 5: Install Chromium and run the two-project preview smoke**

Add:

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

      - name: Write preview review summary
        if: ${{ success() }}
        shell: bash
        run: |
          {
            echo '## Visual novel preview qualified'
            echo ''
            echo "- Commit: \`${GITHUB_SHA}\`"
            echo "- Story: \`${STORY_ID}\`"
            echo "- Preview: \`${PREVIEW_ID}\`"
            echo "- Release: \`${{ steps.candidate.outputs.release_id }}\`"
            echo "- Deployment: ${{ steps.deploy.outputs.deployment_url }}"
            echo ''
            echo 'The next job requires protected-environment approval before production activation.'
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

- [ ] **Step 6: Add the protected production job and capture the prior active release**

Add the second job:

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
            echo 'Publisher reported more than one active production release.' >&2
            exit 1
          fi
          if [[ "$active_count" -eq 1 ]]; then
            echo "release_id=$(jq -r '.releases[] | select(.active == true) | .releaseId' "$RELEASE_DIR/reports/releases-before.json")" >> "$GITHUB_OUTPUT"
            echo "manifest_sha256=$(jq -r '.releases[] | select(.active == true) | .manifestSha256' "$RELEASE_DIR/reports/releases-before.json")" >> "$GITHUB_OUTPUT"
          fi
```

- [ ] **Step 7: Reverify and atomically activate the exact qualified candidate**

Continue the production job:

```yaml
      - name: Reverify exact production candidate
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

The protected environment is the approval record. Do not generate a second approval artifact.

- [ ] **Step 8: Run one-project production smoke and print rollback guidance on failure**

Add:

```yaml
      - name: Install Playwright Chromium
        working-directory: packages/e2e
        run: bunx playwright install --with-deps chromium

      - name: Run production smoke
        id: production-smoke
        env:
          BASE_URL: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
          AQUILA_PRODUCTION_WEB_ORIGIN: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}
          RELEASE_SMOKE_TARGET: production
          RELEASE_SMOKE_RELEASE_ID: ${{ needs.qualify-preview.outputs.release_id }}
          RELEASE_SMOKE_MANIFEST_SHA256: ${{ needs.qualify-preview.outputs.manifest_sha256 }}
        run: bun --filter e2e test:release-smoke -- --project=release-chromium

      - name: Write rollback guidance after a failed post-activation smoke
        if: ${{ failure() && steps.activate.outcome == 'success' }}
        env:
          PREVIOUS_RELEASE_ID: ${{ steps.previous.outputs.release_id }}
          PREVIOUS_MANIFEST_SHA256: ${{ steps.previous.outputs.manifest_sha256 }}
        shell: bash
        run: |
          {
            echo '## Production smoke failed after activation'
            echo ''
            if [[ -n "$PREVIOUS_RELEASE_ID" && -n "$PREVIOUS_MANIFEST_SHA256" ]]; then
              echo 'Use the existing verified-release rollback after reviewing the smoke failure:'
              echo ''
              echo '```bash'
              echo 'bun --filter @aquila/infra-cloudflare assets -- rollback \\'
              echo "  --story $STORY_ID \\"
              echo '  --environment production \\'
              echo "  --release $PREVIOUS_RELEASE_ID \\"
              echo "  --expect-manifest-sha256 $PREVIOUS_MANIFEST_SHA256 \\"
              echo "  --confirm-production $STORY_ID \\"
              echo '  --destination r2 \\'
              echo '  --json'
              echo '```'
            else
              echo 'No prior active production release was available for rollback guidance.'
            fi
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Write successful production summary
        if: ${{ success() }}
        shell: bash
        run: |
          {
            echo '## Visual novel production release passed'
            echo ''
            echo "- Commit: \`${GITHUB_SHA}\`"
            echo "- Release: \`${{ needs.qualify-preview.outputs.release_id }}\`"
            echo "- Production: ${{ vars.AQUILA_PRODUCTION_WEB_ORIGIN }}"
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

- [ ] **Step 9: Validate workflow syntax and confirm forbidden architecture is absent**

Run:

```bash
actionlint .github/workflows/visual-novel-release.yml
rg -n "workflow_run|actions/attest|release-gate-workflow-evidence|manual-review|workflow-approval|bun:ffi|openat" \
  .github/workflows/visual-novel-release.yml \
  packages/e2e \
  apps/web/src
```

Expected: `actionlint` exits 0; `rg` returns no matches in the new implementation.

- [ ] **Step 10: Commit the workflow**

```bash
git add .github/workflows/visual-novel-release.yml
git commit -m "ci: add simplified visual novel release workflow"
```

---

### Task 5: Document operations, distinguish the regression gate, and run final verification

**Files:**
- Create: `docs/infrastructure/visual-novel-release.md`
- Modify: `docs/infrastructure/visual-asset-publisher.md`
- Modify: `.github/workflows/r2-publisher-preview.yml`

**Interfaces:**
- Documents repository configuration, normal dispatch, preview review, protected approval, production smoke, and manual rollback.
- Leaves `r2-publisher-preview.yml` responsible only for publisher lifecycle regression scenarios.

- [ ] **Step 1: Rename the existing publisher workflow display name**

Change only the first line of `.github/workflows/r2-publisher-preview.yml`:

```yaml
name: R2 Publisher Regression Gate
```

Do not change its fixture, concurrency, publisher checks, or R2 behavior in this task.

- [ ] **Step 2: Write the concise release runbook**

Create `docs/infrastructure/visual-novel-release.md` with these exact sections and operational rules:

```markdown
# Visual novel release workflow

The `Visual Novel Release` GitHub Actions workflow releases
`the_seventh_mirror` from an exact commit already merged to `main`. It uses the
existing immutable publisher; it does not introduce a second release format,
pointer, verifier, or rollback mechanism.

## Repository configuration

Configure these repository secrets:

- `R2_PUBLISHER_ACCESS_KEY_ID`
- `R2_PUBLISHER_SECRET_ACCESS_KEY`
- `VERCEL_TOKEN`

Configure these repository variables:

- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `PUBLIC_ASSET_BASE_URL`
- `AQUILA_PRODUCTION_WEB_ORIGIN`

Create the `visual-novel-release-approval` GitHub Environment and require the
release reviewer. The environment URL is the qualified Vercel preview, so the
reviewer can inspect the exact deployment before approving production.

## Release sequence

1. Merge the candidate through the normal protected `main` path and wait for
   required CI checks.
2. Dispatch `Visual Novel Release` from `main`.
3. The preview job publishes an immutable production candidate without
   activation, mirrors the exact manifest to a run-scoped preview ID, activates
   only that preview pointer, deploys the matching web build, and runs desktop
   and mobile Chromium smoke tests.
4. Review the preview URL shown in the workflow summary and approval screen.
5. Approve `visual-novel-release-approval` only when the story opens, the
   expected visuals decode, progression works, and the displayed release
   identity matches the workflow summary.
6. The production job deep-verifies the same immutable candidate, atomically
   activates it with the existing publisher, and runs the desktop production
   smoke.

The workflow accepts no release ID, checksum, preview ID, or candidate SHA from
the operator. Those values come from the checked-out `main` commit, workflow
run identity, and publisher JSON report.

## Preview-only rehearsal

After the workflow first lands, dispatch it from `main`, inspect the qualified
preview, and leave the protected production job unapproved. Cancel the run
after confirming the preview artifacts and smoke result. This validates the
non-production path without changing the production pointer.

## Failure behavior

- Failure before production approval leaves production unchanged.
- Immutable candidate objects may remain after failure and are safe to reuse.
- Failure during preview qualification blocks the production job.
- Failure after production activation retains publisher and Playwright reports
  and writes the exact rollback command to the job summary.
- The workflow never auto-rolls back; review the failure before changing the
  production pointer again.

## Manual rollback

Use the prior active release identity recorded in
`releases-before.json` from the production artifact:

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

After rollback, run the same production smoke command or redispatch a release
only after the incident is understood.

## Ownership

- `R2 Publisher Regression Gate` tests publisher lifecycle behavior with an
  isolated fixture.
- `Visual Novel Release` qualifies and releases the real story.
- Ordinary unit, build, lint, and local E2E workflows continue to own broad
  regression coverage.
- The immutable publisher remains authoritative for candidate verification,
  activation, concurrency protection, release listing, and rollback.
```

- [ ] **Step 3: Link the publisher runbook to the routine workflow**

In `visual-asset-publisher.md`, replace the sentence that assigns complete run-scoped browser verification to HPA-233 with:

```markdown
Routine run-scoped browser verification is performed by the
[Visual novel release workflow](./visual-novel-release.md). The fixed HPA-229
public verifier remains a regression check for its seeded `smoke` preview; it is
not the release workflow.
```

At the start of `## Activate production after approval`, replace the approval sentence with:

```markdown
For routine releases, use the
[Visual novel release workflow](./visual-novel-release.md), which derives the
release ID and checksum from publisher output and pauses at the protected GitHub
Environment before running this activation. The manual command remains useful
for incident recovery and publisher diagnosis:
```

Keep the existing manual command unchanged below that paragraph.

- [ ] **Step 4: Run targeted tests and static validation**

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

- [ ] **Step 5: Run repository-level verification**

```bash
bun run test -- --force
bun run lint -- --force
bun run build -- --force
```

Expected: all Turbo tasks pass. The ordinary E2E workflow should not collect `visual-novel-release-smoke.spec.ts`.

- [ ] **Step 6: Confirm the implementation stayed within the YAGNI boundary**

Run:

```bash
git diff --stat main...HEAD
find packages/infra-cloudflare/src -path '*release-gate*' -print
find packages/infra-cloudflare/scripts -name '*release-gate*' -print
rg -n "workflow_run|actions/attest|manual-review|workflow-approval|candidate-output\.v1\.tar|bun:ffi|openat" \
  .github apps packages docs/infrastructure/visual-novel-release.md
```

Expected:

- No new `packages/infra-cloudflare/src/release-gate` directory.
- No new release-gate workflow utility script.
- No custom evidence/archive/security framework.
- The implementation is concentrated in reader identity, one smoke suite, one workflow, and documentation.

- [ ] **Step 7: Commit the documentation and workflow distinction**

```bash
git add \
  .github/workflows/r2-publisher-preview.yml \
  docs/infrastructure/visual-novel-release.md \
  docs/infrastructure/visual-asset-publisher.md
git commit -m "docs: document simplified visual novel releases"
```

---

## Pull Request and Operational Handoff

- Open the implementation as a new PR from a fresh branch based on `main`; do not retarget PR #46 or merge its implementation commits.
- In the new PR description, state that PR #46 is superseded because the threat model and evidence platform were intentionally removed under YAGNI/KISS.
- Require normal Unit Tests, Build & Lint, and local E2E checks before merge.
- After merge, dispatch `Visual Novel Release` from `main` and perform the preview-only rehearsal described in the runbook. Cancel while the approval job is pending.
- After the rehearsal succeeds, close PR #46 as superseded and link the simplified implementation PR.
- The first real production release should use the same workflow; approve only after inspecting the generated preview URL and qualified release identity.

## Deferred Pre-Release Hardening

Reconsider stronger release controls only when a concrete need appears, such as multiple release operators, untrusted branches initiating releases, recurring artifact mix-ups, compliance requirements, or a real tampering incident. Candidate sealing, attestations, evidence digest graphs, independent prepare/finalize runs, and descriptor-level evidence confinement are deliberately outside this implementation.