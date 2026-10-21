import { getBrowserStorage } from '@/lib/reader-mode';

export const VOICE_ENABLED_KEY = 'aquila:voice-enabled:v1';

export function readVoiceEnabled(
    storage: Storage | null = getBrowserStorage()
): boolean {
    try {
        return storage?.getItem(VOICE_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function writeVoiceEnabled(
    enabled: boolean,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        storage?.setItem(VOICE_ENABLED_KEY, String(enabled));
    } catch {
        return;
    }
}
