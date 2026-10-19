import { mkdir, readFile } from 'node:fs/promises';
import { parseActiveReleasePointer } from '@aquila/stories/runtime-assets';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUNDLED_VISUAL_STORY_IDS } from '../../../packages/stories/src/story-metadata';
import sharp from 'sharp';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(webRoot, '../..');
const publicRoot = resolve(webRoot, 'public/assets');
const verifyOnly = process.argv.includes('--verify');

// Use the existing publisher for canonical manifests, coverage, encoding,
// integrity, and activation. These writes are confined to the app's public tree;
// this script never publishes to R2 or activates a remote release.
for (const storyId of BUNDLED_VISUAL_STORY_IDS) {
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
    console.log(`${storyId}: ${report.status}; cover verified`);
}
