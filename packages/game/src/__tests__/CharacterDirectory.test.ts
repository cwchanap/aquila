import { describe, it, expect } from 'vitest';
import {
    CharacterId,
    CharacterDirectory,
    type CharacterInfo,
} from '../characters/CharacterDirectory';

describe('CharacterDirectory re-export', () => {
    it('exports CharacterId', () => {
        expect(CharacterId).toBeDefined();
    });

    it('exports CharacterDirectory', () => {
        expect(CharacterDirectory).toBeDefined();
    });

    it('CharacterDirectory.getById returns a character for a known id', () => {
        const allIds = Object.values(CharacterId);
        expect(allIds.length).toBeGreaterThan(0);

        const firstId = allIds[0] as CharacterId;
        const character = CharacterDirectory.getById(firstId);
        expect(character).toBeDefined();
    });

    it('CharacterId has string values', () => {
        const ids = Object.values(CharacterId);
        for (const id of ids) {
            expect(typeof id).toBe('string');
        }
    });

    it('type CharacterInfo is usable as a type', () => {
        // Type-level test: construct an object matching CharacterInfo
        const info: CharacterInfo = CharacterDirectory.getById(
            Object.values(CharacterId)[0] as CharacterId
        );
        expect(info).toBeDefined();
        expect(info.id).toBeDefined();
        expect(info.name).toBeDefined();
    });
});
