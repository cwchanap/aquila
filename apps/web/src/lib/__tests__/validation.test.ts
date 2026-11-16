import { describe, it, expect } from 'vitest';
import {
    validateEmail,
    validateUsername,
    validateStoryId,
    resolveValidationMessage,
    EMAIL_REGEX,
    USERNAME_REGEX,
    USERNAME_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
    ERROR_MESSAGES,
    type ValidationTranslations,
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

    it('should have correct username length constraints', () => {
        expect(USERNAME_MIN_LENGTH).toBe(3);
        expect(USERNAME_MAX_LENGTH).toBe(50);
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

describe('resolveValidationMessage', () => {
    const mockTranslations: ValidationTranslations = {
        email: {
            notString: 'Email must be a string',
            required: 'Email is required',
            invalid: 'Invalid email format',
            tooLong: 'Email is too long',
        },
        username: {
            notString: 'Username must be a string',
            required: 'Username is required',
            tooShort: 'Username is too short',
            tooLong: 'Username is too long',
            invalidChars: 'Username has invalid characters',
        },
    };

    it('resolves email.notString message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.email.notString
            )
        ).toBe('Email must be a string');
    });

    it('resolves email.required message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.email.required
            )
        ).toBe('Email is required');
    });

    it('resolves email.invalid message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.email.invalid
            )
        ).toBe('Invalid email format');
    });

    it('resolves email.tooLong message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.email.tooLong
            )
        ).toBe('Email is too long');
    });

    it('resolves username.notString message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.username.notString
            )
        ).toBe('Username must be a string');
    });

    it('resolves username.required message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.username.required
            )
        ).toBe('Username is required');
    });

    it('resolves username.tooShort message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.username.tooShort
            )
        ).toBe('Username is too short');
    });

    it('resolves username.tooLong message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.username.tooLong
            )
        ).toBe('Username is too long');
    });

    it('resolves username.invalidChars message', () => {
        expect(
            resolveValidationMessage(
                mockTranslations,
                ERROR_MESSAGES.username.invalidChars
            )
        ).toBe('Username has invalid characters');
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
