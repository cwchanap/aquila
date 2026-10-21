import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Content-addressed objects and release manifests never change under a given
// path — the bytes are named by their hashes. The Vercel adapter only marks
// `/_astro/*` immutable, so this patches the generated routes to give the
// bundled VN store the same treatment. `continue: true` mirrors the
// adapter's own pattern: headers attach, then filesystem serving proceeds.
const IMMUTABLE_ROUTES = [
    '^/assets/vn/objects/.*$',
    '^/assets/vn/(?:stories|previews)/.*/releases/.*$',
].map(src => ({
    src,
    headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    continue: true,
}));

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(webRoot, '.vercel/output/config.json');

let config: { routes?: unknown[] };
try {
    config = JSON.parse(await readFile(configPath, 'utf8')) as {
        routes?: unknown[];
    };
} catch (error) {
    if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
    ) {
        console.log(
            '.vercel/output/config.json not found; skipping asset cache headers'
        );
        process.exit(0);
    }
    throw error;
}
config.routes = [...IMMUTABLE_ROUTES, ...(config.routes ?? [])];
await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(
    'Patched .vercel/output/config.json with immutable VN asset routes'
);
