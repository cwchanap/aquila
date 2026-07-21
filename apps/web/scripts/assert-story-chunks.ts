import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

type ManifestEntry = {
    file: string;
    src?: string;
    name?: string;
    isEntry?: boolean;
    isDynamicEntry?: boolean;
    imports?: string[];
    dynamicImports?: string[];
};

type Manifest = Record<string, ManifestEntry>;

type ImportKind = 'static' | 'dynamic';

type ImportStep = {
    key: string;
    kind?: ImportKind;
};

type StoryBoundary = {
    source: string;
    generatedDirectory: string;
};

const stories: StoryBoundary[] = [
    {
        source: 'stories/trainAdventure/index.ts',
        generatedDirectory: 'generated/trainAdventure/',
    },
    {
        source: 'stories/dontSaveMeBeforeMidnight/index.ts',
        generatedDirectory: 'generated/dontSaveMeBeforeMidnight/',
    },
    {
        source: 'stories/theSeventhMirror/index.ts',
        generatedDirectory: 'generated/theSeventhMirror/',
    },
];

function normalize(value: string): string {
    const slashNormalized = value.replaceAll('\\', '/');

    try {
        return decodeURIComponent(slashNormalized);
    } catch {
        return slashNormalized;
    }
}

function findManifestPath(): string {
    const distDirectory = path.resolve(import.meta.dir, '../dist');
    const expectedPaths = [
        path.join(distDirectory, 'client/.vite/manifest.json'),
        path.join(distDirectory, 'client/manifest.json'),
        path.join(distDirectory, '.vite/manifest.json'),
    ];
    const expected = expectedPaths.find(existsSync);
    if (expected) {
        return expected;
    }

    const discovered: string[] = [];
    const visit = (directory: string, depth: number): void => {
        if (depth > 5 || !existsSync(directory)) {
            return;
        }

        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                visit(entryPath, depth + 1);
            } else if (entry.isFile() && entry.name === 'manifest.json') {
                discovered.push(entryPath);
            }
        }
    };
    visit(distDirectory, 0);

    const clientManifests = discovered.filter(candidate => {
        const normalized = normalize(candidate);
        return (
            normalized.includes('/client/') && normalized.includes('/.vite/')
        );
    });
    if (clientManifests.length === 1) {
        return clientManifests[0];
    }

    const detail = discovered.length
        ? ` Found other manifests:\n${discovered.map(file => `  - ${file}`).join('\n')}`
        : '';
    throw new Error(
        `Missing Vite client manifest. Expected ${expectedPaths[0]}.${detail}`
    );
}

