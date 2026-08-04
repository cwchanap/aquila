# HPA-233 consolidated final fix report

Base: `a4dbe4ac5f7b3c54f9f3fe2a7fe4f74fc1084f7c`

## Scope completed

1. Corrected final public-verification binding. Immutable candidate evidence is
   now required to target production, while active evidence is required to
   target the explicit preview namespace. The live workflow helper owns this
   target construction, and an integration regression feeds its exact output
   form into the gate runner. Both target swaps fail closed.
2. Added canonical `webBaseUrl` deployment identity to every browser project
   record and the aggregate `BrowserEvidenceV1` record. Reporter success and
   fallback paths retain it. The workflow binds it to the exact Vercel-returned
   deployment attestation, the final gate binds it to retained web identity,
   and production smoke binds it to the configured production origin. Browser
   evidence from another preview or production deployment is rejected even
   when story, release, checksum, and asset request paths match.
3. Removed ordinary CLI JSON reopens. All eleven `verify-preview` artifacts
   now produce semantics and canonical digest references from one validated
   no-follow descriptor snapshot. Standalone activation-report and production
   browser inputs use the equivalent descriptor-safe JSON snapshot reader. A
   CLI-boundary regression swaps a validated report file to a real symlink
   immediately before descriptor open and proves rejection before service
   dispatch.
4. Pinned `actions/attest` to reviewed commit
   `508db95dd578ae2727ebd6217d5ba78e4fbda05d` (`v4.2.1`) without changing
   permissions, subjects, or workflow topology.

## RED/GREEN evidence

- Public target/browser origin focused RED: 16 failures, including the
  previously impossible trusted candidate path and unrecognized/missing
  deployment identity. GREEN: 60/60 schema, gate-runner, and production-smoke
  tests.
- Workflow-helper integration RED: missing helper/output contract. GREEN:
  workflow helper emits production candidate plus preview active forms and the
  gate accepts them; negative swaps remain rejected.
- E2E reporter/origin RED: 3 failures for missing environment/project origin.
  GREEN: 12/12 focused reporter/environment/evidence tests.
- CLI snapshot RED: 5 failures for the old split read/hash API and missing
  descriptor-boundary protection. GREEN: 42/42 CLI tests, including the real
  file-to-symlink swap.
- Action pin RED: workflow contract observed `actions/attest@v4`. GREEN:
  workflow contract observes the reviewed full SHA.
- Exact production-origin RED: a path below the configured origin was
  accepted. GREEN: production smoke rejects it before public verification.

## Verification

- `bun --filter @aquila/infra-cloudflare test`: 540/540 passed.
- Focused E2E support/reporter Bun tests: 24/24 passed.
- `bun run test`: passed for every configured Turbo test task.
- `bun run lint`: passed.
- `bun run build`: passed.
- `actionlint .github/workflows/visual-novel-release-live.yml .github/workflows/visual-novel-release-gate.yml`: passed.
- Prettier check over all changed TypeScript, Markdown, and workflow files:
  passed.
- `git diff --check`: passed.

## Intentionally pending external evidence

- The real local PostgreSQL 16 migration plus Tier 1 Playwright evidence run
  remains pending; no Tier 1 success is claimed here.
- Protected GitHub Environment approval, Vercel deployment, R2 verification,
  remote browser runs, and production smoke remain live external gates; none
  were invoked or claimed by this fix wave.
- Deferred Task 1/2/6/8 minor findings remain triaged as non-blocking and were
  not broadened into this fix.
