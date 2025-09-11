import { test, expect } from '@playwright/test';

test.describe('Change Password API Tests', () => {
    let testUserEmail: string;
    let testUserPassword: string;
    let sessionCookie: string;

    test.beforeEach(async ({ page }) => {
        // Create a unique test user for each test
        testUserEmail = `apiuser${Date.now()}@example.com`;
        testUserPassword = 'password123';

        // Sign up the test user
        await page.goto('/login');
        await page.fill('input[name="email"]', testUserEmail);
        await page.fill('input[name="password"]', testUserPassword);
        await page.fill('input[name="name"]', 'API Test User');
        await page.click('button#signup-btn');

        // Wait for redirect to home page
        await expect(page).toHaveURL('/');

        // Get the session cookie
        const cookies = await page.context().cookies();
        const session = cookies.find(cookie => cookie.name === 'session');
        expect(session).toBeTruthy();
        sessionCookie = session!.value;
    });

    test('API should accept valid password change request', async ({
        page,
    }) => {
        // Make API request to change password
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: `session=${sessionCookie}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: testUserPassword,
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                },
            }
        );

        // Should return success
        expect(response.status()).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.message).toBe('Password updated successfully');
    });

    test('API should reject invalid current password', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: `session=${sessionCookie}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: 'wrongpassword',
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                },
            }
        );

        expect(response.status()).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('Current password is incorrect');
    });

    test('API should reject mismatched passwords', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: `session=${sessionCookie}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: testUserPassword,
                    newPassword: 'newpassword456',
                    confirmPassword: 'differentpassword',
                },
            }
        );

        expect(response.status()).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('New passwords do not match');
    });

    test('API should reject short passwords', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: `session=${sessionCookie}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: testUserPassword,
                    newPassword: '123',
                    confirmPassword: '123',
                },
            }
        );

        expect(response.status()).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('New password must be at least 6 characters');
    });

    test('API should reject missing fields', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: `session=${sessionCookie}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    // Missing all fields
                },
            }
        );

        expect(response.status()).toBe(400);
        const result = await response.json();
        expect(result.error).toBe('All fields are required');
    });

    test('API should reject unauthenticated requests', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: testUserPassword,
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                },
            }
        );

        expect(response.status()).toBe(401);
        const result = await response.json();
        expect(result.error).toBe('Not authenticated');
    });

    test('API should reject invalid session', async ({ page }) => {
        const response = await page.request.post(
            '/api/simple-auth/change-password',
            {
                headers: {
                    Cookie: 'session=invalid-session-id',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: {
                    currentPassword: testUserPassword,
                    newPassword: 'newpassword456',
                    confirmPassword: 'newpassword456',
                },
            }
        );

        expect(response.status()).toBe(401);
        const result = await response.json();
        expect(result.error).toBe('Invalid session');
    });

    test('should allow login with new password after change', async ({
        page,
    }) => {
        // Change password via API
        await page.request.post('/api/simple-auth/change-password', {
            headers: {
                Cookie: `session=${sessionCookie}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: {
                currentPassword: testUserPassword,
                newPassword: 'newpassword456',
                confirmPassword: 'newpassword456',
            },
        });

        // Logout
        await page.click('button[title="Logout"]');

        // Try to login with new password
        await page.goto('/login');
        await page.fill('input[name="email"]', testUserEmail);
        await page.fill('input[name="password"]', 'newpassword456');
        await page.click('button[type="submit"]');

        // Should redirect to home page
        await expect(page).toHaveURL('/');
        await expect(page.locator(`text=API Test User`)).toBeVisible();
    });
});
