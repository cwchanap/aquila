import { describe, it, expect } from 'vitest';
import {
    validateEmail,
    validateUsername,
    validateCharacterName,
    validateStoryId,
    EMAIL_REGEX,
    USERNAME_REGEX,
    CHARACTER_NAME_REGEX,
    USERNAME_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
    CHARACTER_NAME_MAX_LENGTH,
    ERROR_MESSAGES,
} from '../validation';

describe('Validation Constants', () => {
    it('should have correct email regex pattern', () => {
        expect(EMAIL_REGEX).toBeInstanceOf(RegExp);
    });

    it('should have correct username regex pattern', () => {
        expect(USERNAME_REGEX).toBeInstanceOf(RegExp);
        // Test that the regex matches valid usernames
        expect(USERNAME_REGEX.test('user123')).toBe(true);
        expect(USERNAME_REGEX.test('User_Name')).toBe(true);
        expect(USERNAME_REGEX.test('user-name')).toBe(true);
    });

    it('should have correct character name regex pattern', () => {
        expect(CHARACTER_NAME_REGEX).toBeInstanceOf(RegExp);
        // Test that the regex matches valid character names
        expect(CHARACTER_NAME_REGEX.test('John Doe')).toBe(true);
        expect(CHARACTER_NAME_REGEX.test('Jane-Marie')).toBe(true);
        expect(CHARACTER_NAME_REGEX.test('Dr. Smith')).toBe(true);
        expect(CHARACTER_NAME_REGEX.test('王小明')).toBe(true);
        expect(CHARACTER_NAME_REGEX.test('Zoë Álvarez')).toBe(true);
    });

    it('should have correct username length constraints', () => {
        expect(USERNAME_MIN_LENGTH).toBe(3);
        expect(USERNAME_MAX_LENGTH).toBe(50);
    });

    it('should have correct character name length constraint', () => {
        expect(CHARACTER_NAME_MAX_LENGTH).toBe(50);
    });
});

describe('validateEmail', () => {
    const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@test.co.uk',
        'test.email@sub.domain.example.com',
        'user123@example.com',
    ];

    const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example', // TLD missing
        'user@.com',
        'user@example..com',
    ];

    // Note: 'a@b.c' fails validation because TLD must be at least 2 characters
    // Note: 'user..name@example.com' passes validation because the regex doesn't check for consecutive dots
    // These are known limitations of the current email regex

    it('should return null for valid email addresses', () => {
        validEmails.forEach(email => {
            expect(validateEmail(email)).toBeNull();
        });
    });

    it('should return notString error for non-string input', () => {
        expect(validateEmail(null)).toBe(ERROR_MESSAGES.email.notString);
        expect(validateEmail(undefined)).toBe(ERROR_MESSAGES.email.notString);
        expect(validateEmail(123)).toBe(ERROR_MESSAGES.email.notString);
        expect(validateEmail({})).toBe(ERROR_MESSAGES.email.notString);
        expect(validateEmail([])).toBe(ERROR_MESSAGES.email.notString);
    });

    it('should return required error for empty string', () => {
        expect(validateEmail('')).toBe(ERROR_MESSAGES.email.required);
        expect(validateEmail('   ')).toBe(ERROR_MESSAGES.email.required);
    });

    it('should return tooLong error for email exceeding 255 characters', () => {
        const longEmail = 'a'.repeat(256) + '@example.com';
        expect(validateEmail(longEmail)).toBe(ERROR_MESSAGES.email.tooLong);
    });

    it('should return invalid error for malformed email addresses', () => {
        invalidEmails.forEach(email => {
            expect(validateEmail(email)).toBe(ERROR_MESSAGES.email.invalid);
        });
    });

    it('should trim whitespace before validation', () => {
        expect(validateEmail('  test@example.com  ')).toBeNull();
        expect(validateEmail(' test@example.com')).toBeNull();
        expect(validateEmail('test@example.com ')).toBeNull();
    });
});

