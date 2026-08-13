import type { BgmCueKey } from '@aquila/stories';

export const LOCAL_BGM_CATALOG = {
    'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
    'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} satisfies Record<BgmCueKey, string>;

export function resolveLocalBgmUrl(cueKey: string): string | undefined {
    return (LOCAL_BGM_CATALOG as Readonly<Record<string, string>>)[cueKey];
}
