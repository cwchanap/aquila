import { createHash } from 'node:crypto';
import { isPreviewId } from '@aquila/stories/runtime-assets';

/** isPreviewId() accepts at most 63 characters. */
const MAX_ID_LENGTH = 63;
/** Slug budget when truncating, leaving room for `-` plus SUFFIX_HEX_LENGTH. */
const TRUNCATED_SLUG_LENGTH = 54;
const SUFFIX_HEX_LENGTH = 6;
const FALLBACK_HEX_LENGTH = 8;

function hexDigest(value: string, length: number): string {
    return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function isPresent(value: string | undefined): boolean {
    return value !== undefined && value.trim().length > 0;
}

/**
 * Vercel branch names routinely violate isPreviewId(): `HPA-229` has
 * uppercase, `feature/Foo_Bar` has a slash, and branches can exceed 63
 * characters. Derive a valid id deterministically so the same branch always
 * maps to the same preview namespace.
 *
 * The hash paths below digest the NFC-normalized ref rather than the raw one,
 * so canonically equivalent refs share a namespace instead of splitting into
 * two.
 */
export function derivePreviewId(ref: string): string {
    const normalized = ref.normalize('NFC');
    const slug = normalized
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/[-_]{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '');

    if (slug.length === 0) {
        return `preview-${hexDigest(normalized, FALLBACK_HEX_LENGTH)}`;
    }
    if (slug.length <= MAX_ID_LENGTH) return slug;

    // `author/ticket-long-description` is the branch convention in this repo
    // and it already overflows 63 slug characters, so a bare clamp maps a
    // branch, its `-followup`, and its `-fix` onto one preview namespace:
    // publishing from one would overwrite the others' assets and an open
    // preview would start serving a sibling's release. Truncation therefore
    // carries a discriminator derived from the whole ref. Refs that fit are
    // untouched and stay readable.
    const head = slug.slice(0, TRUNCATED_SLUG_LENGTH).replace(/[-_]+$/g, '');
    return `${head}-${hexDigest(normalized, SUFFIX_HEX_LENGTH)}`;
}

/**
 * The build-time gate around derivePreviewId, separated from the CLI block so
 * it is testable. Returns an empty string — "contribute nothing" — unless a
 * preview id is both wanted and usable:
 *
 *  - Outside `VERCEL_ENV=preview` an id is meaningless or fatal:
 *    resolveAssetSource() rejects one for the production and local
 *    environments.
 *  - Without PUBLIC_ASSET_BASE_URL and PUBLIC_ASSET_ENVIRONMENT=preview, an id
 *    on its own is worse than nothing. It is truthy, so it suppresses the
 *    bundled-fixture fallback (which keys off a wholly empty config) and then
 *    trips the incomplete-configuration check, leaving the reader with no
 *    visuals at all. Values are trimmed to match
 *    readAssetSourceConfigFromEnv, which treats whitespace-only as unset.
 */
export function previewIdForEnv(
    env: Record<string, string | undefined>
): string {
    if (env.VERCEL_ENV !== 'preview') return '';
    if (!isPresent(env.PUBLIC_ASSET_BASE_URL)) return '';
    if (env.PUBLIC_ASSET_ENVIRONMENT?.trim() !== 'preview') return '';
    return derivePreviewId(env.VERCEL_GIT_COMMIT_REF ?? '');
}

if (import.meta.main) {
    const previewId = previewIdForEnv(process.env);
    // Validate our own output. An id that fails isPreviewId would otherwise
    // surface only in the browser, as a reader that silently renders with no
    // visuals — so fail the build here instead.
    if (previewId.length > 0 && !isPreviewId(previewId)) {
        process.stderr.write(
            `asset-preview-id: derived an invalid preview id: ${previewId}\n`
        );
        process.exit(1);
    }
    process.stdout.write(previewId);
}