describe('validateUsername', () => {
    const validUsernames = [
        'user123',
        'User_Name',
        'user-name',
        'Us3rN4m3',
        'test_user_123',
        'abc',
        'a'.repeat(50), // Exactly 50 characters
    ];

    const invalidUsernames = [
        'ab', // Too short
        'user name', // Contains space
        'user@name', // Contains @
        'user.name', // Contains .
        'user/name', // Contains /
        'user\\name', // Contains backslash
        'a'.repeat(51), // Too long
    ];

    it('should return null for valid usernames', () => {
        validUsernames.forEach(username => {
            expect(validateUsername(username)).toBeNull();
        });
    });

    it('should return notString error for non-string input', () => {
        expect(validateUsername(null)).toBe(ERROR_MESSAGES.username.notString);
        expect(validateUsername(undefined)).toBe(
            ERROR_MESSAGES.username.notString
        );
        expect(validateUsername(123)).toBe(ERROR_MESSAGES.username.notString);
        expect(validateUsername({})).toBe(ERROR_MESSAGES.username.notString);
    });

    it('should return required error for empty string', () => {
        expect(validateUsername('')).toBe(ERROR_MESSAGES.username.required);
        expect(validateUsername('   ')).toBe(ERROR_MESSAGES.username.required);
    });

    it('should return tooShort error for username below minimum length', () => {
        expect(validateUsername('ab')).toBe(ERROR_MESSAGES.username.tooShort);
        expect(validateUsername('a')).toBe(ERROR_MESSAGES.username.tooShort);
    });

    it('should return tooLong error for username exceeding maximum length', () => {
        const tooLong = 'a'.repeat(51);
        expect(validateUsername(tooLong)).toBe(ERROR_MESSAGES.username.tooLong);
    });

    it('should return invalidChars error for usernames with invalid characters', () => {
        invalidUsernames.forEach(username => {
            if (username.length >= 3 && username.length <= 50) {
                expect(validateUsername(username)).toBe(
                    ERROR_MESSAGES.username.invalidChars
                );
            }
        });
    });

    it('should trim whitespace before validation', () => {
        expect(validateUsername('  user123  ')).toBeNull();
        expect(validateUsername(' user123')).toBeNull();
        expect(validateUsername('user123 ')).toBeNull();
    });
});

describe('validateCharacterName', () => {
    const validNames = [
        'Hero',
        'John Doe',
        'Jane-Marie',
        'Dr. Smith',
        'Mr. Anderson',
        'Test 123',
        'A B C',
        '王小明',
        'Zoë Álvarez',
        'Łukasz Kowalski',
        'A'.repeat(50), // Exactly 50 characters
    ];

    it('should return valid true for valid character names', () => {
        validNames.forEach(name => {
            const result = validateCharacterName(name);
            expect(result).toEqual({
                valid: true,
                sanitizedName: name.trim(),
            });
        });
    });

    it('should return sanitizedName (trimmed) for names with leading/trailing whitespace', () => {
        expect(validateCharacterName('  John  ')).toEqual({
            valid: true,
            sanitizedName: 'John',
        });
        expect(validateCharacterName(' John Doe ')).toEqual({
            valid: true,
            sanitizedName: 'John Doe',
        });
    });

    it('should return valid false with notString error for non-string input', () => {
        expect(validateCharacterName(null)).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.notString,
        });
        expect(validateCharacterName(undefined)).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.notString,
        });
        expect(validateCharacterName(123)).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.notString,
        });
    });

    it('should return valid false with empty error for empty string', () => {
        expect(validateCharacterName('')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.empty,
        });
        expect(validateCharacterName('   ')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.empty,
        });
    });

    it('should return valid false with tooLong error for names exceeding maximum length', () => {
        const tooLong = 'a'.repeat(51);
        expect(validateCharacterName(tooLong)).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.tooLong,
        });
    });

    it('should return valid false with invalidChars error for names with invalid characters', () => {
        expect(validateCharacterName('John@Doe')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.invalidChars,
        });
        expect(validateCharacterName('John#Doe')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.invalidChars,
        });
        expect(validateCharacterName('John&Doe')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.invalidChars,
        });
        expect(validateCharacterName('John*Doe')).toEqual({
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.invalidChars,
        });
    });

    it('should allow valid special characters', () => {
        expect(validateCharacterName('John-Doe')).toEqual({
            valid: true,
            sanitizedName: 'John-Doe',
        });
        expect(validateCharacterName('John.Doe')).toEqual({
            valid: true,
            sanitizedName: 'John.Doe',
        });
        expect(validateCharacterName('John Doe')).toEqual({
            valid: true,
            sanitizedName: 'John Doe',
        });
        expect(validateCharacterName('John_Doe')).toEqual({
            valid: true,
            sanitizedName: 'John_Doe',
        });
    });
});

describe('validateStoryId', () => {
    const allowedStories = [
        'train_adventure',
        'space_mission',
        'fantasy_quest',
    ];

    it('should return true for valid story IDs', () => {
        expect(validateStoryId('train_adventure', allowedStories)).toBe(true);
        expect(validateStoryId('space_mission', allowedStories)).toBe(true);
        expect(validateStoryId('fantasy_quest', allowedStories)).toBe(true);
    });

    it('should return false for invalid story IDs', () => {
        expect(validateStoryId('invalid_story', allowedStories)).toBe(false);
        expect(validateStoryId('Train_Adventure', allowedStories)).toBe(false); // Case-sensitive
        expect(validateStoryId('', allowedStories)).toBe(false);
        expect(validateStoryId('train_adventure_extra', allowedStories)).toBe(
            false
        );
    });

    it('should work with type narrowing', () => {
        const storyId: string = 'train_adventure';
        if (validateStoryId(storyId, allowedStories)) {
            // TypeScript should narrow type to 'train_adventure' | 'space_mission' | 'fantasy_quest'
            // This is a compile-time check, but we can verify the runtime behavior
            expect([
                'train_adventure',
                'space_mission',
                'fantasy_quest',
            ]).toContain(storyId);
        }
    });

    it('should handle empty allowed stories array', () => {
        expect(validateStoryId('any_story', [])).toBe(false);
    });
});
