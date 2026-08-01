# HPA-230 Third-Pass Normative Clarifications

**Date:** 2026-08-01  
**Status:** Normative addendum to the draft HPA-230 design  
**Applies to:** PR #43 and `2026-08-01-hpa-230-immutable-visual-asset-publisher-design.md`

This addendum resolves the third design-review pass. Where it conflicts with the
main design document, this addendum wins until the text is consolidated before
implementation planning. It does not add a second runtime wire format or alter
HPA-227 contracts.

## A1 — Production candidates are created in production first, then mirrored to preview

A preview release is not promoted into production. Preview plans may be
incomplete, and the runtime manifest does not carry enough evidence to prove
that a preview release came from a complete production plan. Allowing an
arbitrary preview manifest to be copied into the production namespace would
bypass `assertActivationAllowed()` and production coverage enforcement.

The production release workflow is therefore:

1. Run `publish --environment production --no-activate` with a
   `channel: "production"` release plan.
2. The publisher validates complete production coverage, encodes once, uploads
   the shared content-addressed objects, and creates the immutable production
   release manifest. It does not write the production pointer.
3. Run `mirror-preview --release <releaseId> --preview-id <previewId>`.
4. `mirror-preview` deep-verifies the production release, copies the exact
   immutable manifest bytes and metadata to the corresponding preview release
   path, and deep-verifies the preview copy. Objects are not copied because
   preview and production share `vn/objects/`.
5. Run `activate --environment preview --release <releaseId>` to expose the
   candidate to preview reader and browser verification.
6. HPA-233 records the release ID and exact manifest checksum and completes the
   preview gate.
7. Run `activate --environment production --release <releaseId>` to update only
   the production `current.json` pointer.

The immutable manifest bytes are target-independent. Only their object-store
paths differ:

```text
production: vn/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
preview:    vn/previews/<previewId>/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
```

`mirror-preview` supports only production-to-preview copying. There is no
preview-to-production copy command. A production candidate can be created only
through a production-target publication path that invokes
`assertActivationAllowed(plan, { kind: 'production' })` and full production
coverage validation.

`mirror-preview` accepts an optional expected manifest checksum supplied by the
release gate. A mismatch fails before any preview manifest write.

### Revised command

```text
mirror-preview
  --story <storyId>
  --release <releaseId>
  --preview-id <previewId>
  [--expect-manifest-sha256 <sha256>]
  [--destination local|r2]
  [--destination-root <path>]
  [--json]
```

The command:

- loads no authoring catalog, release plan, source root, or encoder;
- deep-verifies the stored production manifest and every referenced object;
- verifies the V1 background/AVIF invariant;
- creates the preview manifest with immutable create-only semantics;
- reuses an existing byte-identical preview manifest;
- rejects any byte or metadata conflict;
- never writes either production or preview `current.json`.

HPA-233 must gate the preview mirror of the retained production candidate, not a
separately rebuilt preview release.

## A2 — `publishedAt` is strictly monotonic

Every publisher-generated pointer must have a `publishedAt` strictly later than
the pointer snapshot used for its conditional write. This is required by the
reader's stale-pointer protection: a pointer whose timestamp is not newer than a
previously validated pointer can be ignored even when its release ID changed.

The timestamp is generated after the final pre-write pointer read, not during
planning.

Normative algorithm:

```ts
const nowMs = clock.now();
const previousMs = snapshot.exists
  ? Date.parse(snapshot.pointer.publishedAt)
  : Number.NEGATIVE_INFINITY;

if (snapshot.exists && previousMs > nowMs + MAX_PUBLISHER_FUTURE_SKEW_MS) {
  throw new PublisherError('clock-skew', ...);
}

const publishedAtMs = snapshot.exists
  ? Math.max(nowMs, previousMs + 1)
  : nowMs;

if (snapshot.exists && publishedAtMs <= previousMs) {
  throw new PublisherError('non-monotonic-pointer-time', ...);
}
```

`MAX_PUBLISHER_FUTURE_SKEW_MS` is an explicit publisher policy constant. V1 uses
five minutes. A small negative local-clock skew is repaired by choosing the
monotonic successor; an implausibly future pointer fails instead of propagating
an arbitrarily future timestamp.

Timestamp failure maps to exit code `5`, the activation/rollback target or
pointer validation class. The JSON report identifies the previous timestamp,
local clock value, and safe error code without exposing unrelated pointer bytes.

Rollback and reactivation always publish a new monotonic timestamp. Copying an
old `current.json` object verbatim is not a supported rollback procedure.

## A3 — Publish uses a fresh short-lived CAS snapshot

The pointer snapshot collected during `plan` is advisory and appears in the
report. It is never used directly for the final `If-Match` after a long encode or
upload phase.

After all immutable candidate verification completes, `publish`:

1. re-reads `current.json` immediately before activation;
2. compares the fresh snapshot with the plan-time snapshot;
3. reports a concurrency conflict if the pointer changed during planning or
   publication;
4. generates the strictly monotonic `publishedAt` from the fresh snapshot;
5. validates the pointer/manifest pair;
6. performs CAS using the fresh opaque ETag.

