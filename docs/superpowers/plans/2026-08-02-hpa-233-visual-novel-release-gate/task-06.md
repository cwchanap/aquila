# HPA-233 Implementation Plan — Task 6: Expose Stable Validated Release Identity on `ReaderShell`

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 6: Expose Stable Validated Release Identity on `ReaderShell`

**Files:**
- Modify: `apps/web/src/lib/visual-assets/types.ts`
- Modify: `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- Modify: `apps/web/src/lib/visual-assets/source-factory.ts`
- Modify: `apps/web/src/components/ReaderShell.svelte`
- Modify: `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- Modify: `apps/web/src/components/__tests__/ReaderShell.test.ts`

**Interfaces:**
- Consumes: validated `AssetResolverSource`, active pointer, and manifest checksum already returned by `loadActiveRelease()`.
- Produces:

```ts
export type VisualReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

export type VisualSnapshot = {
    release: VisualReleaseState;
    releaseIdentity: VisualReleaseIdentity | null;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portrait: VisualPortraitLayer;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
```

- [ ] **Step 1: Write controller tests for identity publication and clearing**

```ts
it('publishes validated identity when the release becomes ready', async () => {
    const controller = createController({ resolver: readyPreviewResolver() });
    const snapshots: VisualSnapshot[] = [];
    controller.subscribe(snapshot => snapshots.push(snapshot));
    controller.update(FIXTURE_INPUT);
    await flushPromises();

    expect(snapshots.at(-1)?.releaseIdentity).toEqual({
        assetEnvironment: 'preview',
        previewId: 'hpa-233-preview',
        releaseId: FIXTURE_RELEASE_ID,
        manifestSha256: FIXTURE_MANIFEST_SHA256,
    });
});

it('clears identity on invalid release and story replacement', async () => {
    // Drive ready -> invalid and story A -> story B.
    expect(finalSnapshot.releaseIdentity).toBeNull();
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
bun --filter web test src/lib/visual-assets/__tests__/visual-state-controller.test.ts
```

- [ ] **Step 3: Extend `VisualSnapshot` and initial state**

Add `releaseIdentity: null` to every initial/empty snapshot and preserve immutability through `Object.freeze()`.

- [ ] **Step 4: Thread source target into the controller**

Extend `VisualStateControllerOptions` with validated source identity rather than rereading `import.meta.env`:

```ts
export type VisualStateControllerOptions = {
    resolver: AssetResolver | null;
    source: AssetResolverSource;
    cache: VisualAssetCache;
    getSceneDialogue: GetSceneDialogue;
    now?: () => number;
};
```

On successful `loadActiveRelease`, construct identity from `source.environment`, `source.target`, `validated.pointer.releaseId`, and `validated.pointer.manifestSha256`. Clear identity on invalid/unavailable release, disposal, or story change.

- [ ] **Step 5: Write `ReaderShell` DOM tests**

```ts
it('hosts release identity on reader-ready across mode changes', async () => {
    render(ReaderShell, { createVisualRuntime: readyRuntimeFactory() });
    await user.click(screen.getByRole('button', { name: /visual novel/i }));
    const host = await screen.findByTestId('reader-ready');
    expect(host).toHaveAttribute('data-asset-environment', 'preview');
    expect(host).toHaveAttribute('data-asset-preview-id', 'hpa-233-preview');
    expect(host).toHaveAttribute('data-asset-release-id', FIXTURE_RELEASE_ID);
    expect(host).toHaveAttribute('data-asset-manifest-sha256', FIXTURE_MANIFEST_SHA256);

    await user.click(screen.getByRole('button', { name: /text mode/i }));
    expect(host).toHaveAttribute('data-asset-release-id', FIXTURE_RELEASE_ID);
});
```

Also assert attributes are absent before ready, absent after invalidation, and do not move to the `VisualNovelReader` leaf.

- [ ] **Step 6: Render stable attributes on `data-testid="reader-ready"`**

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

Keep identity state in `ReaderShell`, sourced from runtime/controller subscription, so it survives leaf unmounts. Clear it only when the runtime/story becomes invalid or is disposed.

- [ ] **Step 7: Run web tests and type checks**

```bash
bun --filter web test \
  src/lib/visual-assets/__tests__/visual-state-controller.test.ts \
  src/components/__tests__/ReaderShell.test.ts
bun --filter web test
bun run compile:check
```

- [ ] **Step 8: Commit web observability**

```bash
git add apps/web
git commit -m "feat(web): expose validated visual release identity"
```

---
