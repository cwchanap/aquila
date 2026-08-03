# HPA-233 Implementation Plan — Task 2: Add Canonical Evidence Hashing and Safe Report Rendering

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 2: Add Canonical Evidence Hashing and Safe Report Rendering

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/evidence.ts`
- Create: `packages/infra-cloudflare/src/release-gate/report.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/evidence.test.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/report.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, `canonicalJson()` and SHA validators from `@aquila/stories/runtime-assets`, existing publisher report rendering conventions.
- Produces: `hashCanonicalEvidence`, `hashEvidenceFile`, `resolveEvidencePath`, `createEvidenceReference`, `renderGateJsonReport`, `renderGateHumanReport`, and `gateReportExitCode`.

- [ ] **Step 1: Write failing path-confinement and canonical-hash tests**

```ts
it('rejects evidence paths outside the configured directory', () => {
    expect(() => resolveEvidencePath('/tmp/evidence', '../secret.json')).toThrow(
        /outside evidence directory/
    );
});

it('hashes semantically identical JSON identically', () => {
    expect(hashCanonicalEvidence({ b: 2, a: 1 })).toBe(
        hashCanonicalEvidence({ a: 1, b: 2 })
    );
});
```

- [ ] **Step 2: Run and confirm the tests fail**

```bash
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/evidence.test.ts
```

Expected: FAIL because the evidence functions do not exist.

- [ ] **Step 3: Implement evidence-directory confinement**

```ts
export function resolveEvidencePath(root: string, relativePath: string): string {
    const absoluteRoot = resolve(root);
    const absolutePath = resolve(absoluteRoot, relativePath);
    const prefix = `${absoluteRoot}${sep}`;
    if (absolutePath !== absoluteRoot && !absolutePath.startsWith(prefix)) {
        throw gateInputError('evidence/path-outside-root', 'Evidence path is outside evidence directory');
    }
    return absolutePath;
}
```

Reject absolute input paths, symlink escapes after `realpath`, missing files, non-regular files, and unsupported media types.

- [ ] **Step 4: Implement canonical JSON and raw-file hashing**

```ts
export function hashCanonicalEvidence(value: unknown): string {
    return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export async function hashEvidenceFile(path: string): Promise<string> {
    const bytes = await readFile(path);
    return createHash('sha256').update(bytes).digest('hex');
}
```

Use canonical hashing for parsed JSON evidence and byte hashing for opaque artifacts such as traces/screenshots.

- [ ] **Step 5: Write report rendering tests**

```ts
it('writes one JSON document with no progress text', () => {
    expect(renderGateJsonReport(validGateReport)).toBe(`${JSON.stringify(validGateReport)}\n`);
});

it('maps failed verification to existing assets exit code 2', () => {
    expect(gateReportExitCode(failedVerificationReport)).toBe(2);
});
```

- [ ] **Step 6: Implement safe human/JSON rendering**

Human output must contain status, story, target, preview, release, checksum, commit, check statuses, evidence count, and diagnostic codes. It must not print credentials, source paths, signed URLs, private bucket names, prompts, or raw environment values.

- [ ] **Step 7: Run focused and package tests**

```bash
bun --filter @aquila/infra-cloudflare test \
  src/release-gate/__tests__/evidence.test.ts \
  src/release-gate/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare test
```

- [ ] **Step 8: Commit evidence utilities**

```bash
git add packages/infra-cloudflare/src/release-gate
git commit -m "feat(infra): add release gate evidence handling"
```

---
