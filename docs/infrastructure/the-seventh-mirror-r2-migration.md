# The Seventh Mirror R2 migration

Story: `the_seventh_mirror`
Source bucket: `aquila-vn-source` (private)
Delivery bucket: `aquila-vn-delivery`
R2 account id: `91ee89a03a31b5354a25c49228e4ab85`
R2 S3 endpoint: `https://91ee89a03a31b5354a25c49228e4ab85.r2.cloudflarestorage.com`

The base archive is the HPA-231 v1 migration snapshot. It is not a complete-art
claim: generated keys without source art remain explicit production-plan
omissions. Future art requires a new archive prefix/overlay plus a deliberate
release-plan amendment.

HPA-231 removes production binaries from current repository HEAD and canonical
runtime delivery paths. It does not rewrite Git history; historical blobs remain
reachable in older commits.

## V1 source classification

- Included: 38 generated asset identities with source art.
- Omitted: 318 generated asset identities whose authoring art was not produced
  for HPA-231 v1.
- Total: 356 generated asset identities.
- Existing but omitted: 0.
- Filesystem junk: none.

Two source images exist on disk but are absent from the generated compiler
catalog:

- `the_seventh_mirror/characters/asakura_yuma/sad.png`
- `the_seventh_mirror/characters/asakura_yuma/scared.png`

These are compiler drift / unused authoring art. They are part of the private v1
source snapshot, but no release-plan identities were invented for them and they
are not published by HPA-231.

## Private source archive

Prepared archive ID: `2026-08-07-afba4aceb9ea`

Intended immutable prefix:
`s3://aquila-vn-source/authoring/the_seventh_mirror/2026-08-07-afba4aceb9ea/`

The local snapshot contains 40 source images, the generated image catalog, the
reviewed production release plan, and a `SHA256SUMS` manifest covering all 42
payload files. Local checksum verification passed for every entry. The archive
upload placed all 43 objects (42 payload files plus `SHA256SUMS`) at the intended
private prefix with no transfer errors.

A fresh restore downloaded all 43 objects with no transfer errors, and
`shasum -a 256 -c SHA256SUMS` reported `OK` for every payload. Planning the
production release from the restored `media/` tree reproduced the original
publication identity exactly:

- Release ID:
  `sha256-ec3ba7cf9b94f21396c1a2d1fe632d46f6a938056d6186dd0675fa7cb842607e`
- Manifest SHA-256:
  `cc9f403e3875b5bb17e3b09fd8f13dca75e2f2170898c9fa1e2cce9b1f3c2bb7`

## Primary candidate qualification

Qualified on 2026-08-08 without activating the production pointer:

- Release ID:
  `sha256-ec3ba7cf9b94f21396c1a2d1fe632d46f6a938056d6186dd0675fa7cb842607e`
- Manifest SHA-256:
  `cc9f403e3875b5bb17e3b09fd8f13dca75e2f2170898c9fa1e2cce9b1f3c2bb7`
- Preview pointer: `hpa-231-gate`
- Preview deployment:
  `https://aquila-36ozmdfmn-cwchanaps-projects.vercel.app`
- HPA-233 release gate:
  `https://github.com/cwchanap/aquila/actions/runs/31293468525`
  (job `93194665245`)

The HPA-233 workflow passed deep R2 verification, preview-pointer mirroring and
activation, public-CDN verification, and its deployed-reader Playwright checks
for both desktop and mobile Chromium. The successful workflow also exercised a
choice path with `train_adventure`; The Seventh Mirror itself is linear, so no
story-local choice was available for the manual review.

Manual v1 review results:

- PASS: an included background transition rendered both reviewed room images.
- PASS: an included portrait transition changed from Yuma to Mio while retaining
  the active background.
- PASS: a later omitted position showed the expected unavailable-visuals
  fallback, and Continue advanced from page 1 to page 2 without blocking.
- N/A: no choice exists in the linear The Seventh Mirror flow; the automated
  cross-story choice-path check passed as noted above.
- PASS: the included background, portrait, dialogue, and progression controls
  were readable and usable at desktop and 393x851 mobile viewports.
- PASS: visual to text to visual to text mode changes preserved the exact active
  line at page 11 of 29.
- EXPECTED: later positions without included art use fallback presentation and
  are not migration failures.

The narrow mobile capture also exposed overlapping reader chrome near the top
edge. It did not cover the migrated artwork, dialogue, or Continue control and
is recorded as a non-blocking reader-layout observation outside the R2 payload
qualification.

The protected preview was reviewed with a short-lived Vercel automation bypass.
That temporary bypass was revoked immediately after the manual review; the
credential was not retained in the repository or this runbook.

## Production activation

Activated on 2026-08-08 after the primary candidate qualification passed.

The Vercel Production environment was confirmed to contain exactly:

```text
PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/
PUBLIC_ASSET_ENVIRONMENT=production
```

`PUBLIC_ASSET_PREVIEW_ID` was absent from Production. The existing production
source deployment was rebuilt once so the build-time asset configuration took
effect without deploying the HPA-231 feature branch:

- Deployment ID: `dpl_AA6yRHaZPHRoDr21zGz2W1FD8EVc`
- Deployment URL:
  `https://aquila-5kcw29q09-cwchanaps-projects.vercel.app`
