# Visual-novel release-gate trust boundary

The release gate uses two workflows because GitHub lets an operator choose a
branch or tag for a manual dispatch. A `main` check inside that selected
workflow is not an authority boundary by itself.

1. [`visual-novel-release-gate.yml`](../../.github/workflows/visual-novel-release-gate.yml)
   is **Visual Novel Release Candidate Entry**. It preserves the 14 dispatch
   inputs and may check out, install, test, and build the selected candidate.
   It has only `contents: read`, no environment, no Vercel/R2 credentials, and
   no OIDC, artifact-attestation, or artifact-metadata permission.
2. [`visual-novel-release-live.yml`](../../.github/workflows/visual-novel-release-live.yml)
   is **Visual Novel Release Live**. It is present on the default branch and
   is triggered only by a completed Candidate Entry workflow whose workflow
   run branch is `main`. GitHub documents this default-branch `workflow_run`
   behavior and its upstream-artifact access in its
   [workflow event reference](https://docs.github.com/en/enterprise-cloud%40latest/actions/reference/workflows-and-actions/events-that-trigger-workflows).
   This is the first workflow that can request a protected environment.

## Trusted handoff

Candidate Entry uploads a short-lived raw artifact named from its run ID and
attempt. Its only trusted-useful contents are a canonical request envelope and
phase-specific bytes:

- `prepare`: a Tier 1 result, scenario template, candidate lockfile, and raw
  Vercel output archive;
- `finalize`: the approved review record selected by the entry request.

`entry-provenance` in the live workflow downloads that exact artifact by the
upstream `workflow_run.id`. Before passing any values to another job, it checks
the Actions API run name, event, conclusion, branch, workflow path,
repository, SHA, run attempt, artifact name, artifact run ID, expiry, and
digest. It reparses the request and treats every downloaded file as hostile.
It never checks out or executes candidate source.

`seal-candidate` is secretless and runs only for a validated `prepare`
request. It compares the raw lockfile with trusted Git data, validates Tier 1,
and emits a canonical sealed contract plus bounded USTAR output. `prepare-live`
uses that sealed artifact for all Vercel/R2/browser work. `finalize-live`
requires a successful **trusted live prepare run ID** (`prepare_run_id`), not
the unprivileged entry run ID, and downloads the exact sealed artifact from
that run. It reuses Tier 1 only when the exact artifact, identity, lockfile,
command set, browser matrix, status, and Bun/Node/Playwright versions match.

For finalization, the candidate-entry artifact is downloaded again by its exact
run ID. The live workflow rechecks the request identity before materializing
the review record into protected evidence. A repository path alone is never
used as the approval boundary.

## Operator flow

1. Dispatch **Visual Novel Release Candidate Entry** from `main` with
   `phase=prepare`. Wait for its linked **Visual Novel Release Live** run to
   finish. The protected prepare run ID is the value for a later
   `prepare_run_id`.
2. Review the protected prepare evidence and the preview. Do not treat a
   successful Candidate Entry run as a deployment authorization.
3. Dispatch Candidate Entry from `main` with `phase=finalize`, the successful
   trusted prepare run ID, and the approved review path. The live workflow
   validates the entry artifact, then waits at
   `visual-novel-release-approval` before any protected work.

Neither workflow activates or rolls back production. Production pointer
mutation remains a separately authorized operation.

## Environment protection policy

Both GitHub environments must restrict selected branches to `main`:

- `visual-novel-release-preview` protects preview publication and holds only
  `RELEASE_GATE_VERCEL_PREVIEW_TOKEN`,
  `RELEASE_GATE_R2_PUBLISHER_ACCESS_KEY_ID`, and
  `RELEASE_GATE_R2_PUBLISHER_SECRET_ACCESS_KEY`.
- `visual-novel-release-approval` has the same scoped preview/R2 credentials
  and requires designated release approvers before `finalize-live` starts.

Do not create repository- or organization-level secrets with these
`RELEASE_GATE_*` names. The live workflow resolves them only in a job that
declares a protected environment; the environment is the credential authority.

## Vercel preview project policy and live evidence

`RELEASE_GATE_VERCEL_PREVIEW_PROJECT_ID` must identify a dedicated preview
project, not the production project. Its token must be scoped to that project.
The project/runtime may contain only public release-gate values needed for
preview rendering (`PUBLIC_ASSET_*`, normal public Vercel metadata, and no
database, R2, auth-client-secret, or deployment credential). Set
`RELEASE_GATE_VERCEL_PREVIEW_CREDENTIAL_FREE=true` only after a maintainer has
verified that configuration in Vercel.

Local/static checks cannot prove the remote environment rules, Vercel project
settings, R2 credentials, or approval behavior. Before authorizing a real
release, run the protected workflow and retain its Actions artifacts, sealed
contract digest, deployment attestation, post-deploy hashes, browser evidence,
and production-pointer proof (or its explicit `unproven` marker). No local
command or this document substitutes for that live verification.
