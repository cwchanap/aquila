export const LOCAL_BGM_CATALOG = {
    'dawn-apartment': '/assets/vn/audio/bgm/dawn-apartment.wav',
    'tension-pulse': '/assets/vn/audio/bgm/tension-pulse.wav',
} as const;

export function resolveLocalBgmUrl(cueKey: string): string | undefined {
    return (LOCAL_BGM_CATALOG as Readonly<Record<string, string>>)[cueKey];
}
