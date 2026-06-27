import { createAuthClient } from 'better-auth/client';

const getBaseURL = (): string => {
    // In the browser, always call our own origin so auth requests stay
    // same-origin on any deployment (production, Vercel preview, local).
    // This avoids cross-origin/CORS failures and removes the need to bake a
    // fixed PUBLIC_AUTH_URL into the client bundle at build time.
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    // Non-browser (SSR / build) fallback — the client itself only issues
    // requests from the browser, so this is rarely exercised.
    return import.meta.env.PUBLIC_AUTH_URL || 'http://localhost:5090';
};

export const authClient = createAuthClient({
    baseURL: getBaseURL(),
});

export const { signIn, signOut, useSession } = authClient;
