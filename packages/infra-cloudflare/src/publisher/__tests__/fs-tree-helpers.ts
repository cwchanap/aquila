import { chmod, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Read every file under `root` into a base64-encoded map keyed by relative
 * path, with directory entries sorted deterministically. Used by
 * LocalDeliveryStore / publish tests to snapshot a destination tree before
 * and after an operation.
 */
export async function snapshotTree(
    root: string,
    relative = ''
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const entries = await readdir(join(root, relative), {
        withFileTypes: true,
    });
    for (const entry of entries.sort((left, right) =>
        left.name.localeCompare(right.name)
    )) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) {
            Object.assign(result, await snapshotTree(root, path));
        } else {
            result[path] = Buffer.from(
                await readFile(join(root, path))
            ).toString('base64');
        }
    }
    return result;
}

/**
 * Recursively apply `dirMode` to every directory and `fileMode` to every file
 * under `root`. Used by LocalDeliveryStore / publish tests to make a
 * destination tree read-only (and restore it) so any write attempt fails
 * with EACCES.
 */
export async function chmodTree(
    root: string,
    dirMode: number,
    fileMode: number,
    relative = ''
): Promise<void> {
    const entries = await readdir(join(root, relative), {
        withFileTypes: true,
    });
    for (const entry of entries) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) {
            await chmodTree(root, dirMode, fileMode, path);
        } else {
            await chmod(join(root, path), fileMode);
        }
    }
    await chmod(join(root, relative), dirMode);
}
