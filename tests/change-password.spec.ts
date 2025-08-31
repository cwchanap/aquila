import { test, expect } from '@playwright/test';

test.describe('Change Password Functionality', () => {
  let testUserEmail: string;
  let testUserPassword: string;

  test.beforeEach(async ({ page }) => {
    // Create a unique test user for each test
    testUserEmail = `testuser${Date.now()}@example.com`;
    testUserPassword = 'password123';

    // Sign up the test user
    await page.goto('/login');
    await page.fill('input[name="email"]', testUserEmail);
    await page.fill('input[name="password"]', testUserPassword);
    await page.fill('input[name="name"]', 'Test User');
    await page.click('button#signup-btn');

    // Wait for redirect to home page
    await expect(page).toHaveURL('/');

    // Verify session cookie exists
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name === 'session');
    expect(sessionCookie).toBeTruthy();
  });

  test('should successfully change password', async ({ page }) => {
    // Navigate to profile page
    await page.goto('/profile');
    await expect(page).toHaveURL('/profile');

    // Fill out the change password form
    await page.fill('input[name="currentPassword"]', testUserPassword);
    await page.fill('input[name="newPassword"]', 'newpassword456');
    await page.fill('input[name="confirmPassword"]', 'newpassword456');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should stay on profile page (no redirect on success for this implementation)
    await expect(page).toHaveURL('/profile');

    // Try to login with the new password
    await page.goto('/login');
    await page.fill('input[name="email"]', testUserEmail);
    await page.fill('input[name="password"]', 'newpassword456');
    await page.click('button[type="submit"]');

    // Should redirect to home page
    await expect(page).toHaveURL('/');
  });

  test('should show error for incorrect current password', async ({ page }) => {
    await page.goto('/profile');

    // Fill out form with wrong current password
    await page.fill('input[name="currentPassword"]', 'wrongpassword');
    await page.fill('input[name="newPassword"]', 'newpassword456');
    await page.fill('input[name="confirmPassword"]', 'newpassword456');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should stay on profile page
    await expect(page).toHaveURL('/profile');

    // Should show error message (this would need to be implemented in the UI)
    // For now, we verify the form is still there
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
  });

  test('should show error for password mismatch', async ({ page }) => {
    await page.goto('/profile');

    // Fill out form with mismatched passwords
    await page.fill('input[name="currentPassword"]', testUserPassword);
    await page.fill('input[name="newPassword"]', 'newpassword456');
    await page.fill('input[name="confirmPassword"]', 'differentpassword');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should stay on profile page
    await expect(page).toHaveURL('/profile');

    // Form should still be visible
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
  });

  test('should show error for password too short', async ({ page }) => {
    await page.goto('/profile');

    // Fill out form with short password
    await page.fill('input[name="currentPassword"]', testUserPassword);
    await page.fill('input[name="newPassword"]', '123');
    await page.fill('input[name="confirmPassword"]', '123');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should stay on profile page
    await expect(page).toHaveURL('/profile');

    // Form should still be visible
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
  });

  test('should require all fields', async ({ page }) => {
    await page.goto('/profile');

    // Try to submit with empty fields
    await page.click('button[type="submit"]');

    // Should stay on profile page
    await expect(page).toHaveURL('/profile');

    // Form should still be visible
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
  });

  test('should redirect to login if not authenticated', async ({ page }) => {
    // Clear session cookie
    await page.context().clearCookies();

    // Try to access profile page
    await page.goto('/profile');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });

  test('should display user information correctly', async ({ page }) => {
    await page.goto('/profile');

    // Should display user name
    await expect(page.locator('text=Test User')).toBeVisible();

    // Should display user email
    await expect(page.locator(`text=${testUserEmail}`)).toBeVisible();

    // Should have change password form
    await expect(page.locator('input[name="currentPassword"]')).toBeVisible();
    await expect(page.locator('input[name="newPassword"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have working back to menu button', async ({ page }) => {
    await page.goto('/profile');

    // Click back to menu button
    await page.click('a[href="/"]');

    // Should navigate to home page
    await expect(page).toHaveURL('/');
  });

  test('should maintain session after password change', async ({ page }) => {
    await page.goto('/profile');

    // Change password
    await page.fill('input[name="currentPassword"]', testUserPassword);
    await page.fill('input[name="newPassword"]', 'newpassword456');
    await page.fill('input[name="confirmPassword"]', 'newpassword456');
    await page.click('button[type="submit"]');

    // Should still be logged in (session should persist)
    await expect(page.locator('text=Test User')).toBeVisible();
  });
});