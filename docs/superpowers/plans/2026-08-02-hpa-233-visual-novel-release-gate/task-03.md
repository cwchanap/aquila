# HPA-233 Implementation Plan — Task 3: Refactor the Public Delivery Verifier into Candidate and Active Services

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 3: Refactor the Public Delivery Verifier into Candidate and Active Services

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/public-release-verifier.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/public-release-verifier.test.ts`
- Modify: `packages/infra-cloudflare/src/verify.ts`
- Modify: `packages/infra-cloudflare/src/__tests__/verify.test.ts`

**Interfaces:**
- Consumes: Task 1 public verification schemas, HPA-227 parsers/path helpers/cache policies, existing `verify.ts` HTTP/header/object checks.
- Produces:

```ts
export type PublicVerifierDependencies = {
    fetch: typeof globalThis.fetch;
    decodeImage: (bytes: Uint8Array, mediaType: string) => Promise<{ width: number; height: number }>;
    now: () => Date;
};

export async function verifyPublicRelease(
    input: PublicReleaseVerificationInputV1,
    dependencies?: Partial<PublicVerifierDependencies>
): Promise<PublicReleaseVerificationResultV1>;
```

- [ ] **Step 1: Write candidate-mode tests proving `current.json` is never requested**

```ts
it('verifies an immutable candidate without reading the active pointer', async () => {
    const requests: string[] = [];
    const result = await verifyPublicRelease(candidateInput, {
        fetch: fixtureFetch(requests),
        decodeImage: fixtureDecoder,
    });

    expect(result.status).toBe('passed');
    expect(requests).not.toContainEqual(expect.stringContaining('/current.json'));
    expect(result.releaseId).toBe(candidateInput.releaseId);
});
```

- [ ] **Step 2: Write active-mode tests deriving required identity from pointer and bytes**

```ts
it('derives release and checksum from validated active documents', async () => {
    const result = await verifyPublicRelease(activeInput, {
        fetch: fixtureFetch(),
        decodeImage: fixtureDecoder,
    });
    expect(result.releaseId).toBe(FIXTURE_RELEASE_ID);
    expect(result.manifestSha256).toBe(FIXTURE_MANIFEST_SHA256);
});
```

Also test wrong CORS, cache directives, content type, object checksum, dimensions, forbidden fields, omitted identity leakage, and expected-checksum mismatch.

- [ ] **Step 3: Run and confirm failures**

```bash
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/public-release-verifier.test.ts
```

- [ ] **Step 4: Extract pure URL/header/body verification from `src/verify.ts`**

Do not move CLI constants into the reusable service. The reusable service accepts story, target, base URL, browser origin, mode, optional release ID, optional expected checksum, and omitted identities. The compatibility wrapper retains the existing `the_seventh_mirror`/`smoke` defaults.

- [ ] **Step 5: Implement candidate and active manifest resolution**

```ts
const manifestPath =
    input.mode === 'candidate'
        ? getReleaseManifestPath(input.target, input.storyId, input.releaseId!)
        : getReleaseManifestPath(input.target, input.storyId, pointer.releaseId);
```

Active mode must call `validatePointerManifestPair()`. Candidate mode must validate canonical release identity without fabricating a pointer.

- [ ] **Step 6: Return structured checks and diagnostics**

Use stable check IDs such as:

```text
pointer.fetch
pointer.cache
manifest.fetch
manifest.integrity
manifest.privacy
object.fetch
object.integrity
object.media-type
object.cache
object.decode
coverage.omitted-absent
```

Failures name story, target, release, checksum, qualified identity, safe path/public URL, stage, and stable code.

- [ ] **Step 7: Rebuild `src/verify.ts` as a compatibility wrapper**

The wrapper constructs active preview input for the existing smoke story, calls `verifyPublicRelease`, renders the established PASS/FAIL human output, and preserves its current exit behavior.

- [ ] **Step 8: Run compatibility and package tests**

```bash
bun --filter @aquila/infra-cloudflare test \
  src/release-gate/__tests__/public-release-verifier.test.ts \
  src/__tests__/verify.test.ts
bun --filter @aquila/infra-cloudflare test
```

- [ ] **Step 9: Commit the public verifier**

```bash
git add packages/infra-cloudflare/src/release-gate packages/infra-cloudflare/src/verify.ts packages/infra-cloudflare/src/__tests__/verify.test.ts
git commit -m "feat(infra): parameterize public release verification"
```

---
