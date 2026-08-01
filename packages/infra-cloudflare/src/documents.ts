import type { AssetFormat } from '@aquila/stories/runtime-assets';

/**
 * Readers for the untrusted JSON the delivery host returns. Nothing here parses
 * the HPA-227 contract — that is the runtime resolver's job. These helpers only
 * extract the few fields the verifier needs, and say precisely why they could
 * not when a document is not shaped as expected.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

export function readString(value: unknown, key: string): string | null {
    const field = asRecord(value)?.[key];
    return typeof field === 'string' ? field : null;
}

/** Renders an error body on one line so it can share a check's detail string. */
export function summarize(body: string): string {
    const collapsed = body.replace(/\s+/g, ' ').trim();
    if (collapsed === '') return '<empty body>';
    return collapsed.length > 120 ? `${collapsed.slice(0, 120)}...` : collapsed;
}

export type ManifestVariant = {
    path: string;
    sha256: string;
    byteLength: number;
};

/**
 * `absent` and `malformed` are deliberately distinct outcomes. Reporting a
 * variant with a non-string `sha256` as "no webp variant" would send an
 * operator looking for a missing object instead of the bad field that is
 * actually there — a misdirecting message is worse than none.
 *
 * `byteLength` is extracted alongside `path`/`sha256` because the verifier
 * compares it against the fetched object's byte length — the same integrity
 * check the reader performs before decoding. A variant without a numeric
 * `byteLength` is therefore malformed, not found: the verifier cannot complete
 * that check without it.
 */
export type VariantLookup =
    | { kind: 'found'; variant: ManifestVariant }
    | { kind: 'absent'; detail: string }
    | { kind: 'malformed'; detail: string };

function describeUnexpected(value: unknown): string {
    if (value === undefined) return 'absent';
    return JSON.stringify(value) ?? String(value);
}

/**
 * Returns the first usable variant of `format`. A malformed candidate does not
 * end the scan — a later asset may carry a usable one, and a manifest that
 * serves the check is more useful than a complaint about an entry the verifier
 * does not need. Malformed candidates are only reported when none was usable.
 */
export function findVariant(
    manifestBody: unknown,
    format: AssetFormat
): VariantLookup {
    const assets = asRecord(manifestBody)?.assets;
    if (!Array.isArray(assets)) {
        return { kind: 'malformed', detail: 'manifest has no assets array' };
    }

    const problems: string[] = [];
    for (const [index, asset] of assets.entries()) {
        const record = asRecord(asset);
        if (record === null) {
            problems.push(
                `assets.${index} is not an object (${describeUnexpected(asset)})`
            );
            continue;
        }
        const candidate = asRecord(record.variants)?.[format];
        // An asset that simply does not offer this format is not a problem:
        // `variants.avif` is optional in the contract.
        if (candidate === undefined || candidate === null) continue;

        const location = `assets.${index}.variants.${format}`;
        const variant = asRecord(candidate);
        if (variant === null) {
            problems.push(
                `${location} is not an object (${describeUnexpected(candidate)})`
            );
            continue;
        }
        const { path, sha256, byteLength } = variant;
        if (
            typeof path === 'string' &&
            typeof sha256 === 'string' &&
            typeof byteLength === 'number'
        ) {
            return { kind: 'found', variant: { path, sha256, byteLength } };
        }
        const fields = [
            typeof path === 'string'
                ? null
                : `path is ${describeUnexpected(path)}`,
            typeof sha256 === 'string'
                ? null
                : `sha256 is ${describeUnexpected(sha256)}`,
            typeof byteLength === 'number'
                ? null
                : `byteLength is ${describeUnexpected(byteLength)}`,
        ].filter((field): field is string => field !== null);
        problems.push(`${location} is malformed (${fields.join(', ')})`);
    }

    if (problems.length > 0) {
        return { kind: 'malformed', detail: problems.join('; ') };
    }
    return {
        kind: 'absent',
        detail: `no ${format} variant among ${assets.length} asset(s)`,
    };
}
