import { getBrowserStorage } from '@/lib/reader-mode';

export const BGM_ENABLED_KEY = 'aquila:bgm-enabled:v1';

export function readBgmEnabled(
    storage: Storage | null = getBrowserStorage()
): boolean {
    try {
        return storage?.getItem(BGM_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function writeBgmEnabled(
    enabled: boolean,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(BGM_ENABLED_KEY, String(enabled));
    } catch {
        return;
    }
}
