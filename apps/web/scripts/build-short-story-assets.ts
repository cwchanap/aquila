import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import {
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
} from '@aquila/stories/runtime-assets';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLED_VISUAL_STORY_IDS } from '../../../packages/stories/src/story-metadata';
import sharp from 'sharp';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(webRoot, '../..');
const publicRoot = resolve(webRoot, 'public/assets');
const mediaRoot = resolve(repositoryRoot, 'packages/assets/media');
const generatedRoot = resolve(repositoryRoot, 'packages/stories/src/generated');
const scriptPath = fileURLToPath(import.meta.url);
const stampPath = resolve(webRoot, '.short-story-assets.stamps.json');
const verifyOnly = process.argv.includes('--verify');
const ensureOnly = process.argv.includes('--ensure') && !verifyOnly;

// The `--ensure` freshness stamp maps each publish input to the SHA-256 of its
// bytes at the last completed publish. Output mtimes cannot serve this role:
// a no-op republish leaves pointer/manifest/objects untouched, so they would
// look stale forever. Content hashes also stay correct across branch switches
// and identical-mtime rewrites that an mtime comparison would miss.
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

// The generated directory is named after the raw story folder (camelCase),
// not the snake_case story id, so the matching image-assets manifest is found
// by its embedded storyId — the same rule discoverAuthoringCatalog uses.
async function findImageAssetsPath(storyId: string): Promise<string | null> {
    const dirs = await readdir(generatedRoot, { withFileTypes: true });
    for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const candidate = join(generatedRoot, dir.name, 'image-assets.json');
        try {
            const parsed = JSON.parse(await readFile(candidate, 'utf8')) as {
                storyId?: unknown;
            };
            if (parsed.storyId === storyId) return candidate;
        } catch {
            continue;
        }
    }
    return null;
}

// Hashes every file the story's published output derives from: the release
// plan, its generated image-assets manifest, the cover source, every included
// source image, and this script itself (the cover transform lives here).
// Returns null when any input is unreadable; the subsequent publish then
// reports the real error (missing source, bad manifest) instead of a generic
// freshness failure.
async function storyInputHashes(
    storyId: string
): Promise<Record<string, string> | null> {
    try {
        const planPath = resolve(
            repositoryRoot,
            'packages/stories/release-plans',
            `${storyId}.json`
        );
        const plan = parseStoryAssetReleasePlan(
            JSON.parse(await readFile(planPath, 'utf8'))
        );
        const imageAssetsPath = await findImageAssetsPath(storyId);
        if (imageAssetsPath === null) return null;
        const paths = [
            planPath,
            imageAssetsPath,
            resolve(mediaRoot, storyId, 'covers/cover.png'),
            scriptPath,
            ...plan.entries
                .filter(entry => entry.disposition === 'included')
                .map(entry => resolve(mediaRoot, entry.sourcePath)),
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
        return Object.fromEntries(entries);
    } catch {
        return null;
    }
}

// True when the release the dev server will actually serve is on disk: a
// pointer that parses, the manifest it names, every object that manifest
// references, and the cover. A torn output (e.g. objects deleted while the
// pointer survived) republishes; the publisher recreates only the missing
// objects since everything is content-addressed.
async function bundledOutputsExist(storyId: string): Promise<boolean> {
    try {
        const pointer = parseActiveReleasePointer(
            JSON.parse(
                await readFile(
                    resolve(publicRoot, 'vn/stories', storyId, 'current.json'),
                    'utf8'
                )
            ),
            { kind: 'production' },
            storyId
        );
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
// integrity, and activation. These writes are confined to the app's public tree;
// this script never publishes to R2 or activates a remote release.
const stamps = await loadStamps();
let stampsDirty = false;
for (const storyId of BUNDLED_VISUAL_STORY_IDS) {
    if (ensureOnly) {
        const inputs = await storyInputHashes(storyId);
        if (
            inputs !== null &&
            inputsMatch(stamps.stories[storyId]?.inputs, inputs) &&
            (await bundledOutputsExist(storyId))
        ) {
            console.log(`${storyId}: bundled assets up to date; skipped`);
            continue;
        }
    }
    const pointer = verifyOnly
        ? parseActiveReleasePointer(
              JSON.parse(
                  await readFile(
                      resolve(
                          publicRoot,
                          'vn/stories',
                          storyId,
                          'current.json'
                      ),
                      'utf8'
                  )
              ),
              { kind: 'production' },
              storyId
          )
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
              resolve(
                  repositoryRoot,
                  'packages/stories/release-plans',
                  `${storyId}.json`
              ),
              '--source-root',
              resolve(repositoryRoot, 'packages/assets/media'),
              '--confirm-production',
              storyId,
          ];
    const child = Bun.spawn(
        [
            process.execPath,
            resolve(
                repositoryRoot,
                'packages/infra-cloudflare/src/publisher/cli.ts'
            ),
            ...args,
            '--story',
            storyId,
            '--environment',
            'production',
            '--destination',
            'local',
            '--destination-root',
            publicRoot,
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
    const coverPath = resolve(publicRoot, 'covers', `${storyId}.webp`);
    if (!verifyOnly) {
        await mkdir(dirname(coverPath), { recursive: true });
        await sharp(
            resolve(
                repositoryRoot,
                'packages/assets/media',
                storyId,
                'covers/cover.png'
            )
        )
            .resize({
                width: 480,
                height: 720,
                fit: 'inside',
                withoutEnlargement: true,
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
    if (!verifyOnly) {
        const inputs = await storyInputHashes(storyId);
        if (inputs !== null) {
            stamps.stories[storyId] = { inputs };
            stampsDirty = true;
        }
    }
    console.log(`${storyId}: ${report.status}; cover verified`);
}
if (stampsDirty) {
    await writeFile(stampPath, `${JSON.stringify(stamps, null, 2)}\n`, 'utf8');
}
