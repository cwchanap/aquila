export const SFX_CUE_KEYS = [
    'door-open',
    'notification-beep',
    'impact',
] as const;

export type SfxCueKey = (typeof SFX_CUE_KEYS)[number];

export function isSfxCueKey(value: string): value is SfxCueKey {
    return (SFX_CUE_KEYS as readonly string[]).includes(value);
}
