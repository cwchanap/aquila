// Legacy type for backwards compatibility - new code should use SceneRegistry
export type SceneId =
    | 'scene_1'
    | 'scene_2'
    | 'scene_3'
    | 'scene_4a'
    | 'scene_4b';

export interface SceneInfo {
    id: string;
    label: string;
    backgroundTextureKey: string;
    ambientFrequency: number;
    fallbackColor: number;
}

// Runtime registry for dynamic scene configuration
export class SceneRegistry {
    private static scenes: Map<string, SceneInfo> = new Map();
    private static _defaultStart: string = 'scene_1';

    static register(config: SceneInfo): void {
        this.scenes.set(config.id, config);
    }

    static registerMany(configs: SceneInfo[]): void {
        configs.forEach(config => this.register(config));
    }

    static get(id: string): SceneInfo | undefined {
        return this.scenes.get(id);
    }

    static has(id: string): boolean {
        return this.scenes.has(id);
    }

    static all(): SceneInfo[] {
        return Array.from(this.scenes.values());
    }

    static clear(): void {
        this.scenes.clear();
        this._defaultStart = '';
    }

    static get defaultStart(): string {
        return this._defaultStart;
    }

    static setDefaultStart(id: string): void {
        if (!this.scenes.has(id)) {
            throw new Error(
                `Cannot set default start to unregistered scene: ${id}`
            );
        }
        this._defaultStart = id;
    }

    static getBackgroundTextureKey(id: string): string {
        return this.scenes.get(id)?.backgroundTextureKey ?? 'bg-generic';
    }

    static getAmbientFrequency(id: string): number {
        return this.scenes.get(id)?.ambientFrequency ?? 80;
    }

    static getFallbackColor(id: string): number {
        return this.scenes.get(id)?.fallbackColor ?? 0x000000;
    }
}

// Default scenes - registered on module load for backwards compatibility
const defaultScenes: SceneInfo[] = [
    {
        id: 'scene_1',
        label: 'Entry Platform',
        backgroundTextureKey: 'bg-scene_1',
        ambientFrequency: 80,
        fallbackColor: 0x0b1022,
    },
    {
        id: 'scene_2',
        label: 'Train Ride',
        backgroundTextureKey: 'bg-scene_2',
        ambientFrequency: 60,
        fallbackColor: 0x000000,
    },
    {
        id: 'scene_3',
        label: 'Otherworld Station',
        backgroundTextureKey: 'bg-scene_3',
        ambientFrequency: 95,
        fallbackColor: 0x2b0000,
    },
    {
        id: 'scene_4a',
        label: 'Leave Train',
        backgroundTextureKey: 'bg-scene_3',
        ambientFrequency: 95,
        fallbackColor: 0x2b0000,
    },
    {
        id: 'scene_4b',
        label: 'Stay On Train',
        backgroundTextureKey: 'bg-scene_2',
        ambientFrequency: 60,
        fallbackColor: 0x000000,
    },
];

// Auto-register default scenes
SceneRegistry.registerMany(defaultScenes);

// SceneDirectory facade for backwards compatibility
export class SceneDirectory {
    static get defaultStart(): SceneId {
        return SceneRegistry.defaultStart as SceneId;
    }

    static getInfo(id: SceneId | string): SceneInfo | undefined {
        return SceneRegistry.get(id);
    }

    static getAll(): SceneInfo[] {
        return SceneRegistry.all();
    }

    static getBackgroundTextureKey(id: SceneId | string): string {
        return SceneRegistry.getBackgroundTextureKey(id);
    }

    static getAmbientFrequency(id: SceneId | string): number {
        return SceneRegistry.getAmbientFrequency(id);
    }

    static getFallbackColor(id: SceneId | string): number {
        return SceneRegistry.getFallbackColor(id);
    }

    static isRegisteredScene(value: string | undefined | null): boolean {
        if (!value) return false;
        return SceneRegistry.has(value);
    }
}
