/**
 * Get the authenticated user from the request headers (for Astro page frontmatter).
 * Returns the user object or null if not authenticated.
 */
export async function getSessionUser(request: Request) {
    try {
        const { auth } = await import('./auth.js');
        const session = await auth.api.getSession({
            headers: request.headers,
        });
        return session?.user ?? null;
    } catch {
        return null;
    }
}
