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

type ParsedDirective = { name: string; value?: string };

/**
 * Splits a `Cache-Control` directive token into its name and argument.
 * Directive arguments may be quoted (RFC 7230 quoted-string), and HTTP
 * recipients are expected to honour the quoted form — so `max-age="0"` is
 * `max-age` with value `0`, not a benign unrecognised extra. Without parsing
 * the quotes, a conflicting quoted freshness directive slips past the
 * conflict check while a real cache honours its value.
 */
function parseDirective(token: string): ParsedDirective {
    const eq = token.indexOf('=');
    if (eq === -1) return { name: token };
    let value = token.slice(eq + 1);
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
    }
    return { name: token.slice(0, eq), value };
}

function parseDirectives(header: string | null): ParsedDirective[] {
    return directives(header).map(parseDirective);
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
 * forces revalidation before any use; an unqualified `private` forbids
 * shared/edge caching. A freshness directive whose value is not the
 * contract's one-year TTL overrides the intended freshness, so
 * `public, max-age=31536000, immutable, max-age=0` carries the required
 * `max-age=31536000` but the conflicting `max-age=0` is what a parser
 * honours. Directive arguments may be quoted, so the tokens are parsed into
 * name/value pairs before comparison — `s-maxage="0"` is detected as the
 * zero-TTL override it is rather than passing as an unrecognised extra. A
 * second freshness directive is ambiguous even when its text is identical to
 * the first (caches may honour either occurrence or treat the response as
 * stale), so duplicate `max-age`/`s-maxage` are rejected regardless of value.
 */
const IMMUTABLE_CONFLICTING_BY_NAME = new Set(['no-store', 'no-cache']);
const IMMUTABLE_FRESHNESS_SECONDS = '31536000';

function conflictingImmutableExtras(parsed: ParsedDirective[]): string[] {
    const conflicts: string[] = [];
    let maxAgeCount = 0;
    let sMaxAgeCount = 0;
    for (const { name, value } of parsed) {
        if (IMMUTABLE_CONFLICTING_BY_NAME.has(name)) {
            conflicts.push(name);
        } else if (name === 'private' && value === undefined) {
            conflicts.push('private');
        } else if (name === 'max-age') {
            maxAgeCount += 1;
            if (value !== IMMUTABLE_FRESHNESS_SECONDS) {
                conflicts.push(`max-age=${value ?? ''}`);
            }
        } else if (name === 's-maxage') {
            sMaxAgeCount += 1;
            if (value !== IMMUTABLE_FRESHNESS_SECONDS) {
                conflicts.push(`s-maxage=${value ?? ''}`);
            }
        }
    }
    if (maxAgeCount > 1) conflicts.push(`duplicate max-age (${maxAgeCount})`);
    if (sMaxAgeCount > 1)
        conflicts.push(`duplicate s-maxage (${sMaxAgeCount})`);
    return conflicts;
}

export function assertImmutable(header: string | null): Assertion {
    const required = assertDirectives(header, IMMUTABLE_DIRECTIVES);
    if (!required.ok) return required;
    const conflicts = conflictingImmutableExtras(parseDirectives(header));
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
