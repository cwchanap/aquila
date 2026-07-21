import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const assetDir = path.resolve(import.meta.dir, '../dist/client/_astro');
const names = (await readdir(assetDir))
    .filter(name => name.endsWith('.js'))
    .sort();
const files = await Promise.all(
    names.map(async name => {
        const bytes = await readFile(path.join(assetDir, name));
        return {
            name,
            rawBytes: bytes.byteLength,
            gzipBytes: gzipSync(bytes).byteLength,
        };
    })
);
const totals = files.reduce(
    (sum, file) => ({
        rawBytes: sum.rawBytes + file.rawBytes,
        gzipBytes: sum.gzipBytes + file.gzipBytes,
    }),
    { rawBytes: 0, gzipBytes: 0 }
);
process.stdout.write(`${JSON.stringify({ files, totals }, null, 2)}\n`);
