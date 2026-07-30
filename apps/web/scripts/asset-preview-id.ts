import { createHash } from 'node:crypto';

/**
 * Vercel branch names routinely violate isPreviewId(): `HPA-229` has
 * uppercase, `feature/Foo_Bar` has a slash, and branches can exceed 63
 * characters. Derive a valid id deterministically so the same branch always
 * maps to the same preview namespace.
 */
export function derivePreviewId(ref: string): string {
    const slug = ref
        .normalize('NFC')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 63)
        .replace(/[-_]+$/g, '');

    if (slug.length > 0) return slug;
    return `preview-${createHash('sha256').update(ref).digest('hex').slice(0, 8)}`;
}

if (import.meta.main) {
    // Production must never receive a preview id — that combination throws in
    // resolveAssetSource, so print nothing outside a preview build.
    if (process.env.VERCEL_ENV !== 'preview') {
        process.stdout.write('');
    } else {
        process.stdout.write(
            derivePreviewId(process.env.VERCEL_GIT_COMMIT_REF ?? '')
        );
    }
}
