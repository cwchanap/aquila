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

const enAstroFiles = findAstroFiles(enPagesDir);

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