- Production URL: `https://aquila.cwchanap.dev`
- Final deployment status: Ready

Before pointer activation, the rebuilt production reader requested:

```text
https://assets.aquila.cwchanap.dev/vn/stories/the_seventh_mirror/current.json
```

The request returned the expected first-activation HTTP 404. No request used
the repository-local preview path
`/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json`.

Production activation then wrote exactly one pointer and changed no payload
objects:

- Active release ID:
  `sha256-ec3ba7cf9b94f21396c1a2d1fe632d46f6a938056d6186dd0675fa7cb842607e`
- Active manifest SHA-256:
  `cc9f403e3875b5bb17e3b09fd8f13dca75e2f2170898c9fa1e2cce9b1f3c2bb7`
- Pointer key: `vn/stories/the_seventh_mirror/current.json`
- Pointer writes: 1
- Objects or manifests created/reused: 0

The fresh public-chain verification passed every required pointer, manifest,
immutable-object checksum and byte-length, content type, cache, CORS, source-key
absence, and forbidden-JSON-key check. The full deployed production release
gate then passed in both desktop and mobile Chromium (`2 passed`), serving the
pinned release end to end through the production reader.

## Controlled rollback proof

Completed on 2026-08-08 with the primary release restored as the final
production state.

The initial deep release-history read found one valid, deeply verified release,
the active primary. A synthetic rollback peer was then built from the same
reviewed production plan and source snapshot by applying a deterministic 1%
brightness increase only to the included
`background:chapter_1/ch1_act2_s1` source. Manual inspection passed, the source
dimensions remained `1672x941`, and the source SHA-256 changed from
`85ac0b7d416e2737e4a0f0764da94d13ee31bbb7e4526db6ebeacbbe68162d59` to
`7dd94d6c201ffeef4e414d0b08c79d0b91cdd575a1c6d968cef89518899055d9`.

Synthetic immutable release:

- Release ID:
  `sha256-9f59ac8d080d5935749bd4a265f7e25ef3d001f6339e755a0df4bcaaa6901cb5`
- Manifest SHA-256:
  `8209522976ed61595751ded6b36aeb310db889acdab25c65e0e030e3286771c6`
- Included/omitted: 38/318
- Objects created/reused: 2/45
- Manifests created: 1
- Pointer writes during publish: 0

The synthetic publish retained the two reviewed portrait aspect-ratio warnings
for `kusakube_satoru/base` and `saeki_tatsuya/determined`; it produced no
errors. Deep verification passed, the synthetic release ID differed from the
primary, and no redundant HPA-233 preview gate was run.

The controlled production pointer sequence then passed exactly as planned:

1. Normal activation changed primary to synthetic; the public chain verified
   with zero failed checks.
2. Rollback changed synthetic to primary; the public chain verified with zero
   failed checks.
3. Normal activation changed primary back to synthetic, proving activation-back
   semantics without `--reactivate`; the public chain verified with zero failed
   checks.
4. Final normal activation changed synthetic to primary; the public chain
   verified with zero failed checks.

The fail-safe restoration path was not needed. A separate fresh CDN read after
the sequence confirmed the final live pointer identifies the primary release
and manifest:

- Final release ID:
  `sha256-ec3ba7cf9b94f21396c1a2d1fe632d46f6a938056d6186dd0675fa7cb842607e`
- Final manifest SHA-256:
  `cc9f403e3875b5bb17e3b09fd8f13dca75e2f2170898c9fa1e2cce9b1f3c2bb7`

## Final verification and repository cleanup

Completed on 2026-08-08. Current repository HEAD contains exactly four tracked
The Seventh Mirror visual fixtures:

| Fixture                                 | Dimensions |   Bytes |
| --------------------------------------- | ---------: | ------: |
| `backgrounds/chapter_1/ch1_act2_s0.png` |    959x540 | 641,782 |
| `backgrounds/chapter_1/ch1_act2_s1.png` |    959x540 | 619,415 |
| `characters/asakura_mio/base.png`       |    450x600 | 313,844 |
| `characters/asakura_yuma/base.png`      |    450x600 | 287,237 |

The four fixtures total 1,862,278 bytes. The other 36 production source images
were removed from Git tracking and from the canonical runtime media tree. An
ignored local working copy remains under
`.tmp/hpa-231-local-production-assets/` for the operator; it is not part of the
repository or runtime delivery path. The final private-archive restore remains
locally under `.tmp/hpa-231-final-restore/` for the same reason.

CI now runs the strict visual-fixture verifier after `compile:check`. It enforces
the exact four-path allowlist, image dimensions, individual and total byte
budgets, and the absence of stale production-image references from tracked
story documentation. The final verification set passed:

- Story compilation drift check.
- Stories package tests: 201 passed.
- Infrastructure tests: 407 passed.
- Web package tests: 1,609 passed.
- Strict fixture verifier.
- Monorepo lint: 4 tasks passed.
- Monorepo production build: 4 tasks passed.
- Fresh production public-chain verification, including immutable object
  checksums and lengths, cache headers, CORS, and source-key exclusion.
- Production release gate in desktop and mobile Chromium: 2 passed.

The final production pointer still identifies the qualified primary release and
manifest documented above. Cleanup applies to current HEAD and canonical paths
only. Historical large blobs remain in Git history; HPA-231 performed no history
rewrite.
