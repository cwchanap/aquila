export type ReaderMode = 'text' | 'visual';

export const READER_MODE_KEY = 'aquila:reader-mode:v1';

export function getBrowserStorage(): Storage | null {
    try {
        return globalThis.localStorage;
    } catch {
        return null;
    }
}

export function readReaderMode(
    storage: Storage | null = getBrowserStorage()
): ReaderMode {
    try {
        return storage?.getItem(READER_MODE_KEY) === 'visual'
            ? 'visual'
            : 'text';
    } catch {
        return 'text';
    }
}

export function writeReaderMode(
    mode: ReaderMode,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(READER_MODE_KEY, mode);
    } catch {
        return;
    }
}
