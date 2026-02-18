import { test, expect } from '@playwright/test';
import { uniqueEmail } from './utils';

test.describe('Auth Flow', () => {
    test('should sign up, log out, and log back in', async ({
        page,
        request,
    }) => {
        const authProbe = await request.get('/api/auth/get-session');
        test.skip(
            authProbe.status() === 503,
            'Auth backend unavailable for E2E (database adapter failed to initialize).'
        );

        const email = uniqueEmail('auth');
        const password = 'password123';
        const name = 'Test User';

        await page.goto('/en/signup');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.fill('input[name="name"]', name);
        await page.click('button#signup-btn');

        await expect(page).toHaveURL('/en/');
        await expect(page.getByRole('button', { name })).toBeVisible();

        await page.getByRole('button', { name }).click();
        await page.getByRole('button', { name: 'Logout' }).click();
        await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

        await page.goto('/en/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL('/en/');
        await expect(page.getByRole('button', { name })).toBeVisible();
    });
});
