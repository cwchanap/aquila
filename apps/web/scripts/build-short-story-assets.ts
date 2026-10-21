import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
} from '@aquila/stories/runtime-assets';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAuthoringCatalog } from '../../../packages/infra-cloudflare/src/publisher/authoring-catalog';
import { BUNDLED_VISUAL_STORY_IDS } from '../../../packages/stories/src/story-metadata';
import sharp from 'sharp';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(webRoot, '../..');
const publicRoot = resolve(webRoot, 'public/assets');
const mediaRoot = resolve(repositoryRoot, 'packages/assets/media');
const publisherRoot = resolve(repositoryRoot, 'packages/infra-cloudflare');
// The publisher's local delivery store keeps `.publisher-metadata` and
// `.publisher-transactions` sidecars beside the delivered tree. Pointing it
// at public/ would ship those internals in the deployed site, so the store
// lives here and only the deliverable `vn/` tree is mirrored into
// public/assets after each publish.
const storeRoot = resolve(webRoot, '.asset-store');
const scriptPath = fileURLToPath(import.meta.url);
const stampPath = resolve(webRoot, '.short-story-assets.stamps.json');
const verifyOnly = process.argv.includes('--verify');
const ensureOnly = process.argv.includes('--ensure') && !verifyOnly;

// The `--ensure` freshness stamp maps each publish input to the SHA-256 of its
// bytes at the moment the publish started. Output mtimes cannot serve this
// role: a no-op republish leaves pointer/manifest/objects untouched, so they
// would look stale forever. Content hashes also stay correct across branch
// switches and identical-mtime rewrites that an mtime comparison would miss.
interface StoryStamp {
    inputs: Record<string, string>;
}
interface StampFile {
    version: 1;
    stories: Record<string, StoryStamp>;
}

async function sha256File(path: string): Promise<string> {
    return createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
}

function releasePlanPath(storyId: string): string {
    return resolve(
        repositoryRoot,
        'packages/stories/release-plans',
        `${storyId}.json`
    );
}

// Every publisher source file can change encoded output bytes, so all of
// src/publisher feeds the stamp — not just this script or the data files.
// The resolved sharp/package.json files carry the actually installed encoder
// versions for both this process and the spawned publisher.
async function publisherInputPaths(): Promise<string[]> {
    const entries = await readdir(join(publisherRoot, 'src/publisher'), {
        recursive: true,
    });
    const webRequire = createRequire(import.meta.url);
    const publisherRequire = createRequire(
        join(publisherRoot, 'package.json')
    );
    return [
        join(publisherRoot, 'package.json'),
        webRequire.resolve('sharp/package.json'),
        publisherRequire.resolve('sharp/package.json'),
        ...entries
            .filter(
                entry =>
                    entry.endsWith('.ts') &&
                    !entry.split(/[\\/]/).includes('__tests__')
            )
            .map(entry => join(publisherRoot, 'src/publisher', entry)),
    ];
}

// Hashes every file the story's published output derives from: the release
// plan, the generated image manifest (as the publisher's authoring catalog),
// the cover source, every included source image, this script (the cover
// transform lives here), and the publisher sources/encoder versions.
// Returns null when any input is unreadable; the subsequent publish then
// reports the real error (missing source, bad manifest) instead of a generic
// freshness failure.
async function storyInputHashes(
    storyId: string
): Promise<Record<string, string> | null> {
    try {
        const planPath = releasePlanPath(storyId);
        const plan = parseStoryAssetReleasePlan(
            JSON.parse(await readFile(planPath, 'utf8'))
        );
        const catalog = await discoverAuthoringCatalog(
            repositoryRoot,
            storyId
        );
        const paths = [
            planPath,
            resolve(mediaRoot, storyId, 'covers/cover.png'),
            scriptPath,
            ...plan.entries
                .filter(entry => entry.disposition === 'included')
                .map(entry => resolve(mediaRoot, entry.sourcePath)),
            ...(await publisherInputPaths()),
        ];
        const entries = await Promise.all(
            paths.map(
                async path =>
                    [
                        relative(repositoryRoot, path),
                        await sha256File(path),
                    ] as const
            )
        );
        return {
            'derived:authoring-catalog': createHash('sha256')
                .update(JSON.stringify(catalog))
                .digest('hex'),
            ...Object.fromEntries(entries),
        };
    } catch {
        return null;
    }
}

async function readBundledPointer(root: string, storyId: string) {
    return parseActiveReleasePointer(
        JSON.parse(
            await readFile(
                resolve(root, 'vn/stories', storyId, 'current.json'),
                'utf8'
            )
        ),
        { kind: 'production' },
        storyId
    );
}

// True when the release the dev server will actually serve is on disk: a
// pointer that parses, the manifest it names, every object that manifest
// references, and the cover. A torn output (e.g. objects deleted while the
// pointer survived) republishes; the publisher recreates only the missing
// objects since everything is content-addressed.
async function bundledOutputsExist(storyId: string): Promise<boolean> {
    try {
        const pointer = await readBundledPointer(publicRoot, storyId);
        const manifest = parseRuntimeAssetManifest(
            JSON.parse(
                await readFile(
                    resolve(publicRoot, pointer.manifestPath),
                    'utf8'
                )
            )
        );
        const paths = manifest.assets.flatMap(asset => [
            asset.variants.webp.path,
            ...(asset.variants.avif === undefined
                ? []
                : [asset.variants.avif.path]),
            ...(asset.placeholder === undefined
                ? []
                : [asset.placeholder.path]),
        ]);
        paths.push(`covers/${storyId}.webp`);
        await Promise.all(paths.map(path => stat(resolve(publicRoot, path))));
        return true;
    } catch {
        return false;
    }
}