When `--override-concurrent-pointer` is supplied, the command displays the newly
observed active release, revalidates the candidate, takes another fresh snapshot,
and performs one refreshed CAS. The flag remains exceptional rather than a
routine workaround for multi-minute encoding.

A pointer change after the final read still fails the conditional write. No
command retries that failure unconditionally.

`activate` and `rollback` already use an immediate pre-write snapshot and follow
the same monotonic timestamp and refreshed-CAS rules.

## A4 — Use typed AWS SDK conditional fields

The pinned AWS SDK S3 `PutObjectCommandInput` exposes `IfMatch` and
`IfNoneMatch`. HPA-230 uses those typed command-input fields directly:

```ts
new PutObjectCommand({
  ...request,
  IfNoneMatch: '*',
});

new PutObjectCommand({
  ...request,
  IfMatch: snapshot.etag,
});
```

The R2 adapter does not inject these headers through custom middleware. The
middleware rationale and the corresponding conditional-header integration risk
in the main design are superseded.

Adapter tests inspect `PutObjectCommandInput.IfMatch` and
`PutObjectCommandInput.IfNoneMatch` and still verify R2's 412 mapping. Custom
middleware is introduced only if a separately named unsupported header is later
required.

## A5 — The authoring loader owns NFC normalization

Generated authoring logical keys are normalized to Unicode NFC during the first
reduction boundary, before `AuthoringAssetCatalog` construction, qualification,
duplicate detection, section derivation, or plan comparison.

Normative order:

1. read the generated key;
2. normalize with `key.normalize('NFC')`;
3. validate the normalized logical key;
4. construct the type-qualified identity;
5. detect duplicates after normalization.

If two generated keys collapse to the same type-qualified identity after NFC
normalization, planning fails with a duplicate-identity diagnostic.

The release-plan parser continues to require already-NFC plan keys. It does not
silently rewrite checked-in plan content. Authoring/plan identity comparison is
therefore between normalized generated identities and contract-valid plan
identities.

Source paths are not Unicode-normalized by this rule; they must continue to
match the compiler authoring path byte-for-byte as described below.

## A6 — HPA-230 intentionally does not author a production release plan

HPA-230 provides the publisher and fixture plans. It does not create the first
production plan for The Seventh Mirror. HPA-231 owns the generated-key/source
inventory, classification decisions, checked-in production plan, and migration.

Consequences:

- HPA-230 can be complete and fully tested with small fixtures while no
  `packages/stories/release-plans/the_seventh_mirror.json` exists.
- Production publication of The Seventh Mirror remains intentionally impossible
  until HPA-231 classifies every authoring key.
- This is not a publisher defect; it is the planned ticket boundary.

HPA-230 does not add an auto-classifying plan generator. Automatically marking
hundreds of entries included or omitted would turn a convenience command into a
release-policy decision and could produce a schema-valid but unsafe plan.
HPA-231 may add or use a read-only inventory/scaffolding script as part of the
migration, but every final disposition and omission reason remains reviewed
HPA-231 content.

The HPA-230 runbook must state this prerequisite explicitly so operators do not
expect a clean checkout to publish a production story immediately after HPA-230
merges.

## A7 — Release-plan source paths are exact maintenance contracts

For an included asset, `releasePlanEntry.sourcePath` must equal the generated
authoring `sourcePath` byte-for-byte. Filesystem equivalence, case-insensitive
matching, separator conversion, symlink resolution, and Unicode equivalence do
not relax this contract.

A compiler change that moves or renames an authoring source path invalidates the
checked-in plan even when the file bytes are unchanged. The compiler output and
release plan must be updated together.

The publisher reports this as `coverage/source-path-mismatch`, distinct from a
missing file. HPA-231 should place release-plan consistency next to its generated
asset and `compile:check` review workflow. HPA-230 tests cover path mismatch but
does not change `compile:check` globally before a production plan exists.

## A8 — Aspect warnings use tolerance; runtime dimensions are a bounding box

The HPA-227 preferred runtime dimensions are maximum bounding boxes, not exact
output dimensions. `fit: inside` preserves source aspect ratio, so an input can
produce `1599×900` within a `1600×900` background box. The manifest records the
actual encoded width and height, and tests must not require every background to
be exactly `1600×900`.

Aspect-ratio deviation uses relative error:

```ts
const relativeAspectError =
  Math.abs(actualAspect / preferredAspect - 1);
```

V1 emits an aspect warning only when `relativeAspectError > 0.005` (0.5%). This
avoids warning floods for near-16:9 sources such as `1672×941` while still
surfacing material crop/pad candidates for HPA-231 review.

Minimum source dimension warnings remain exact after orientation normalization.
Repeated warnings are aggregated by diagnostic code and asset type, with totals
and a bounded sample of logical identities, so large stories do not make the
warning channel unusable.

Tests assert:

- output dimensions are positive and inside the configured maximum box;
- output aspect ratio matches the normalized source within encoder rounding;
- a near-ratio source below the 0.5% threshold does not warn;
- a material deviation does warn;
- reports aggregate repeated warnings deterministically.

