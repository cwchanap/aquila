/**
 * Centralized validation functions for input sanitization and format validation.
 */

// Constants
export const EMAIL_REGEX =
    /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,63}$/;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const CHARACTER_NAME_MAX_LENGTH = 50;

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const CHARACTER_NAME_REGEX = /^[A-Za-z0-9 _.-]+$/;

// Error messages
export const ERROR_MESSAGES = {
    email: {
        notString: 'email.notString',
        required: 'email.required',
        invalid: 'email.invalid',
        tooLong: 'email.tooLong',
    },
    username: {
        notString: 'username.notString',
        required: 'username.required',
        tooShort: 'username.tooShort',
        tooLong: 'username.tooLong',
        invalidChars: 'username.invalidChars',
    },
    characterName: {
        notString: 'characterName.notString',
        empty: 'characterName.empty',
        tooLong: 'characterName.tooLong',
        invalidChars: 'characterName.invalidChars',
    },
} as const;

type EmailErrorKey =
    (typeof ERROR_MESSAGES.email)[keyof typeof ERROR_MESSAGES.email];
type UsernameErrorKey =
    (typeof ERROR_MESSAGES.username)[keyof typeof ERROR_MESSAGES.username];
type CharacterNameErrorKey =
    (typeof ERROR_MESSAGES.characterName)[keyof typeof ERROR_MESSAGES.characterName];

export type ValidationErrorKey =
    | EmailErrorKey
    | UsernameErrorKey
    | CharacterNameErrorKey;

export type ValidationTranslations = {
    email: {
        notString: string;
        required: string;
        invalid: string;
        tooLong: string;
    };
    username: {
        notString: string;
        required: string;
        tooShort: string;
        tooLong: string;
        invalidChars: string;
    };
    characterName: {
        notString: string;
        empty: string;
        tooLong: string;
        invalidChars: string;
    };
};

const VALIDATION_MESSAGE_MAP: Record<
    ValidationErrorKey,
    (translations: ValidationTranslations) => string
> = {
    [ERROR_MESSAGES.email.notString]: translations =>
        translations.email.notString,
    [ERROR_MESSAGES.email.required]: translations =>
        translations.email.required,
    [ERROR_MESSAGES.email.invalid]: translations => translations.email.invalid,
    [ERROR_MESSAGES.email.tooLong]: translations => translations.email.tooLong,
    [ERROR_MESSAGES.username.notString]: translations =>
        translations.username.notString,
    [ERROR_MESSAGES.username.required]: translations =>
        translations.username.required,
    [ERROR_MESSAGES.username.tooShort]: translations =>
        translations.username.tooShort,
    [ERROR_MESSAGES.username.tooLong]: translations =>
        translations.username.tooLong,
    [ERROR_MESSAGES.username.invalidChars]: translations =>
        translations.username.invalidChars,
    [ERROR_MESSAGES.characterName.notString]: translations =>
        translations.characterName.notString,
    [ERROR_MESSAGES.characterName.empty]: translations =>
        translations.characterName.empty,
    [ERROR_MESSAGES.characterName.tooLong]: translations =>
        translations.characterName.tooLong,
    [ERROR_MESSAGES.characterName.invalidChars]: translations =>
        translations.characterName.invalidChars,
};

export function resolveValidationMessage(
    translations: ValidationTranslations,
    errorKey: ValidationErrorKey
): string {
    return VALIDATION_MESSAGE_MAP[errorKey](translations);
}

export function validateEmail(email: unknown): ValidationErrorKey | null {
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

export function validateUsername(username: unknown): ValidationErrorKey | null {
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

export type CharacterNameValidationResult =
    | { valid: true; sanitizedName: string }
    | { valid: false; errorKey: CharacterNameErrorKey };

export function validateCharacterName(
    name: unknown
): CharacterNameValidationResult {
    if (typeof name !== 'string') {
        return {
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.notString,
        };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
        return { valid: false, errorKey: ERROR_MESSAGES.characterName.empty };
    }
    if (trimmed.length > CHARACTER_NAME_MAX_LENGTH) {
        return { valid: false, errorKey: ERROR_MESSAGES.characterName.tooLong };
    }
    if (!CHARACTER_NAME_REGEX.test(trimmed)) {
        return {
            valid: false,
            errorKey: ERROR_MESSAGES.characterName.invalidChars,
        };
    }
    return { valid: true, sanitizedName: trimmed };
}

export function validateStoryId<T extends string>(
    storyId: string,
    allowedStories: readonly T[]
): storyId is T {
    return allowedStories.includes(storyId as T);
}