async function loadStamps(): Promise<StampFile> {
    try {
        const parsed = JSON.parse(await readFile(stampPath, 'utf8')) as {
            version?: unknown;
            stories?: unknown;
        };
        if (
            parsed.version === 1 &&
            typeof parsed.stories === 'object' &&
            parsed.stories !== null
        ) {
            return parsed as StampFile;
        }
    } catch {
        // Missing or unreadable stamp file: every story republishes once and
        // the stamp is rewritten below.
    }
    return { version: 1, stories: {} };
}

async function writeStamps(stamps: StampFile): Promise<void> {
    await writeFile(stampPath, `${JSON.stringify(stamps, null, 2)}\n`, 'utf8');
}

function inputsMatch(
    stamped: Record<string, string> | undefined,
    current: Record<string, string>
): boolean {
    if (stamped === undefined) return false;
    const keys = Object.keys(current);
    return (
        keys.length === Object.keys(stamped).length &&
        keys.every(key => stamped[key] === current[key])
    );
}

// Use the existing publisher for canonical manifests, coverage, encoding,
// integrity, and activation. These writes are confined to the app's local
// store; this script never publishes to R2 or activates a remote release.
await mkdir(storeRoot, { recursive: true });
if (!verifyOnly) {
    console.log('Checking bundled short-story assets…');
}
const stamps = await loadStamps();
for (const storyId of BUNDLED_VISUAL_STORY_IDS) {
    // Hash once, before publishing: the output derives from the bytes read at
    // publish start, so the stamp must record those — not whatever the inputs
    // became by the time the minutes-long encode finished.
    const inputs = verifyOnly ? null : await storyInputHashes(storyId);
    if (
        ensureOnly &&
        inputs !== null &&
        inputsMatch(stamps.stories[storyId]?.inputs, inputs) &&
        (await bundledOutputsExist(storyId))
    ) {
        console.log(`${storyId}: bundled assets up to date; skipped`);
        continue;
    }
    if (!verifyOnly) {
        console.log(`${storyId}: publishing bundled assets…`);
    }
    const pointer = verifyOnly
        ? await readBundledPointer(storeRoot, storyId)
        : null;
    const args = pointer
        ? [
              'verify',
              '--deep',
              '--release',
              pointer.releaseId,
              '--expect-manifest-sha256',
              pointer.manifestSha256,
          ]
        : [
              'publish',
              '--plan',
              releasePlanPath(storyId),
              '--source-root',
              mediaRoot,
              '--confirm-production',
              storyId,
          ];
    const child = Bun.spawn(
        [
            process.execPath,
            resolve(publisherRoot, 'src/publisher/cli.ts'),
            ...args,
            '--story',
            storyId,
            '--environment',
            'production',
            '--destination',
            'local',
            '--destination-root',
            storeRoot,
            '--json',
        ],
        { cwd: repositoryRoot, stdout: 'pipe', stderr: 'pipe' }
    );
    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ]);
    if (exitCode !== 0) {
        throw new Error(
            `${storyId}: asset publisher exited ${exitCode}\n${stderr}\n${stdout}`
        );
    }
    const report = JSON.parse(stdout) as { status: string };
    if (!verifyOnly) {
        // Mirror the deliverable tree into public/ — the store root also
        // holds the `.publisher-*` sidecars that must never ship.
        await cp(join(storeRoot, 'vn'), join(publicRoot, 'vn'), {
            recursive: true,
        });
        if (!(await bundledOutputsExist(storyId))) {
            throw new Error(
                `${storyId}: published release missing from public/assets`
            );
        }
    }
    const coverPath = resolve(publicRoot, 'covers', `${storyId}.webp`);
    if (!verifyOnly) {
        await mkdir(dirname(coverPath), { recursive: true });
        await sharp(resolve(mediaRoot, storyId, 'covers/cover.png'))
            // Crop to the card's 2:3 box centred on the salient region —
            // `inside` would only ever emit 480x720 for sources that are
            // already exactly 2:3 and large enough, failing the whole build
            // on any other aspect.
            .resize({
                width: 480,
                height: 720,
                fit: 'cover',
                position: 'attention',
            })
            .webp({ quality: 85, effort: 6 })
            .toFile(coverPath);
    }
    const cover = await sharp(coverPath).metadata();
    if (
        cover.format !== 'webp' ||
        cover.width !== 480 ||
        cover.height !== 720
    ) {
        throw new Error(`Invalid cover dimensions or format: ${storyId}`);
    }
    if (!verifyOnly && inputs !== null) {
        stamps.stories[storyId] = { inputs };
        // Persist per story: a later story's failure must not discard the
        // stamps of stories already published.
        await writeStamps(stamps);
    }
    console.log(`${storyId}: ${report.status}; cover verified`);
}
