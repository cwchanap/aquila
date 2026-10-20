import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    DEFAULT_LOCALE,
    SUPPORTED_LOCALES,
} from '@aquila/stories/translations';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pagesDir = path.resolve(__dirname, '../src/pages');
const localePagesDir = path.resolve(pagesDir, '[locale]');

// Every locale except the default gets a generated proxy tree
// (src/pages/zh/, src/pages/ja/), each page rendering its [locale] original.
const proxyLocales = SUPPORTED_LOCALES.filter(
    locale => locale !== DEFAULT_LOCALE
);

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
 * Remove stale proxy files that no longer have corresponding locale files.
 * This prevents build errors when locale pages are deleted but their proxies remain.
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
            // Get relative path from the base path (root proxy directory)
            const relativePath = path.relative(basePath, fullPath);
            const normalizedPath = relativePath.replace(/\\/g, '/');

            // Check if this file has a corresponding locale page
            if (!validFiles.has(normalizedPath)) {
                fs.unlinkSync(fullPath);
                removedCount++;
                console.log(`  Removed stale proxy: ${normalizedPath}`);
            }
        }
    }

    return removedCount;
};

if (!fs.existsSync(localePagesDir)) {
    throw new Error(
        `Missing src/pages/[locale] directory: check i18n/CI setup. Expected: ${localePagesDir}`
    );
}

const localeAstroFiles = findAstroFiles(localePagesDir);

// Create a Set of valid locale files for quick lookup
const validLocaleFiles = new Set(
    localeAstroFiles.map(f => f.replace(/\\/g, '/'))
);

for (const proxyLocale of proxyLocales) {
    const proxyPagesDir = path.resolve(pagesDir, proxyLocale);

    if (!fs.existsSync(proxyPagesDir)) {
        fs.mkdirSync(proxyPagesDir, { recursive: true });
    }

    // Clean up stale proxies before generating new ones
    console.log(`Cleaning up stale ${proxyLocale} proxies...`);
    const removedCount = cleanupStaleProxies(proxyPagesDir, validLocaleFiles);
    if (removedCount > 0) {
        console.log(`Removed ${removedCount} stale proxy file(s)`);
    } else {
        console.log('No stale proxies found');
    }

    for (const filePath of localeAstroFiles) {
        const proxyFilePath = path.join(proxyPagesDir, filePath);
        const localeFilePath = path.join(localePagesDir, filePath);

        const proxyDir = path.dirname(proxyFilePath);
        if (!fs.existsSync(proxyDir)) {
            fs.mkdirSync(proxyDir, { recursive: true });
        }

        // Calculate relative path from the proxy file to the locale file
        // Normalize to forward slashes for cross-platform import compatibility
        const relativePath = path
            .relative(proxyDir, localeFilePath)
            .replace(/\\/g, '/');

        const proxyContent = `---
import LocalePage from '${relativePath}';
---
<LocalePage {...Astro.props} locale="${proxyLocale}" />
`;

        fs.writeFileSync(proxyFilePath, proxyContent);
    }

    console.log(
        `Created ${localeAstroFiles.length} proxy pages for ${proxyLocale}`
    );
}
