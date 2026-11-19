import { getBrowserStorage } from './reader-mode';

export type TypingSpeed = 'instant' | 'fast' | 'normal';
export const READER_TYPING_SPEED_KEY = 'aquila:reader-typing-speed:v1';

export function readTypingSpeed(
    storage: Storage | null = getBrowserStorage()
): TypingSpeed | null {
    try {
        const value = storage?.getItem(READER_TYPING_SPEED_KEY);
        return value === 'instant' || value === 'fast' || value === 'normal'
            ? value
            : null;
    } catch {
        return null;
    }
}

export function writeTypingSpeed(
    value: TypingSpeed,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(READER_TYPING_SPEED_KEY, value);
    } catch {
        return;
    }
}

export function resolveTypingDelay(
    value: TypingSpeed | null,
    prefersReducedMotion: boolean
): number {
    if (value === 'instant' || (value === null && prefersReducedMotion))
        return 0;
    return value === 'normal' ? 30 : 10;
}
