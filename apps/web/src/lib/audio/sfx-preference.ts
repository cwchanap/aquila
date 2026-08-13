import { getBrowserStorage } from '@/lib/reader-mode';

export const SFX_ENABLED_KEY = 'aquila:sfx-enabled:v1';

export function readSfxEnabled(
    storage: Storage | null = getBrowserStorage()
): boolean {
    try {
        return storage?.getItem(SFX_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function writeSfxEnabled(
    enabled: boolean,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(SFX_ENABLED_KEY, String(enabled));
    } catch {
        return;
    }
}
