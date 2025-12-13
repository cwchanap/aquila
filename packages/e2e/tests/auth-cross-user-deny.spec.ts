import { test, expect } from '@playwright/test';

test.describe('Supabase Auth - Cross-User Access Denial (US3)', () => {
    // We assume these endpoints exist and should be protected.
    // If they don't exist, this test might need adjustment, but the principle is
    // that no sensitive user data should be exposed without auth.

    test('Unauthenticated user cannot list users via /api/users', async ({
        request,
    }) => {
        const response = await request.get('/api/users');
        // Should be 401 Unauthorized or 403 Forbidden

        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot get user details via /api/users?id=...', async ({
        request,
    }) => {
        // Try to fetch a likely ID (or random one)
        const response = await request.get('/api/users?id=some-uuid');

        // If the API returns 404 because "User not found", it means it PROCESSED the request.
        // We want it to reject BEFORE processing, so let's check for 401/403.
        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot update user via PUT /api/users', async ({
        request,
    }) => {
        const response = await request.put('/api/users', {
            data: { id: 'some-id', username: 'hacked' },
        });

        expect([401, 403]).toContain(response.status());
    });

    test('Unauthenticated user cannot delete user via DELETE /api/users', async ({
        request,
    }) => {
        const response = await request.delete('/api/users?id=some-id');

        expect([401, 403]).toContain(response.status());
    });
});
