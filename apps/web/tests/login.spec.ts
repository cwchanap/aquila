import { test, expect } from '@playwright/test';

test.describe('Better-Auth Login Functionality', () => {
    test('should show login button when user not logged in', async ({
        page,
    }) => {
        await page.goto('http://localhost:5090');

        // Should see login button in top right
        const loginButton = page.locator('a[href="/login"]');
        await expect(loginButton).toBeVisible();
        await expect(loginButton).toHaveText('Login');
    });

    test('should navigate to login page', async ({ page }) => {
        await page.goto('http://localhost:5090');

        // Click login button
        await page.click('a[href="/login"]');

        // Should be on login page
        await expect(page).toHaveURL('http://localhost:5090/login');
        await expect(page.locator('h1')).toHaveText('Login');

        // Should have login form with email and password
        await expect(page.locator('input[name="email"]')).toBeVisible();
        await expect(page.locator('input[name="password"]')).toBeVisible();
        await expect(page.locator('input[name="name"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
        await expect(page.locator('button#signup-btn')).toBeVisible();
    });

    test('should sign up new user and show user status', async ({ page }) => {
        await page.goto('http://localhost:5090/login');

        // Fill in signup form
        await page.fill('input[name="email"]', 'newuser@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'New User');

        // Click signup button
        await page.click('button#signup-btn');

        // Should redirect to home page
        await expect(page).toHaveURL('http://localhost:5090/');

        // Should show user status instead of login button
        await expect(page.locator('text=New User')).toBeVisible();
        await expect(page.locator('button[title="Logout"]')).toBeVisible();
        await expect(page.locator('a[href="/login"]')).not.toBeVisible();
    });

    test('should login existing user', async ({ page }) => {
        // First create a user by signing up
        await page.goto('http://localhost:5090/login');
        await page.fill('input[name="email"]', 'testuser@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Test User');
        await page.click('button#signup-btn');

        // Wait for redirect and logout
        await expect(page).toHaveURL('http://localhost:5090/');
        await page.click('button[title="Logout"]');

        // Now try to login with the same credentials
        await page.goto('http://localhost:5090/login');
        await page.fill('input[name="email"]', 'testuser@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Should redirect to home page and show user
        await expect(page).toHaveURL('http://localhost:5090/');
        await expect(page.locator('text=Test User')).toBeVisible();
    });

    test('should logout user', async ({ page }) => {
        // First login
        await page.goto('http://localhost:5090/login');
        await page.fill('input[name="email"]', 'logouttest@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Logout Test');
        await page.click('button#signup-btn');

        // Verify logged in
        await expect(page.locator('text=Logout Test')).toBeVisible();

        // Click logout
        await page.click('button[title="Logout"]');

        // Should be logged out and show login button again
        await expect(page.locator('a[href="/login"]')).toBeVisible();
        await expect(page.locator('text=Logout Test')).not.toBeVisible();
    });

    test('should show user status on stories page', async ({ page }) => {
        // Login first
        await page.goto('http://localhost:5090/login');
        await page.fill('input[name="email"]', 'storiestest@example.com');
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Stories Test');
        await page.click('button#signup-btn');

        // Navigate to stories page
        await page.click('button:has-text("Start Game")');
        await expect(page).toHaveURL('http://localhost:5090/stories');

        // Should show user status on stories page too
        await expect(page.locator('text=Stories Test')).toBeVisible();
        await expect(page.locator('button[title="Logout"]')).toBeVisible();
    });

    test('should handle invalid login credentials', async ({ page }) => {
        await page.goto('http://localhost:5090/login');

        // Try to login with non-existent credentials
        await page.fill('input[name="email"]', 'nonexistent@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should show error message
        await expect(page.locator('#error-message')).toBeVisible();
        await expect(page.locator('#error-message')).toContainText(
            'Login failed'
        );
    });

    test('should have back button on login page', async ({ page }) => {
        await page.goto('http://localhost:5090/login');

        // Should have back button
        const backButton = page.locator('a[href="/"]').first();
        await expect(backButton).toBeVisible();

        // Click back button
        await backButton.click();

        // Should navigate back to home
        await expect(page).toHaveURL('http://localhost:5090/');
    });
});
