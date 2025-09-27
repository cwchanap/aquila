export type SceneId =
    | 'scene_1'
    | 'scene_2'
    | 'scene_3'
    | 'scene_4a'
    | 'scene_4b';

export interface SceneInfo {
    id: SceneId;
    label: string;
    backgroundTextureKey: string;
    ambientFrequency: number;
    fallbackColor: number;
}

const sceneInfos: Record<SceneId, SceneInfo> = {
    scene_1: {
        id: 'scene_1',
        label: 'Entry Platform',
        backgroundTextureKey: 'bg-scene_1',
        ambientFrequency: 80,
        fallbackColor: 0x0b1022,
    },
    scene_2: {
        id: 'scene_2',
        label: 'Train Ride',
        backgroundTextureKey: 'bg-scene_2',
        ambientFrequency: 60,
        fallbackColor: 0x000000,
    },
    scene_3: {
        id: 'scene_3',
        label: 'Otherworld Station',
        backgroundTextureKey: 'bg-scene_3',
        ambientFrequency: 95,
        fallbackColor: 0x2b0000,
    },
    scene_4a: {
        id: 'scene_4a',
        label: 'Leave Train',
        backgroundTextureKey: 'bg-scene_3',
        ambientFrequency: 95,
        fallbackColor: 0x2b0000,
    },
    scene_4b: {
        id: 'scene_4b',
        label: 'Stay On Train',
        backgroundTextureKey: 'bg-scene_2',
        ambientFrequency: 60,
        fallbackColor: 0x000000,
    },
};

export class SceneDirectory {
    static readonly defaultStart: SceneId = 'scene_1';

    static getInfo(id: SceneId): SceneInfo {
        return sceneInfos[id];
    }

    static getAll(): SceneInfo[] {
        return Object.values(sceneInfos);
    }

    static getBackgroundTextureKey(id: SceneId): string {
        return sceneInfos[id]?.backgroundTextureKey ?? 'bg-generic';
    }

    static getAmbientFrequency(id: SceneId): number {
        return sceneInfos[id]?.ambientFrequency ?? 80;
    }

    static getFallbackColor(id: SceneId): number {
        return sceneInfos[id]?.fallbackColor ?? 0x000000;
    }

    static isSceneId(value: string | undefined | null): value is SceneId {
        if (!value) return false;
        return value in sceneInfos;
    }
}
