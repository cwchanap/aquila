import { test, expect } from '@playwright/test';
import {
    signInWithSharedCredentialsViaUI,
    signUpFreshUserViaUI,
} from './utils';

/**
 * Auth Flow E2E Tests
 *
 * These tests cover the core authentication user journeys:
 * - New user signup flow
 * - Existing user login flow
 * - Logout flow
 * - Unauthenticated access protection
 *
 * Business logic (form validation, error states, API responses) should be
 * tested in unit tests, not here.
 */

test.describe('Authentication Flows', () => {
    test.describe('New User Signup', () => {
        test.skip(!process.env.CI, 'Skipping account creation tests locally');

        test('new user can sign up and reach main menu', async ({ page }) => {
            await signUpFreshUserViaUI(page, {
                locale: 'en',
                emailPrefix: 'auth-flow',
            });

            // Should land on main menu after signup
            await expect(page).toHaveURL(/\/en\/?$/);
            await expect(page.locator('body h1').first()).toContainText(
                'Main Menu'
            );

            // Should be able to navigate to stories (proves authenticated)
            const startButton = page.locator('#start-btn');
            await expect(startButton).toBeVisible();
            await startButton.click();
            await expect(page).toHaveURL(/\/en\/stories$/);
        });
    });

    test.describe('Existing User Login', () => {
        test('existing user can login and reach main menu', async ({
            page,
        }) => {
            await signInWithSharedCredentialsViaUI(page, { locale: 'en' });

            // Should land on main menu after login
            await expect(page).toHaveURL(/\/en\/?$/);
            await expect(page.locator('body h1').first()).toContainText(
                'Main Menu'
            );

            // User menu should be visible (proves authenticated)
            await expect(
                page.locator('button[title="User Menu"]')
            ).toBeVisible();
        });
    });

    test.describe('Logout Flow', () => {
        test('user can logout and is redirected to login', async ({ page }) => {
            // Login first
            await signInWithSharedCredentialsViaUI(page, { locale: 'en' });
            await expect(page).toHaveURL(/\/en\/?$/);

            // Open user menu and sign out
            const userMenuButton = page.locator('button[title="User Menu"]');
            await expect(userMenuButton).toBeVisible();
            await userMenuButton.click();

            await page.getByRole('button', { name: /Sign Out/i }).click();
            await page.waitForLoadState('networkidle');

            // Should be redirected to login
            await expect(page).toHaveURL(/\/en\/login/);
        });
    });

    test.describe('Access Protection', () => {
        test('unauthenticated user is redirected to login from home', async ({
            page,
        }) => {
            await page.goto('/en/');
            await page.waitForURL(/\/en\/login\/?$/);
            await expect(page).toHaveURL(/\/en\/login\/?$/);
        });

        test('unauthenticated user is redirected to login from stories', async ({
            page,
        }) => {
            await page.goto('/en/stories');
            await page.waitForURL(/\/en\/login\/?$/);
            await expect(page).toHaveURL(/\/en\/login\/?$/);
        });
    });
});

test.describe('API Authorization Guards', () => {
    test('unauthenticated requests return 401', async ({ request }) => {
        // These are quick API checks - no browser needed
        const endpoints = ['/api/me', '/api/bookmarks'];

        for (const endpoint of endpoints) {
            const response = await request.get(endpoint);
            expect(response.status()).toBe(401);
        }
    });

    test('unauthenticated POST/DELETE to bookmarks returns 401', async ({
        request,
    }) => {
        const postResponse = await request.post('/api/bookmarks', {
            data: {
                storyId: 'trainAdventure',
                sceneId: 'scene-1',
                bookmarkName: 'unauthorized',
                locale: 'en',
            },
        });
        expect([401, 403]).toContain(postResponse.status());

        const deleteResponse = await request.delete('/api/bookmarks/some-id');
        expect([401, 403]).toContain(deleteResponse.status());
    });
});
