# HPA-233 Implementation Plan — Task 5: Integrate `assets release-gate` Without Breaking Publisher Commands

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 5: Integrate `assets release-gate` Without Breaking Publisher Commands

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/cli.ts`
- Create: `packages/infra-cloudflare/src/release-gate/index.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/cli.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/cli.ts`
- Modify: `packages/infra-cloudflare/package.json` — export only `./release-gate` for typed E2E schema reuse while retaining `assets` as the executable entry point.

**Interfaces:**
- Consumes: Tasks 1–4 services and existing publisher CLI streams/exit taxonomy.
- Produces: `runReleaseGateCli(argv, dependencies): Promise<number>` and routing from `runAssetsCli` when `argv[0] === 'release-gate'`.

- [ ] **Step 1: Write CLI routing tests**

```ts
it('routes release-gate without passing the token to publisher parsing', async () => {
    const exit = await runAssetsCli(
        ['release-gate', 'verify-preview', '--help'],
        fixtureAssetsDependencies()
    );
    expect(exit).toBe(0);
    expect(stdout.text()).toContain('assets release-gate verify-preview');
});

it('preserves existing publisher help and plan behavior', async () => {
    expect(await runAssetsCli(['--help'], fixtureAssetsDependencies())).toBe(0);
    expect(await runAssetsCli(['plan', ...VALID_PLAN_ARGS], fixtureAssetsDependencies())).toBe(0);
});
```

- [ ] **Step 2: Run tests and confirm release-gate routing fails**

```bash
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/cli.test.ts
```

- [ ] **Step 3: Add early subcommand routing in `runAssetsCli`**

```ts
if (argv[0] === 'release-gate') {
    return runReleaseGateCli(argv.slice(1), {
        environment: dependencies.environment,
        stdout: dependencies.stdout,
        stderr: dependencies.stderr,
        repositoryRoot: dependencies.repositoryRoot,
    });
}
```

Place this after top-level help handling and before `parseCommandName()`.

- [ ] **Step 4: Parse exact subcommands and required flags**

Support:

```text
verify-preview
assert-activation-ready
smoke-production
```

`verify-preview` requires story, preview ID, release, expected checksum, asset base URL, web base URL, candidate report, browser evidence, web identity evidence, manual review, workflow approval, commit SHA, evidence directory, and JSON/human mode. Compatibility/non-authorizing internal helpers must use separate service APIs rather than weakening this command.

- [ ] **Step 5: Reuse existing exit taxonomy**

Map schema/identity/verification failures to `2`, missing environment/storage to `3`, delegated publisher conflict to `4`, guarded target failures to `5`, and configuration to `1`. Do not introduce a second exit-code enum.

- [ ] **Step 6: Export the strict release-gate schema surface**

Add:

```json
{
  "exports": {
    "./release-gate": "./src/release-gate/index.ts"
  }
}
```

`index.ts` exports only strict parsers, wire types, and the gate service functions needed by E2E and the CLI. Do not export R2 stores, activation functions, or publisher internals.

- [ ] **Step 7: Verify stdout/stderr separation**

Tests must assert JSON stdout contains one parseable object and stderr contains progress only. Human mode writes the summary to stderr, matching publisher conventions.

- [ ] **Step 8: Run publisher regression tests**

```bash
bun --filter @aquila/infra-cloudflare test \
  src/release-gate/__tests__/cli.test.ts \
  src/publisher/__tests__/cli.test.ts
bun --filter @aquila/infra-cloudflare test
```

- [ ] **Step 9: Commit CLI integration**

```bash
git add packages/infra-cloudflare
git commit -m "feat(infra): expose release gate through assets cli"
```

---
