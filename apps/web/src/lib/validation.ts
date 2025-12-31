/**
 * Shared validation utilities used across API endpoints and UI
 */

/**
 * Validates character name input
 * @param name - The value to validate
 * @returns True if valid character name, false otherwise
 */
export function isValidCharacterName(name: unknown): name is string {
    return !!name && typeof name === 'string' && name.trim().length > 0;
}
