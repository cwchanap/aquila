# Visual-novel release-gate trust boundary

`visual-novel-release-gate.yml` deliberately splits the user-selected
candidate from the credentials that can publish a preview or query R2.

1. `candidate-build` is secretless and has only `contents: read`. It may check
   out, install, test, and build the candidate, but it may not link a Vercel
   project or contact R2.
2. `seal-candidate` checks out the immutable workflow SHA from `main`. It
   reads the candidate output as hostile USTAR bytes, compares the candidate
   lockfile with a trusted Git fetch, validates Tier 1, and emits a canonical
   build contract plus a bounded output archive. The sealed artifact is
   immutable (`overwrite: false`) and receives a GitHub artifact attestation.
3. `prepare-live` and `finalize-live` run only trusted `main` source. They
   link the preview Vercel project first, replace its output with the sealed
   archive, rehash the exact manifest immediately before and after deployment,
   and accept Vercel stdout only after strict one-line URL validation.

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
attestation, post-deploy hash, and remote browser evidence. No local command
or this document substitutes for that live verification.
