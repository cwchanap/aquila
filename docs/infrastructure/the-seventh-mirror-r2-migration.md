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
