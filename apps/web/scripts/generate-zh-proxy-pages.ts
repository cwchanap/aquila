import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.resolve(__dirname, '../src/pages');
const enPagesDir = path.resolve(pagesDir, 'en');
const zhPagesDir = path.resolve(pagesDir, 'zh');

if (!fs.existsSync(zhPagesDir)) {
    fs.mkdirSync(zhPagesDir, { recursive: true });
}

const findAstroFiles = (dir: string, baseDir = ''): string[] => {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(baseDir, entry.name);

        if (entry.isDirectory()) {
            files.push(...findAstroFiles(fullPath, relativePath));
        } else if (entry.name.endsWith('.astro')) {
            files.push(relativePath);
        }
    }

    return files;
};

/**
 * Remove stale zh proxy files that no longer have corresponding en files.
 * This prevents build errors when en pages are deleted but their proxies remain.
 */
const cleanupStaleProxies = (
    zhDir: string,
    validFiles: Set<string>,
    basePath: string = zhDir
): number => {
    let removedCount = 0;
    const entries = fs.readdirSync(zhDir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(zhDir, entry.name);

        if (entry.isDirectory()) {
            // Recursively clean subdirectories, passing the base path to calculate relative paths correctly
            const subdirRemovedCount = cleanupStaleProxies(
                fullPath,
                validFiles,
                basePath
            );
            removedCount += subdirRemovedCount;

            // Remove empty directories after cleaning their contents
            if (fs.existsSync(fullPath)) {
                const remainingEntries = fs.readdirSync(fullPath);
                if (remainingEntries.length === 0) {
                    fs.rmSync(fullPath, { recursive: true });
                    removedCount++;
                }
            }
        } else if (entry.name.endsWith('.astro')) {
            // Get relative path from the base path (root zh directory)
            const relativePath = path.relative(basePath, fullPath);
            const normalizedPath = relativePath.replace(/\\/g, '/');

            // Check if this file has a corresponding en page
            if (!validFiles.has(normalizedPath)) {
                fs.unlinkSync(fullPath);
                removedCount++;
                console.log(`  Removed stale proxy: ${normalizedPath}`);
            }
        }
    }

    return removedCount;
};

const enAstroFiles = findAstroFiles(enPagesDir);

// Create a Set of valid en files for quick lookup
const validEnFiles = new Set(enAstroFiles.map(f => f.replace(/\\/g, '/')));

// Clean up stale proxies before generating new ones
console.log('Cleaning up stale zh proxies...');
const removedCount = cleanupStaleProxies(zhPagesDir, validEnFiles);
if (removedCount > 0) {
    console.log(`Removed ${removedCount} stale proxy file(s)`);
} else {
    console.log('No stale proxies found');
}

for (const filePath of enAstroFiles) {
    const zhFilePath = path.join(zhPagesDir, filePath);
    const enFilePath = path.join(enPagesDir, filePath);

    const zhDir = path.dirname(zhFilePath);
    if (!fs.existsSync(zhDir)) {
        fs.mkdirSync(zhDir, { recursive: true });
    }

    // Calculate relative path from zh file to en file
    const relativePath = path.relative(zhDir, enFilePath);

    const proxyContent = `---
import EnPage from '${relativePath}';
---
<EnPage {...Astro.props} />
`;

    fs.writeFileSync(zhFilePath, proxyContent);
}

console.log(`Created ${enAstroFiles.length} proxy pages for zh`);
