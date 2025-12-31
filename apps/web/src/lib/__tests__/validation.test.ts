import { describe, it, expect } from 'vitest';
import { isValidCharacterName } from '../validation';

describe('validation utilities', () => {
    describe('isValidCharacterName', () => {
        it('should reject empty character name', () => {
            expect(isValidCharacterName('')).toBe(false);
        });

        it('should reject whitespace-only character name', () => {
            expect(isValidCharacterName('   ')).toBe(false);
        });

        it('should accept valid character name', () => {
            expect(isValidCharacterName('Test Hero')).toBe(true);
        });

        it('should reject null character name', () => {
            expect(isValidCharacterName(null)).toBe(false);
        });

        it('should reject undefined character name', () => {
            expect(isValidCharacterName(undefined)).toBe(false);
        });

        it('should reject non-string values', () => {
            expect(isValidCharacterName(123)).toBe(false);
            expect(isValidCharacterName({})).toBe(false);
            expect(isValidCharacterName([])).toBe(false);
        });

        it('should properly trim and validate', () => {
            expect(isValidCharacterName('  Valid Name  ')).toBe(true);
        });
    });
});
