import { test, expect } from '@playwright/test';

test.describe('Better-Auth Login Functionality', () => {
    test('should show login button when user not logged in', async ({
        page,
    }) => {
        await page.goto('http://localhost:5090/');

        // Should see login button in top right (localized path)
        const loginButton = page.locator('a[href="/en/login"]');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toHaveText('Login');
    });

    test('should navigate to login page', async ({ page }) => {
        await page.goto('http://localhost:5090/');

        // Click login button
        await page.click('a[href="/en/login"]');

        // Should be on localized login page
        await expect(page).toHaveURL('http://localhost:5090/en/login');
        await expect(page.locator('h1')).toHaveText('Login');

        // Should have login form with email and password
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // And a link to the signup page
        await expect(page.locator('a[href="/en/signup"]')).toBeVisible();
    });

    test('should sign up new user and show user status', async ({ page }) => {
        await page.goto('http://localhost:5090/en/signup');

        // Fill in signup form
        const email = `newuser${Date.now()}@example.com`;
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'New User');

        // Click signup button
        await page.click('button#signup-btn');

        // Should redirect to English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');

        // Should show user status instead of login button
        await expect(page.locator('text=New User')).toBeVisible();
        await expect(page.locator('button[title="Logout"]')).toBeVisible();
        await expect(page.locator('a[href="/en/login"]')).not.toBeVisible();
    });

    test('should login existing user', async ({ page }) => {
        // First create a user by signing up on the signup page
        await page.goto('http://localhost:5090/en/signup');

        const email = `testuser${Date.now()}@example.com`;
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Test User');
        await page.click('button#signup-btn');

        // Wait for redirect and logout from English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await page.click('button[title="Logout"]');

        // Now try to login with the same credentials on localized login page
        await page.goto('http://localhost:5090/en/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Should redirect to English home page and show user
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await expect(page.locator('text=Test User')).toBeVisible();
    });

    test('should logout user', async ({ page }) => {
        // First login via signup page
        await page.goto('http://localhost:5090/en/signup');

        const email = `logouttest${Date.now()}@example.com`;
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Logout Test');
        await page.click('button#signup-btn');

        // Verify logged in
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await expect(page.locator('text=Logout Test')).toBeVisible();

        // Click logout
        await page.click('button[title="Logout"]');

        // Should be logged out and show login button again
        await expect(page.locator('a[href="/en/login"]')).toBeVisible();
        await expect(page.locator('text=Logout Test')).not.toBeVisible();
    });

    test('should show user status on stories page', async ({ page }) => {
        // Login first by signing up
        await page.goto('http://localhost:5090/en/signup');

        const email = `storiestest${Date.now()}@example.com`;
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Stories Test');
        await page.click('button#signup-btn');

        // Navigate to stories page
        await page.click('button:has-text("Start Game")');
        await expect(page).toHaveURL('http://localhost:5090/en/stories');

        // Should show user status on stories page too
        await expect(page.locator('text=Stories Test')).toBeVisible();
        await expect(page.locator('button[title="Logout"]')).toBeVisible();
    });

    test('should handle invalid login credentials', async ({ page }) => {
        await page.goto('http://localhost:5090/en/login');

        // Try to login with non-existent credentials
        await page.fill('input[name="email"]', 'nonexistent@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should show error message
        await expect(page.locator('#error-message')).toBeVisible();
        await expect(page.locator('#error-message')).toContainText(
            'Invalid credentials'
        );
    });

    test('should have back button on login page', async ({ page }) => {
        await page.goto('http://localhost:5090/en/login');

        // Should have back button to English home
        const backButton = page.locator('a[href="/en/"]').first();
        await expect(backButton).toBeVisible();

        // Click back button
        await backButton.click();

        // Should navigate back to English home
        await expect(page).toHaveURL('http://localhost:5090/en/');
    });
});
