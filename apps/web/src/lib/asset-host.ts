/**
 * Absolute URL of a file on the R2 asset host (`PUBLIC_ASSET_BASE_URL`), or
 * undefined when no host is configured, as in a bare local checkout.
 *
 * Generated media (covers, voice) is never bundled with the app, so callers
 * treat undefined as "media unavailable" and degrade quietly.
 */
export function assetHostUrl(
    path: string,
    // Static `import.meta.env.PUBLIC_X` is the only form Vite inlines into the
    // client bundle; see source-factory.ts.
    baseUrl: string | undefined = import.meta.env.PUBLIC_ASSET_BASE_URL
): string | undefined {
    const base = baseUrl?.trim();
    if (!base) return undefined;
    try {
        return new URL(path, base).href;
    } catch {
        // A malformed host degrades to "media unavailable", not a crash.
        return undefined;
    }
}