## A9 — Production confirmation is for pointer mutation

`--confirm-production <storyId>` protects changes to the production active
pointer. It is required for:

- production `publish` when activation is enabled;
- production `activate`;
- production `rollback`;
- production `--reactivate` paths.

It is not required for:

- `publish --environment production --no-activate`;
- `mirror-preview`;
- `verify` or `releases`.

The non-activating production publication still requires an explicit
`--environment production` and a production-channel release plan. This keeps the
confirmation signal focused on user-visible activation rather than every
immutable candidate write.

## A10 — ETags are opaque; monotonic pointer bytes prevent publisher ABA

R2 ETags are treated as opaque strings and are round-tripped exactly as returned.
The implementation does not parse them, strip or add quotes, infer hashes, or
compare them with local SHA-256 ETags.

Under publisher-controlled writes, an A→B→A release sequence is not an ETag ABA:
every pointer write has a strictly increasing `publishedAt`, so the exact pointer
bytes do not return to the original A bytes. The local adapter's content-derived
ETag therefore changes, and R2's opaque ETag is expected to represent the new
object version returned by the write.

Manual restoration of historical `current.json` bytes is unsupported. Operators
must use `rollback`, which creates new pointer bytes with a monotonic timestamp.
Reader stale-pointer protection remains the final defense against an externally
restored older pointer.

## A11 — Runtime-manifest draft typing is explicit

Release-ID construction validates the placeholder draft before passing it to the
typed canonical helper:

1. build a draft object with sorted assets and a syntactically valid placeholder
   release ID (`sha256-` plus 64 zeroes);
2. call `parseRuntimeAssetManifest(draftObject)` to obtain a validated
   `RuntimeAssetManifestV1`;
3. call `canonicalReleaseContent(validatedDraft)`;
4. hash and brand the canonical bytes as `release-content`;
5. derive the final release ID;
6. replace the placeholder;
7. parse the final manifest again;
8. call `assertReleaseIdMatchesContentSha256()` with the final manifest and
   branded canonical digest.

No unchecked cast is used to satisfy `canonicalReleaseContent()`.

## A12 — Exact release-listing key grammar

The release prefix already ends in `releases/`. Accepted full keys are expressed
without an extra separator:

```text
<releasePrefix><releaseId>/runtime-manifest.json
```

For example:

```text
vn/stories/example_story/releases/sha256-<digest>/runtime-manifest.json
```

The adapter paginates the exact prefix and accepts only keys whose extracted
release ID and recomputed `getReleaseManifestPath()` agree exactly.

## A13 — Required additional tests

The implementation plan must include named tests for:

- production candidate publication followed by exact preview-manifest mirroring;
- rejection of preview-to-production manifest copying;
- `mirror-preview` checksum mismatch and immutable conflict;
- activation of the retained production candidate without source or encoder
  access;
- `assertActivationAllowed()` rejecting a preview-channel plan for a production
  publication target;
- strictly increasing `publishedAt` for publish, activate, reactivation, and
  rollback;
- small negative local-clock skew producing a monotonic successor;
- implausibly future pointer time producing a typed clock-skew failure;
- plan-time pointer change detected before the fresh activation CAS;
- a second change after the fresh read failing `If-Match`;
- typed `IfMatch` and `IfNoneMatch` command inputs without custom middleware;
- generated-key NFC normalization and post-normalization collisions;
- exact source-path mismatch diagnostics;
- aspect-warning tolerance, bounding-box dimensions, and warning aggregation;
- production confirmation required only for pointer-mutating paths;
- A→B→A rollback producing distinct pointer bytes and monotonic timestamps;
- placeholder draft parsing before canonical release-ID derivation.

## A14 — Revised HPA-233 handoff

HPA-233 receives one unambiguous publisher workflow:

```text
# Build the production-eligible immutable candidate exactly once.
publish --environment production --no-activate ...

# Mirror exact manifest bytes to the isolated preview namespace.
mirror-preview --release <releaseId> --preview-id <previewId> \
  --expect-manifest-sha256 <digest> ...

# Activate preview for reader/browser verification.
activate --environment preview --release <releaseId> \
  --preview-id <previewId> --expect-manifest-sha256 <digest> ...

# After gate approval, activate the retained production candidate.
activate --environment production --release <releaseId> \
  --expect-manifest-sha256 <digest> \
  --confirm-production <storyId> ...
```

No step after initial candidate publication reads source images, reruns Sharp,
or re-evaluates mutable authoring inputs. The preview and production manifests
are exact byte copies and reference the same content-addressed objects.

## Completion impact

HPA-230 is not design-approved until the implementation plan consumes these
clarifications. In particular, completion requires:

- production-first candidate publication and preview mirroring;
- monotonic pointer timestamps and fresh short-lived CAS snapshots;
- typed SDK conditional inputs;
- NFC-normalized authoring identities;
- explicit HPA-231 release-plan ownership;
- exact source-path maintenance behavior;
- tolerant and aggregated aspect diagnostics;
- pointer-focused production confirmation;
- explicit ABA and listing semantics;
- the additional named tests above.
