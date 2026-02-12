import { createAuthClient } from 'better-auth/client';

export const authClient = createAuthClient({
    baseURL: import.meta.env.PUBLIC_AUTH_URL || 'http://localhost:5090',
});

export const { signIn, signUp, signOut, useSession } = authClient;
