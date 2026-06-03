import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** A directory in the story tree: its act files, child branch directories, and chapter directories. */
export interface DirNode {
    rel: string; // '' for root, else e.g. 'chapter_1' or 'branch_1b/branch_2c'
    acts: string[]; // act basenames present (no extension), e.g. ['act9','actFinal']
    children: DirNode[]; // child branch_* directories
    chapters: DirNode[]; // child chapter_* directories (processed sequentially)
}

export function scanStory(rootDir: string): DirNode {
    function walk(absDir: string, rel: string): DirNode {
        const dirents = readdirSync(absDir, { withFileTypes: true });
        const acts = dirents
            .filter(d => d.isFile() && d.name.endsWith('.md'))
            .map(d => d.name.replace(/\.md$/, ''));
        const children = dirents
            .filter(d => d.isDirectory() && d.name.startsWith('branch_'))
            .map(d =>
                walk(join(absDir, d.name), rel ? `${rel}/${d.name}` : d.name)
            );
        const chapters = dirents
            .filter(d => d.isDirectory() && d.name.startsWith('chapter_'))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(d =>
                walk(join(absDir, d.name), rel ? `${rel}/${d.name}` : d.name)
            );
        return { rel, acts, children, chapters };
    }
    return walk(rootDir, '');
}
