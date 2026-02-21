import { createAuthClient } from 'better-auth/client';

const getBaseURL = (): string => {
    const url = import.meta.env.PUBLIC_AUTH_URL;
    if (!url) {
        if (import.meta.env.PROD) {
            throw new Error(
                'PUBLIC_AUTH_URL must be set in production environment'
            );
        }
        return 'http://localhost:5090';
    }
    return url;
};

export const authClient = createAuthClient({
    baseURL: getBaseURL(),
});

export const { signIn, signUp, signOut, useSession } = authClient;
