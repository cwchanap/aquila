import type { DialogueEntryIR } from './ir';

type PortraitPromptMap = Partial<Record<string, Record<string, string>>>;

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

    let currentBgKey: string | undefined;
    let sectionIndex = -1;

    for (const entry of entries) {
        if (entry.backgroundPrompt !== undefined) {
            // Unnamed blocks are numbered in order; named ones keep their
            // name, so adding a named block never renumbers the others.
            let bgKey: string;
            if (entry.backgroundName !== undefined) {
                bgKey = `${dirName}/${sceneId}_${entry.backgroundName}`;
            } else {
                sectionIndex++;
                bgKey = `${dirName}/${sceneId}_s${sectionIndex}`;
            }
            if (bgByKey.has(bgKey)) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: background "${bgKey}" is defined twice; reuse it with a "reuse ${bgKey}" bg block`
                );
            }
            const bgEntry: AssetManifestEntry = {
                key: bgKey,
                path: `${storyId}/backgrounds/${bgKey}.png`,
                prompt: entry.backgroundPrompt,
            };
            bgByKey.set(bgKey, bgEntry);
            backgrounds.push(bgEntry);
            currentBgKey = bgKey;
        } else if (entry.backgroundReuse !== undefined) {
            currentBgKey = entry.backgroundReuse;
        }

        if (currentBgKey !== undefined) entry.background = currentBgKey;

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

/** Every `reuse <key>` bg block must name a background some scene of the
 *  story defines; otherwise the reader would ask for an image that is never
 *  generated or published. */
export function assertBackgroundReusesResolve(
    scenes: readonly { sourcePath: string; entries: DialogueEntryIR[] }[],
    manifest: AssetManifest
): void {
    const known = new Set(manifest.backgrounds.map(bg => bg.key));
    for (const scene of scenes) {
        for (const entry of scene.entries) {
            const key = entry.backgroundReuse;
            if (key !== undefined && !known.has(key)) {
                throw new Error(
                    `[story-compiler] ${scene.sourcePath}: bg block reuses "${key}", but no bg block in this story defines it`
                );
            }
        }
    }
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
