import { test, expect } from '@playwright/test';

test.describe('Simple Auth E2E Login Flow', () => {
  test('should complete full signup flow', async ({ page }) => {
    await page.goto('http://localhost:5090');
    
    // Should see login button
    const loginButton = page.locator('a[href="/login"]');
    await expect(loginButton).toBeVisible();
    
    // Navigate to login page
    await loginButton.click();
    await expect(page).toHaveURL('http://localhost:5090/login');
    
    // Fill signup form
    const email = `testuser${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Test User');
    
    // Click signup button
    await page.click('button#signup-btn');
    
    // Should redirect to home page
    await expect(page).toHaveURL('http://localhost:5090/');
    
    // Should show user status instead of login button
    await expect(page.locator('text=Test User')).toBeVisible();
    await expect(page.locator('button[title="Logout"]')).toBeVisible();
    await expect(loginButton).not.toBeVisible();
  });

  test('should complete full login flow after signup', async ({ page }) => {
    // First, create a user account
    await page.goto('http://localhost:5090/login');
    
    const email = `loginuser${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Login Test User');
    await page.click('button#signup-btn');
    
    // Verify logged in
    await expect(page).toHaveURL('http://localhost:5090/');
    await expect(page.locator('text=Login Test User')).toBeVisible();
    
    // Logout
    await page.click('button[title="Logout"]');
    
    // Should be logged out
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('text=Login Test User')).not.toBeVisible();
    
    // Now try to login with the same credentials
    await page.click('a[href="/login"]');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Should be logged in again
    await expect(page).toHaveURL('http://localhost:5090/');
    await expect(page.locator('text=Login Test User')).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    await page.goto('http://localhost:5090/login');
    
    // Try to login with invalid credentials
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Invalid credentials');
  });

  test('should show error for duplicate signup', async ({ page }) => {
    // First signup
    await page.goto('http://localhost:5090/login');
    
    const email = `duplicate${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Duplicate User');
    await page.click('button#signup-btn');
    
    // Should succeed
    await expect(page).toHaveURL('http://localhost:5090/');
    
    // Logout and try to signup again with same email
    await page.click('button[title="Logout"]');
    await page.click('a[href="/login"]');
    
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'differentpassword');
    await page.fill('input[name="name"]', 'Another User');
    await page.click('button#signup-btn');
    
    // Should show error
    await expect(page.locator('#error-message')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('already exists');
  });

  test('should persist session across page navigation', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5090/login');
    
    const email = `persist${Date.now()}@example.com`;
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="name"]', 'Persist User');
    await page.click('button#signup-btn');
    
    // Verify logged in
    await expect(page.locator('text=Persist User')).toBeVisible();
    
    // Navigate to stories page
    await page.click('button:has-text("Start Game")');
    await expect(page).toHaveURL('http://localhost:5090/stories');
    
    // Should still be logged in
    await expect(page.locator('text=Persist User')).toBeVisible();
    
    // Navigate back to home
    await page.goBack();
    await expect(page).toHaveURL('http://localhost:5090/');
    
    // Should still be logged in
    await expect(page.locator('text=Persist User')).toBeVisible();
  });
});
