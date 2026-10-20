import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ResolvedCharacter } from './config';
import type { SceneIR } from './ir';
import { parseScene } from './parse-scene';

/** Locales that can be authored as a mirror tree next to the zh source. */
export const MIRROR_LOCALES = ['en', 'ja'] as const;
export type MirrorLocale = (typeof MIRROR_LOCALES)[number];

function listMarkdown(dir: string): string[] {
    const out: string[] = [];
    for (const d of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, d.name);
        if (d.isDirectory()) out.push(...listMarkdown(full));
        else if (d.isFile() && d.name.endsWith('.md')) out.push(full);
    }
    return out;
}

/**
 * Builds the scenes for a mirror locale authored under `raw/<story>/<locale>/`.
 *
 * The mirror tree holds text only: the same act files at the same relative
 * paths, each with exactly one entry per zh entry, in the same order, spoken
 * by the same character. Visual and audio fields (background, portrait, sfx,
 * bgm) are copied from the zh entry at the same index, so a translation can
 * never drift from the art or the flow graph. Returns undefined when the
 * story has no mirror tree for this locale.
 */
export function buildMirrorScenes(
    rawDir: string,
    locale: MirrorLocale,
    zhScenes: SceneIR[],
    resolveCharacter: (name: string) => ResolvedCharacter | undefined,
    defaultSpeaker?: ResolvedCharacter
): SceneIR[] | undefined {
    const root = join(rawDir, locale);
    if (!existsSync(root)) return undefined;

    const expected = new Set(zhScenes.map(s => s.sourcePath));
    const stray = listMarkdown(root)
        .map(p => relative(root, p).split('\\').join('/'))
        .filter(p => !expected.has(p));
    if (stray.length > 0) {
        throw new Error(
            `[story-compiler] ${locale}/ has files with no zh source: ${stray.join(', ')}`
        );
    }

    return zhScenes.map(scene => {
        const sourcePath = `${locale}/${scene.sourcePath}`;
        const fullPath = join(rawDir, sourcePath);
        if (!existsSync(fullPath)) {
            throw new Error(
                `[story-compiler] missing ${locale} translation: ${sourcePath}`
            );
        }
        const md = readFileSync(fullPath, 'utf8');
        if (/^```/m.test(md)) {
            throw new Error(
                `[story-compiler] ${sourcePath}: translations must not contain fenced bg/sfx/bgm blocks (they are taken from the zh source)`
            );
        }
        const parsed = parseScene(
            md,
            resolveCharacter,
            sourcePath,
            defaultSpeaker
        );
        if (parsed.entries.some(e => e.expressionKey !== undefined)) {
            throw new Error(
                `[story-compiler] ${sourcePath}: translations must not contain [expression] tags (they are taken from the zh source)`
            );
        }
        if (parsed.entries.length !== scene.entries.length) {
            throw new Error(
                `[story-compiler] ${sourcePath}: ${parsed.entries.length} entries but ${scene.sourcePath} has ${scene.entries.length}`
            );
        }
        const entries = scene.entries.map((zh, i) => {
            const tr = parsed.entries[i];
            if (tr.characterId !== zh.characterId) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: entry ${i + 1} is spoken by "${tr.characterId}" but ${scene.sourcePath} entry ${i + 1} is spoken by "${zh.characterId}"`
                );
            }
            return {
                ...zh,
                displayName: tr.displayName,
                dialogue: tr.dialogue,
            };
        });
        return {
            ...scene,
            title: parsed.title ?? scene.title,
            entries,
            sourcePath,
        };
    });
}
