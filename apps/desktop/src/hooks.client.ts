import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, status }) => {
    // Log errors for debugging but don't auto-redirect to avoid loops
    console.error(`Error ${status}:`, error);

    return {
        message: 'An error occurred',
    };
};
