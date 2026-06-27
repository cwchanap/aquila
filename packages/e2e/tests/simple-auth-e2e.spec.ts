import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
    test('login offers Google sign-in and signup redirects to login', async ({
        page,
    }) => {
        await page.goto('/en/login');
        await expect(
            page.getByRole('button', { name: /continue with google/i })
        ).toBeVisible();

        await page.goto('/en/signup');
        await expect(page).toHaveURL('/en/login');
    });

    test('clicking Continue with Google initiates the social sign-in request', async ({
        page,
        request,
    }) => {
        const authProbe = await request.get('/api/auth/get-session');
        test.skip(
            authProbe.status() === 503,
            'Auth backend unavailable for E2E (database adapter failed to initialize).'
        );

        await page.goto('/en/login');

        const [socialRequest] = await Promise.all([
            page.waitForRequest(/\/api\/auth\/sign-in\/social/, {
                timeout: 15000,
            }),
            page.getByRole('button', { name: /continue with google/i }).click(),
        ]);

        expect(socialRequest.url()).toContain('/api/auth/sign-in/social');
        // Verify the request specifically targets the Google provider, not
        // just any social sign-in endpoint. Better Auth sends the provider
        // identifier in the POST body.
        const postData = socialRequest.postData();
        expect(postData).toBeTruthy();
        expect(postData).toContain('google');
    });
});
