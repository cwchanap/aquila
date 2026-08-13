import type { SfxCueKey } from '@aquila/stories';

export const LOCAL_SFX_CATALOG = {
    'door-open': '/assets/vn/audio/sfx/door-open.wav',
    'notification-beep': '/assets/vn/audio/sfx/notification-beep.wav',
    impact: '/assets/vn/audio/sfx/impact.wav',
} satisfies Record<SfxCueKey, string>;

export function resolveLocalSfxUrl(cueKey: string): string | undefined {
    return (LOCAL_SFX_CATALOG as Readonly<Record<string, string>>)[cueKey];
}