function readManifest(manifestPath: string): Manifest {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Invalid Vite manifest object: ${manifestPath}`);
    }

    return parsed as Manifest;
}

function entryValues(key: string, entry: ManifestEntry): string[] {
    return [key, entry.src, entry.name, entry.file]
        .filter((value): value is string => typeof value === 'string')
        .map(normalize);
}

function entryContains(
    key: string,
    entry: ManifestEntry,
    fragment: string
): boolean {
    const normalizedFragment = normalize(fragment);
    return entryValues(key, entry).some(value =>
        value.includes(normalizedFragment)
    );
}

function describeEntry(manifest: Manifest, key: string): string {
    const entry = manifest[key];
    return entry ? `${key} (${entry.file})` : `${key} (missing manifest entry)`;
}

function formatImportChain(manifest: Manifest, chain: ImportStep[]): string {
    return chain
        .map((step, index) => {
            const prefix =
                index === 0 ? '  ' : `  --${step.kind ?? 'static'} import--> `;
            return `${prefix}${describeEntry(manifest, step.key)}`;
        })
        .join('\n');
}

function assertImportTargetsExist(
    manifest: Manifest,
    key: string,
    chain: ImportStep[]
): ManifestEntry {
    const entry = manifest[key];
    if (!entry) {
        throw new Error(
            `Manifest import points to a missing key:\n${formatImportChain(manifest, chain)}`
        );
    }
    return entry;
}

function findStaticViolation(
    manifest: Manifest,
    startKey: string,
    violates: (key: string, entry: ManifestEntry) => boolean
): ImportStep[] | undefined {
    const queue: ImportStep[][] = [[{ key: startKey }]];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const chain = queue.shift()!;
        const key = chain.at(-1)!.key;
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);

        const entry = assertImportTargetsExist(manifest, key, chain);
        if (violates(key, entry)) {
            return chain;
        }

        for (const importedKey of entry.imports ?? []) {
            queue.push([...chain, { key: importedKey, kind: 'static' }]);
        }
    }

    return undefined;
}

function findDynamicPath(
    manifest: Manifest,
    startKey: string,
    targetKey: string
): ImportStep[] | undefined {
    const queue: Array<{ chain: ImportStep[]; usedDynamicImport: boolean }> = [
        { chain: [{ key: startKey }], usedDynamicImport: false },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const current = queue.shift()!;
        const key = current.chain.at(-1)!.key;
        const visitKey = `${key}:${current.usedDynamicImport}`;
        if (visited.has(visitKey)) {
            continue;
        }
        visited.add(visitKey);

        const entry = assertImportTargetsExist(manifest, key, current.chain);
        if (key === targetKey && current.usedDynamicImport) {
            return current.chain;
        }

        for (const importedKey of entry.imports ?? []) {
            queue.push({
                chain: [...current.chain, { key: importedKey, kind: 'static' }],
                usedDynamicImport: current.usedDynamicImport,
            });
        }
        for (const importedKey of entry.dynamicImports ?? []) {
            queue.push({
                chain: [
                    ...current.chain,
                    { key: importedKey, kind: 'dynamic' },
                ],
                usedDynamicImport: true,
            });
        }
    }

    return undefined;
}

function findStoryEntries(manifest: Manifest): Map<StoryBoundary, string> {
    const storyEntries = new Map<StoryBoundary, string>();

    for (const story of stories) {
        const matchingEntries = Object.entries(manifest).filter(
            ([key, entry]) => entryContains(key, entry, story.source)
        );
        const dynamicEntries = matchingEntries.filter(
            ([, entry]) => entry.isDynamicEntry === true
        );

        if (dynamicEntries.length !== 1) {
            const matches = matchingEntries.length
                ? matchingEntries
                      .map(
                          ([key, entry]) =>
                              `  - ${describeEntry(manifest, key)}; isDynamicEntry=${String(entry.isDynamicEntry)}`
                      )
                      .join('\n')
                : '  - none';
            throw new Error(
                `Expected exactly one dynamic entry for ${story.source}, found ${dynamicEntries.length}.\nMatching manifest entries:\n${matches}`
            );
        }

        storyEntries.set(story, dynamicEntries[0][0]);
    }

    return storyEntries;
}

function findReaderEntry(
    manifest: Manifest,
    storyEntries: Map<StoryBoundary, string>
): string {
    const candidates = Object.entries(manifest)
        .filter(([key, entry]) =>
            entryContains(key, entry, 'pages/[locale]/reader.astro')
        )
        .map(([key]) => key);

    if (candidates.length === 0) {
        throw new Error(
            'Could not find the reader client entry containing pages/[locale]/reader.astro in the Vite manifest.'
        );
    }

    const viable = candidates.filter(candidate =>
        [...storyEntries.values()].every(storyKey =>
            findDynamicPath(manifest, candidate, storyKey)
        )
    );
    const entryCandidates = viable.filter(
        key => manifest[key]?.isEntry === true
    );
    const selected =
        entryCandidates.length === 1
            ? entryCandidates
            : viable.length === 1
              ? viable
              : [];

    if (selected.length !== 1) {
        const details = candidates
            .map(key => `  - ${describeEntry(manifest, key)}`)
            .join('\n');
        throw new Error(
            `Could not identify one reader entry with dynamic reachability to all stories.\nReader candidates:\n${details}`
        );
    }

    return selected[0];
}

function isEagerStoryModule(key: string, entry: ManifestEntry): boolean {
    return entryValues(key, entry).some(
        value =>
            value.includes('/src/stories/index.ts') ||
            (value.includes('/src/generated/') && value.includes('/dialogue.'))
    );
}

const manifestPath = findManifestPath();
const manifest = readManifest(manifestPath);
const storyEntries = findStoryEntries(manifest);
const readerEntry = findReaderEntry(manifest, storyEntries);

const eagerChain = findStaticViolation(
    manifest,
    readerEntry,
    isEagerStoryModule
);
if (eagerChain) {
    throw new Error(
        `Reader static graph eagerly reaches a story registry/generated dialogue module:\n${formatImportChain(manifest, eagerChain)}`
    );
}

for (const [story, storyKey] of storyEntries) {
    const dynamicPath = findDynamicPath(manifest, readerEntry, storyKey);
    if (!dynamicPath) {
        throw new Error(
            `${story.source} is not dynamically reachable from the reader async-registry graph.`
        );
    }

    const otherStories = stories.filter(candidate => candidate !== story);
    const crossStoryChain = findStaticViolation(
        manifest,
        storyKey,
        (key, entry) =>
            otherStories.some(
                other =>
                    entryContains(key, entry, other.source) ||
                    entryContains(key, entry, other.generatedDirectory)
            )
    );
    if (crossStoryChain) {
        throw new Error(
            `${story.source} statically reaches another story's source/generated modules:\n${formatImportChain(manifest, crossStoryChain)}`
        );
    }
}

const storyFiles = [...storyEntries].map(([story, key]) => ({
    source: story.source,
    file: manifest[key].file,
}));
if (new Set(storyFiles.map(story => story.file)).size !== stories.length) {
    throw new Error(
        `Stories do not have distinct emitted files:\n${storyFiles.map(story => `  ${story.source} -> ${story.file}`).join('\n')}`
    );
}

process.stdout.write('Story chunk boundaries verified:\n');
for (const story of storyFiles) {
    process.stdout.write(`  ${story.source} -> ${story.file}\n`);
}
