import { RUNTIME_ASSET_CACHE_POLICY } from '@aquila/stories/runtime-assets';

export type CheckResult = {
    name: string;
    ok: boolean;
    detail: string;
    warning?: boolean;
};

type Assertion = { ok: boolean; detail: string };

function directives(header: string | null): string[] {
    return (header ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean);
}

// The two canonical response headers belong to the HPA-227 cache policy, so the
// required directives are read from it rather than restated here — a change to
// the contract cannot leave this verifier asserting the old one.
const IMMUTABLE_DIRECTIVES = directives(
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl
);
const POINTER_DIRECTIVES = directives(
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
);

/**
 * Every required directive must be present, but order and extras are ignored:
 * an origin or a proxy may reorder directives or append its own, and neither
 * changes the caching semantics the contract asks for. Dropping a required
 * directive does.
 */
function assertDirectives(
    header: string | null,
    required: string[]
): Assertion {
    const present = directives(header);
    const missing = required.filter(directive => !present.includes(directive));
    const observed = `cache-control: ${header ?? '<missing>'}`;
    return {
        ok: missing.length === 0,
        detail:
            missing.length === 0
                ? observed
                : `${observed} (missing: ${missing.join(', ')})`,
    };
}

/**
 * Directives that contradict the immutable policy even when every required
 * directive is also present. `no-store` forbids caching entirely; `no-cache`
 * forces revalidation before any use; `private` forbids shared/edge caching.
 * A second `max-age` or `s-maxage` whose value is not the contract's one-year
 * freshness overrides the intended TTL — a header like
 * `public, max-age=31536000, immutable, max-age=0` carries the required
 * `max-age=31536000` but the conflicting `max-age=0` is what a parser honours,
 * so it must fail the verifier rather than pass as a benign extra.
 */
const IMMUTABLE_CONFLICTING = new Set(['no-store', 'no-cache', 'private']);
const MAX_AGE_PATTERN = /^max-age=(\d+)$/;
const S_MAX_AGE_PATTERN = /^s-maxage=(\d+)$/;
const IMMUTABLE_FRESHNESS_SECONDS = '31536000';

function conflictingImmutableExtras(present: string[]): string[] {
    const conflicts: string[] = [];
    for (const directive of present) {
        if (IMMUTABLE_CONFLICTING.has(directive)) {
            conflicts.push(directive);
            continue;
        }
        const maxAge = MAX_AGE_PATTERN.exec(directive);
        if (maxAge && maxAge[1] !== IMMUTABLE_FRESHNESS_SECONDS) {
            conflicts.push(directive);
            continue;
        }
        const sMaxAge = S_MAX_AGE_PATTERN.exec(directive);
        if (sMaxAge && sMaxAge[1] !== IMMUTABLE_FRESHNESS_SECONDS) {
            conflicts.push(directive);
        }
    }
    return conflicts;
}

export function assertImmutable(header: string | null): Assertion {
    const required = assertDirectives(header, IMMUTABLE_DIRECTIVES);
    if (!required.ok) return required;
    const conflicts = conflictingImmutableExtras(directives(header));
    if (conflicts.length === 0) return required;
    return {
        ok: false,
        detail: `cache-control: ${header ?? '<missing>'} (conflicting: ${conflicts.join(', ')})`,
    };
}

export function assertPointerRevalidation(header: string | null): Assertion {
    return assertDirectives(header, POINTER_DIRECTIVES);
}

function mediaType(value: string): string {
    return value.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function assertContentType(
    header: string | null,
    expected: string
): Assertion {
    // Both sides are normalized: media types are case-insensitive, so a caller
    // passing `Image/WebP` must not be a silent false negative.
    const wanted = mediaType(expected);
    const ok = mediaType(header ?? '') === wanted;
    const observed = `content-type: ${header ?? '<missing>'}`;
    return {
        ok,
        detail: ok ? observed : `${observed} (expected ${wanted})`,
    };
}

/**
 * The contract forbids prompts, source paths, provider metadata, and
 * credentials in public runtime data. Walk key paths rather than substring
 * matching the body: a logical asset key may legitimately contain the word
 * "prompt" in a value.
 */
const FORBIDDEN_KEYS = new Set([
    'prompt',
    'prompts',
    'sourcepath',
    'sourcepaths',
    'localpath',
    'provider',
    'credential',
    'credentials',
    'secret',
    'token',
]);

export function findForbiddenKeys(value: unknown, path = ''): string[] {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) =>
            findForbiddenKeys(item, path ? `${path}.${index}` : String(index))
        );
    }
    if (value === null || typeof value !== 'object') return [];

    const found: string[] = [];
    for (const [key, nested] of Object.entries(value)) {
        const here = path ? `${path}.${key}` : key;
        if (FORBIDDEN_KEYS.has(key.toLowerCase())) found.push(here);
        found.push(...findForbiddenKeys(nested, here));
    }
    return found;
}
