import type { ParsedCharacterDirectory } from './parse-characters';
import type { ResolvedCharacter } from './config';

const DEFAULT_SUFFIX_RE =
    /(（內心）|\(內心\)|（内心）|的聲音|的喊聲|的低語|之聲|[?？！!。]+)$/g;

export interface ResolveConfig {
    canonicalize?: Record<string, string>;
    rolePatterns?: { pattern: RegExp; id: string }[];
    suffixRegex?: RegExp;
}

function stripSuffix(label: string, regex: RegExp): string {
    let prev: string;
    let cur = label.trim();
    do {
        prev = cur;
        cur = cur.replace(regex, '').trim();
    } while (cur !== prev);
    return cur;
}

export function buildResolveCharacter(
    dir: ParsedCharacterDirectory,
    config: ResolveConfig
): (name: string) => ResolvedCharacter | undefined {
    const suffixRe = config.suffixRegex ?? DEFAULT_SUFFIX_RE;

    return (name: string): ResolvedCharacter | undefined => {
        const displayName = config.canonicalize?.[name] ?? name;

        // Exact name/alias lookup
        const exact = dir.getIdByName(displayName);
        if (exact) return { id: exact, displayName };

        // Suffix stripping
        const base = stripSuffix(displayName, suffixRe);
        if (base !== displayName) {
            // Re-run canonicalization on the stripped base so that variant
            // forms (e.g. "齋藤大輔（內心）" -> base "齋藤大輔" -> canonical
            // "斎藤大輔") still resolve when the canonicalize map only covers
            // the un-suffixed form.
            const canonicalBase = config.canonicalize?.[base] ?? base;
            const viaBase = dir.getIdByName(canonicalBase);
            if (viaBase) return { id: viaBase, displayName };
        }

        // Role patterns
        if (config.rolePatterns) {
            for (const r of config.rolePatterns) {
                r.pattern.lastIndex = 0;
                if (r.pattern.test(displayName) || r.pattern.test(base)) {
                    if (!dir.getById(r.id)) {
                        throw new Error(
                            `[story-compiler] role pattern references unknown character ID "${r.id}"`
                        );
                    }
                    return { id: r.id, displayName };
                }
            }
        }

        return undefined;
    };
}
