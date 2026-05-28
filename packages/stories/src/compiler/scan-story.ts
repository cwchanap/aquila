import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** A directory in the story tree: its act files and child branch directories. */
export interface DirNode {
    rel: string; // '' for root, else e.g. 'branch_1b/branch_2c'
    acts: string[]; // act basenames present (no extension), e.g. ['act9','actFinal']
    children: DirNode[]; // child branch_* directories
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
        return { rel, acts, children };
    }
    return walk(rootDir, '');
}
