import { describe, it, expect } from 'vitest';
import { resolveCharacterName } from '@/lib/character-name';
import type { Translations } from '@aquila/stories';

const t = {
    characterNames: { narrator: 'Narrator', tanaka_kenta: '田中健太' },
    reader: { unknown: 'Unknown' },
} as unknown as Translations;

describe('resolveCharacterName', () => {
    it('returns empty string for undefined entry', () => {
        expect(resolveCharacterName(undefined, t)).toBe('');
    });

    it('prefers the explicit character field over characterId', () => {
        expect(
            resolveCharacterName(
                {
                    character: '健談男大生',
                    characterId: 'tanaka_kenta',
                    dialogue: 'x',
                },
                t
            )
        ).toBe('健談男大生');
    });

    it('falls back to the localized name by characterId', () => {
        expect(
            resolveCharacterName({ characterId: 'narrator', dialogue: 'x' }, t)
        ).toBe('Narrator');
    });

    it('returns unknown when characterId is missing from the map', () => {
        expect(
            resolveCharacterName({ characterId: 'ghost', dialogue: 'x' }, t)
        ).toBe('Unknown');
    });

    it('returns empty string for narration (no character info)', () => {
        expect(resolveCharacterName({ dialogue: 'x' }, t)).toBe('');
    });
});
