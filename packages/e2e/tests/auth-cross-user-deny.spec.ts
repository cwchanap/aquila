import { test, expect } from '@playwright/test';

test.describe('Supabase Auth - Cross-User Access Denial (US3)', () => {
    // We assume these endpoints exist and should be protected.
    // If they don't exist, this test might need adjustment, but the principle is
    // that no sensitive user data should be exposed without auth.

    test('Unauthenticated user cannot access /api/me', async ({ request }) => {
        const response = await request.get('/api/me');
        // Should be 401 Unauthorized or 403 Forbidden

        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot list bookmarks via /api/bookmarks', async ({
        request,
    }) => {
        const response = await request.get('/api/bookmarks');
        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot create bookmarks via POST /api/bookmarks', async ({
        request,
    }) => {
        const response = await request.post('/api/bookmarks', {
            data: {
                storyId: 'trainAdventure',
                sceneId: 'scene-1',
                bookmarkName: 'unauthorized',
                locale: 'en',
            },
        });

        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot delete bookmarks via DELETE /api/bookmarks/:id', async ({
        request,
    }) => {
        const response = await request.delete('/api/bookmarks/some-id');

        expect([401, 403]).toContain(response.status());
    });
});
