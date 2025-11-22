import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';

const uniqueEmail = (prefix: string) => `${prefix}-${randomUUID()}@example.com`;

test.describe('Simple Auth E2E Login Flow', () => {
    test('should complete full signup flow', async ({ page }) => {
        await page.goto('http://localhost:5090/');

        // Should see login button linking to localized login page
        const loginButton = page.locator('a[href="/en/login"]');
        await expect(loginButton).toBeVisible();

        // Navigate to login page
        await loginButton.click();
        await expect(page).toHaveURL('http://localhost:5090/en/login');

        // Navigate to signup page
        await page.click('a[href="/en/signup"]');
        await expect(page).toHaveURL('http://localhost:5090/en/signup');

        // Fill signup form
        const email = uniqueEmail('testuser');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Test User');

        // Click signup button
        await page.click('button#signup-btn');

        // Should redirect to English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');

        // Should show user status instead of login button
        await expect(
            page.getByRole('button', { name: /Test User/ })
        ).toBeVisible();
        await expect(page.locator('a[href="/en/login"]')).not.toBeVisible();
    });

    test('should complete full login flow after signup', async ({ page }) => {
        // First, create a user account via signup page
        await page.goto('http://localhost:5090/en/signup');

        const email = uniqueEmail('loginuser');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Login Test User');
        await page.click('button#signup-btn');

        // Verify logged in on English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await expect(
            page.getByRole('button', { name: /Login Test User/ })
        ).toBeVisible();

        // Logout via user menu
        await page.getByRole('button', { name: /Login Test User/ }).click();
        await page.getByRole('button', { name: 'Logout' }).click();

        // Should be logged out (no user menu button)
        await expect(
            page.getByRole('button', { name: /Login Test User/ })
        ).toHaveCount(0);

        // Now navigate to login page with the same credentials
        await page.goto('http://localhost:5090/en/login');
        await expect(page).toHaveURL('http://localhost:5090/en/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.click('button[type="submit"]');

        // Should be logged in again on English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await expect(
            page.getByRole('button', { name: /Login Test User/ })
        ).toBeVisible();
    });

    test('should show error for invalid login', async ({ page }) => {
        await page.goto('http://localhost:5090/en/login');

        // Try to login with invalid credentials
        await page.fill('input[name="email"]', 'nonexistent@example.com');
        await page.fill('input[name="password"]', 'wrongpassword');
        await page.click('button[type="submit"]');

        // Should show error message
        await expect(page.locator('#error-message')).toBeVisible();
        await expect(page.locator('#error-message')).toContainText(
            'Invalid credentials'
        );
    });

    test('should show error for duplicate signup', async ({ page }) => {
        // First signup
        await page.goto('http://localhost:5090/en/signup');

        const email = uniqueEmail('duplicate');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Duplicate User');
        await page.click('button#signup-btn');

        // Should succeed and redirect to English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');

        // Logout via user menu and try to signup again with same email
        await page.getByRole('button', { name: /Duplicate User/ }).click();
        await page.getByRole('button', { name: 'Logout' }).click();
        await page.goto('http://localhost:5090/en/signup');

        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'differentpassword');
        await page.fill('input[name="name"]', 'Another User');
        await page.click('button#signup-btn');

        // Should show duplicate email error
        await expect(page.locator('#error-message')).toBeVisible();
        await expect(page.locator('#error-message')).toContainText(
            'Email might already be in use'
        );
    });

    test('should persist session across page navigation', async ({ page }) => {
        // Sign up a new user
        await page.goto('http://localhost:5090/en/signup');

        const email = uniqueEmail('persist');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', 'password123');
        await page.fill('input[name="name"]', 'Persist User');
        await page.click('button#signup-btn');

        // Verify logged in on English home page
        await expect(page).toHaveURL('http://localhost:5090/en/');
        await expect(
            page.getByRole('button', { name: /Persist User/ })
        ).toBeVisible();

        // Navigate to stories page
        await page.click('button:has-text("Start Game")');
        await expect(page).toHaveURL('http://localhost:5090/en/stories');

        // Should still be logged in
        await expect(
            page.getByRole('button', { name: /Persist User/ })
        ).toBeVisible();

        // Navigate back to home
        await page.goBack();
        await expect(page).toHaveURL('http://localhost:5090/en/');

        // Should still be logged in
        await expect(
            page.getByRole('button', { name: /Persist User/ })
        ).toBeVisible();
    });
});
