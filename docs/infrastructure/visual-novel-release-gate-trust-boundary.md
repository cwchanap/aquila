# Visual-novel release-gate trust boundary

`visual-novel-release-gate.yml` deliberately splits the user-selected
candidate from the credentials that can publish a preview or query R2.

1. `candidate-build` is secretless and has only `contents: read`. It may check
   out, install, test, and build the candidate, but it may not link a Vercel
   project or contact R2.
2. `seal-candidate` is guarded by both the `main` ref and the trusted
   workflow reference before it checks out the immutable workflow SHA. It has
   no OIDC or attestation permission. It reads the candidate output as hostile
   USTAR bytes, compares the candidate lockfile with a trusted Git fetch,
   validates Tier 1, and emits a canonical, immutable (`overwrite: false`)
   build contract plus a bounded output archive.
3. `prepare-live` and `finalize-live` have the same `main`/workflow-reference
   guard and run only trusted source. `prepare-live` attests the sealed subject
   after trusted ingestion, then both jobs link the preview Vercel project
   first, replace its output with the sealed archive, rehash the exact manifest
   immediately before and after deployment, and accept Vercel stdout only
   after strict one-line URL validation.
4. `finalize-live` never executes candidate code. It reuses Tier 1 only when
   the exact sealed prepare provenance, artifact digest, candidate/lockfile
   identity, command set, browser matrix, status, and Bun/Node/Playwright
   versions match. A mismatch records `fresh-upstream-required` evidence and
   stops; a new secretless prepare run is required.

## Environment protection policy

Both GitHub environments must restrict selected branches to `main`:

- `visual-novel-release-preview` protects preview publication and holds only
  `RELEASE_GATE_VERCEL_PREVIEW_TOKEN`,
  `RELEASE_GATE_R2_PUBLISHER_ACCESS_KEY_ID`, and
  `RELEASE_GATE_R2_PUBLISHER_SECRET_ACCESS_KEY`.
- `visual-novel-release-approval` has the same scoped preview/R2 credentials
  and requires the designated release approvers before `finalize-live` starts.

Do not create repository- or organization-level secrets with these
`RELEASE_GATE_*` names. The workflow resolves those exact names only in a job
that declares one of the protected environments; the environment is the
credential authority.

The workflow repeats the branch and workflow-reference check at job entry as
defence in depth. Do not rely solely on the environment branch policy for
OIDC or attestation eligibility.

## Vercel preview project policy

`RELEASE_GATE_VERCEL_PREVIEW_PROJECT_ID` must identify a dedicated preview
project, not the production project. Its token must be scoped to that project.
The project/runtime may contain only the public release-gate values needed for
preview rendering (`PUBLIC_ASSET_*`, Vercel's normal public metadata, and no
database, R2, auth-client-secret, or deployment credential). Set
`RELEASE_GATE_VERCEL_PREVIEW_CREDENTIAL_FREE=true` as an environment variable
only after a maintainer has verified that configuration in Vercel.

The local/static checks cannot prove Vercel's remote project settings. Before
authorizing a real release, run the protected workflow and retain the Actions
artifact attestation, the sealed-contract digest, Vercel deployment
attestation, post-deploy hash, remote browser evidence, stage timings, and
production-pointer proof (or its explicit `unproven` failure marker). No local
command or this document substitutes for that live verification.
