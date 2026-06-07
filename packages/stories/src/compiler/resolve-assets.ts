import type { DialogueEntryIR } from './ir';
import type { PortraitPromptMap } from './parse-portraits';

export interface AssetManifestEntry {
    key: string;
    path: string;
    prompt: string;
}

export interface SceneAssets {
    backgrounds: AssetManifestEntry[];
    portraits: AssetManifestEntry[];
}

function getDirName(sourcePath: string): string {
    const slashIdx = sourcePath.lastIndexOf('/');
    if (slashIdx === -1) return '_root';
    return sourcePath.slice(0, slashIdx);
}

export function resolveSceneAssets(
    storyId: string,
    sceneId: string,
    sourcePath: string,
    entries: DialogueEntryIR[],
    portraitMap: PortraitPromptMap
): SceneAssets {
    const dirName = getDirName(sourcePath);
    const backgrounds: AssetManifestEntry[] = [];
    const portraits: AssetManifestEntry[] = [];
    const bgByKey = new Map<string, AssetManifestEntry>();
    const portraitByKey = new Map<string, AssetManifestEntry>();

    let currentBgPrompt: string | undefined;
    let sectionIndex = -1;

    for (const entry of entries) {
        if (entry.backgroundPrompt !== undefined) {
            currentBgPrompt = entry.backgroundPrompt;
            sectionIndex++;
        }

        if (currentBgPrompt !== undefined && sectionIndex >= 0) {
            const bgKey = `${dirName}/${sceneId}_s${sectionIndex}`;
            entry.background = bgKey;
            if (!bgByKey.has(bgKey)) {
                const bgEntry: AssetManifestEntry = {
                    key: bgKey,
                    path: `${storyId}/backgrounds/${bgKey}.png`,
                    prompt: currentBgPrompt,
                };
                bgByKey.set(bgKey, bgEntry);
                backgrounds.push(bgEntry);
            }
        }

        const prompts = portraitMap[entry.characterId];
        if (prompts) {
            const expression = entry.expressionKey || 'base';
            const promptText = prompts[expression] || prompts['base'];
            if (promptText) {
                const portraitKey = `${entry.characterId}/${expression}`;
                entry.portrait = portraitKey;
                if (!portraitByKey.has(portraitKey)) {
                    portraitByKey.set(portraitKey, {
                        key: portraitKey,
                        path: `${storyId}/characters/${portraitKey}.png`,
                        prompt: promptText,
                    });
                    portraits.push(portraitByKey.get(portraitKey)!);
                }
            }
        }
    }

    return { backgrounds, portraits };
}

export interface AssetManifest {
    storyId: string;
    backgrounds: AssetManifestEntry[];
    portraits: AssetManifestEntry[];
}

export function buildAssetManifest(
    storyId: string,
    sceneAssets: SceneAssets[]
): AssetManifest {
    const bgByKey = new Map<string, AssetManifestEntry>();
    const portraitByKey = new Map<string, AssetManifestEntry>();
    for (const sa of sceneAssets) {
        for (const bg of sa.backgrounds) bgByKey.set(bg.key, bg);
        for (const p of sa.portraits) portraitByKey.set(p.key, p);
    }
    return {
        storyId,
        backgrounds: [...bgByKey.values()],
        portraits: [...portraitByKey.values()],
    };
}
