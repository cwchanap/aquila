import { test, expect } from '@playwright/test';

test.describe('Login Functionality', () => {
  test('should show login button when user not logged in', async ({ page }) => {
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
    
    // Should have login form
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login user and show user status', async ({ page }) => {
    await page.goto('http://localhost:5090/login');
    
    // Fill in login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="username"]', 'testuser');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should redirect to home page
    await expect(page).toHaveURL('http://localhost:5090/');
    
    // Should show user status instead of login button
    await expect(page.locator('text=testuser')).toBeVisible();
    await expect(page.locator('button[title="Logout"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).not.toBeVisible();
  });

  test('should logout user', async ({ page }) => {
    // First login
    await page.goto('http://localhost:5090/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="username"]', 'testuser');
    await page.click('button[type="submit"]');
    
    // Verify logged in
    await expect(page.locator('text=testuser')).toBeVisible();
    
    // Click logout
    await page.click('button[title="Logout"]');
    
    // Should be logged out and show login button again
    await expect(page).toHaveURL('http://localhost:5090/');
    await expect(page.locator('a[href="/login"]')).toBeVisible();
    await expect(page.locator('text=testuser')).not.toBeVisible();
  });

  test('should show user status on stories page', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:5090/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="username"]', 'testuser');
    await page.click('button[type="submit"]');
    
    // Navigate to stories page
    await page.click('button:has-text("Start Game")');
    await expect(page).toHaveURL('http://localhost:5090/stories');
    
    // Should show user status on stories page too
    await expect(page.locator('text=testuser')).toBeVisible();
    await expect(page.locator('button[title="Logout"]')).toBeVisible();
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
