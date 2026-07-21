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

type ChunkModuleMetadata = {
    schemaVersion: 1;
    chunks: Record<string, string[]>;
};

type ImportKind = 'static' | 'dynamic';

type ImportStep = {
    key: string;
    kind?: ImportKind;
};

type StaticViolation = {
    chain: ImportStep[];
    offendingValue: string;
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

function readChunkModuleMetadata(manifestPath: string): ChunkModuleMetadata {
    const metadataPath = path.join(
        path.dirname(manifestPath),
        'story-chunk-modules.json'
    );
    if (!existsSync(metadataPath)) {
        throw new Error(
            `Missing story chunk module metadata. Expected ${metadataPath}. Re-run the web production build.`
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(readFileSync(metadataPath, 'utf8'));
    } catch (error) {
        throw new Error(
            `Malformed story chunk module metadata at ${metadataPath}: ${error instanceof Error ? error.message : String(error)}`
        );
    }

    if (
        !parsed ||
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        !('schemaVersion' in parsed) ||
        parsed.schemaVersion !== 1 ||
        !('chunks' in parsed) ||
        !parsed.chunks ||
        typeof parsed.chunks !== 'object' ||
        Array.isArray(parsed.chunks)
    ) {
        throw new Error(
            `Malformed story chunk module metadata at ${metadataPath}: expected { schemaVersion: 1, chunks: Record<string, string[]> }.`
        );
    }

    for (const [file, modules] of Object.entries(parsed.chunks)) {
        if (
            !Array.isArray(modules) ||
            modules.some(moduleId => typeof moduleId !== 'string')
        ) {
            throw new Error(
                `Malformed story chunk module metadata at ${metadataPath}: ${file} must map to an array of module IDs.`
            );
        }
    }

    return parsed as ChunkModuleMetadata;
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

function moduleIdsForEntry(
    metadata: ChunkModuleMetadata,
    entry: ManifestEntry,
    manifest: Manifest,
    chain: ImportStep[]
): string[] {
    if (!entry.file.endsWith('.js')) {
        return [];
    }

    const modules = metadata.chunks[normalize(entry.file)];
    if (!modules) {
        throw new Error(
            `Missing chunk module metadata for ${entry.file} while traversing:\n${formatImportChain(manifest, chain)}`
        );
    }

    return modules.map(normalize);
}

function findStaticViolation(
    manifest: Manifest,
    metadata: ChunkModuleMetadata,
    startKey: string,
    violates: (value: string) => boolean
): StaticViolation | undefined {
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
        const offendingValue = [
            ...entryValues(key, entry),
            ...moduleIdsForEntry(metadata, entry, manifest, chain),
        ].find(violates);
        if (offendingValue) {
            return { chain, offendingValue };
        }

        for (const importedKey of entry.imports ?? []) {
            queue.push([...chain, { key: importedKey, kind: 'static' }]);
        }
    }

    return undefined;
}

function findStaticPath(
    manifest: Manifest,
    startKey: string,
    targetKey: string
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
        if (key === targetKey) {
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

        if (matchingEntries.length !== 1) {
            const matches = matchingEntries.length
                ? matchingEntries
                      .map(
                          ([key, entry]) =>
                              `  - ${describeEntry(manifest, key)}; isDynamicEntry=${String(entry.isDynamicEntry)}`
                      )
                      .join('\n')
                : '  - none';
            throw new Error(
                `Expected exactly one manifest entry for ${story.source}, found ${matchingEntries.length}.\nMatching manifest entries:\n${matches}`
            );
        }

        storyEntries.set(story, matchingEntries[0][0]);
    }

    return storyEntries;
}

function findReaderEntry(manifest: Manifest): string {
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

    const entryCandidates = candidates.filter(
        key => manifest[key]?.isEntry === true
    );
    const selected =
        entryCandidates.length === 1
            ? entryCandidates
            : candidates.length === 1
              ? candidates
              : [];

    if (selected.length !== 1) {
        const details = candidates
            .map(key => `  - ${describeEntry(manifest, key)}`)
            .join('\n');
        throw new Error(
            `Could not identify one reader client entry.\nReader candidates:\n${details}`
        );
    }

    return selected[0];
}

function isEagerStoryModule(value: string): boolean {
    return (
        value.includes('/src/stories/index.ts') ||
        (value.includes('/src/generated/') && value.includes('/dialogue.'))
    );
}

const manifestPath = findManifestPath();
const manifest = readManifest(manifestPath);
const metadata = readChunkModuleMetadata(manifestPath);
const readerEntry = findReaderEntry(manifest);

const eagerViolation = findStaticViolation(
    manifest,
    metadata,
    readerEntry,
    isEagerStoryModule
);
if (eagerViolation) {
    throw new Error(
        `Reader static graph eagerly reaches a story registry/generated dialogue module.\nOffending module or entry: ${eagerViolation.offendingValue}\n${formatImportChain(manifest, eagerViolation.chain)}`
    );
}

const storyEntries = findStoryEntries(manifest);
for (const [story, storyKey] of storyEntries) {
    const staticPath = findStaticPath(manifest, readerEntry, storyKey);
    if (staticPath) {
        throw new Error(
            `${story.source} is statically reachable from the reader instead of lazy-loaded:\n${formatImportChain(manifest, staticPath)}`
        );
    }

    const dynamicPath = findDynamicPath(manifest, readerEntry, storyKey);
    if (manifest[storyKey].isDynamicEntry !== true) {
        const pathDetail = dynamicPath
            ? `\nObserved import chain:\n${formatImportChain(manifest, dynamicPath)}`
            : '';
        throw new Error(
            `${story.source} is not marked as a dynamic entry.${pathDetail}`
        );
    }
    if (!dynamicPath) {
        throw new Error(
            `${story.source} is not dynamically reachable from the reader async-registry graph.`
        );
    }

    const otherStories = stories.filter(candidate => candidate !== story);
    const crossStoryViolation = findStaticViolation(
        manifest,
        metadata,
        storyKey,
        value =>
            otherStories.some(
                other =>
                    value.includes(other.source) ||
                    value.includes(other.generatedDirectory)
            )
    );
    if (crossStoryViolation) {
        throw new Error(
            `${story.source} statically reaches another story's source/generated modules.\nOffending module or entry: ${crossStoryViolation.offendingValue}\n${formatImportChain(manifest, crossStoryViolation.chain)}`
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
