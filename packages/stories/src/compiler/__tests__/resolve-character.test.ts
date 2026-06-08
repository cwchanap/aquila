import { describe, it, expect } from 'vitest';
import { buildResolveCharacter } from '../resolve-character';
import type { ParsedCharacterDirectory } from '../parse-characters';

function makeDir(
    chars: { id: string; name: string; aliases?: string[] }[]
): ParsedCharacterDirectory {
    const byId = new Map(chars.map(c => [c.id, c]));
    const nameToId = new Map<string, string>();
    for (const c of chars) {
        nameToId.set(c.name, c.id);
        for (const a of c.aliases ?? []) nameToId.set(a, c.id);
    }
    return {
        characters: chars as any,
        getById: (id: string) => byId.get(id) as any,
        getIdByName: (name: string) => nameToId.get(name),
    };
}

describe('buildResolveCharacter', () => {
    const dir = makeDir([
        { id: 'gu_yan', name: '顧言', aliases: ['小顧'] },
        { id: 'narrator', name: '旁白' },
        { id: 'student', name: '學生', aliases: ['同學'] },
    ]);

    it('resolves exact name', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('顧言')).toEqual({ id: 'gu_yan', displayName: '顧言' });
    });

    it('resolves alias', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('小顧')).toEqual({ id: 'gu_yan', displayName: '小顧' });
    });

    it('applies canonicalize map before lookup', () => {
        const resolve = buildResolveCharacter(dir, {
            canonicalize: { 顧言同學: '顧言' },
        });
        expect(resolve('顧言同學')).toEqual({
            id: 'gu_yan',
            displayName: '顧言',
        });
    });

    it('strips suffixes for resolution', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('顧言（內心）')).toEqual({
            id: 'gu_yan',
            displayName: '顧言（內心）',
        });
    });

    it('re-canonicalizes the stripped base before lookup', () => {
        // canonicalize maps only the un-suffixed base form to a resolvable
        // alias; the base itself is NOT a name/alias in the directory, so the
        // lookup only succeeds when canonicalize is re-applied after stripping.
        const resolve = buildResolveCharacter(dir, {
            canonicalize: { 顧言同學: '小顧' },
        });
        expect(resolve('顧言同學（內心）')).toEqual({
            id: 'gu_yan',
            displayName: '顧言同學（內心）',
        });
    });

    it('matches role patterns', () => {
        const resolve = buildResolveCharacter(dir, {
            rolePatterns: [{ pattern: /^隔壁同學$/, id: 'student' }],
        });
        expect(resolve('隔壁同學')).toEqual({
            id: 'student',
            displayName: '隔壁同學',
        });
    });

    it('returns undefined for unknown names', () => {
        const resolve = buildResolveCharacter(dir, {});
        expect(resolve('完全不存在')).toBeUndefined();
    });

    it('throws if role pattern references unknown character ID', () => {
        const resolve = buildResolveCharacter(dir, {
            rolePatterns: [{ pattern: /^x$/, id: 'nonexistent' }],
        });
        expect(() => resolve('x')).toThrow(/unknown character ID.*nonexistent/);
    });
});
