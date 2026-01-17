/**
 * Centralized validation functions for input sanitization and format validation.
 */

// Constants
const EMAIL_REGEX_PATTERN =
    '^[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,61}[a-zA-Z0-9]@(?:[a-zA-Z0-9-]{1,61}\\.){1,3}[a-zA-Z]{2,3}$';
export const EMAIL_REGEX = new RegExp(EMAIL_REGEX_PATTERN);

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const CHARACTER_NAME_MAX_LENGTH = 50;

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const CHARACTER_NAME_REGEX = /^[A-Za-z0-9 _.-]+$/;

// Error messages
export const ERROR_MESSAGES = {
    email: {
        notString: 'Email must be a string',
        required: 'Email is required',
        invalid: 'Invalid email format',
        tooLong: 'Email must be at most 255 characters',
    },
    username: {
        notString: 'Username must be a string',
        required: 'Username is required',
        tooShort: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
        tooLong: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
        invalidChars:
            'Username can only contain letters, numbers, underscores, and hyphens',
    },
    characterName: {
        notString: 'Character name must be a string',
        empty: 'Character name cannot be empty',
        tooLong: `Character name must be at most ${CHARACTER_NAME_MAX_LENGTH} characters`,
        invalidChars:
            'Character name contains invalid characters. Only letters, numbers, spaces, and certain special characters are allowed.',
    },
} as const;

export function validateEmail(email: unknown): string | null {
    if (typeof email !== 'string') {
        return ERROR_MESSAGES.email.notString;
    }
    const trimmed = email.trim();
    if (!trimmed) {
        return ERROR_MESSAGES.email.required;
    }
    if (trimmed.length > 255) {
        return ERROR_MESSAGES.email.tooLong;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
        return ERROR_MESSAGES.email.invalid;
    }
    return null;
}

export function validateUsername(username: unknown): string | null {
    if (typeof username !== 'string') {
        return ERROR_MESSAGES.username.notString;
    }
    const trimmed = username.trim();
    if (!trimmed) {
        return ERROR_MESSAGES.username.required;
    }
    if (trimmed.length < USERNAME_MIN_LENGTH) {
        return ERROR_MESSAGES.username.tooShort;
    }
    if (trimmed.length > USERNAME_MAX_LENGTH) {
        return ERROR_MESSAGES.username.tooLong;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
        return ERROR_MESSAGES.username.invalidChars;
    }
    return null;
}

export function validateCharacterName(name: unknown): {
    valid: boolean;
    sanitizedName?: string;
} {
    if (typeof name !== 'string') {
        return { valid: false };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { valid: false };
    }
    if (trimmed.length > CHARACTER_NAME_MAX_LENGTH) {
        return { valid: false };
    }
    if (!CHARACTER_NAME_REGEX.test(trimmed)) {
        return { valid: false };
    }
    return { valid: true, sanitizedName: trimmed };
}

export function validateStoryId<T extends string>(
    storyId: string,
    allowedStories: readonly T[]
): storyId is T {
    return allowedStories.includes(storyId as T);
}
