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

export function assertImmutable(header: string | null): Assertion {
    return assertDirectives(header, IMMUTABLE_DIRECTIVES);
}

export function assertPointerRevalidation(header: string | null): Assertion {
    return assertDirectives(header, POINTER_DIRECTIVES);
}

export function assertContentType(
    header: string | null,
    expected: string
): Assertion {
    const actual = (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    const ok = actual === expected;
    const observed = `content-type: ${header ?? '<missing>'}`;
    return {
        ok,
        detail: ok ? observed : `${observed} (expected ${expected})`,
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
