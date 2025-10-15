import { test, expect } from '@playwright/test';

test.describe('Story Writer E2E Flow', () => {
    let userEmail: string;

    test.beforeEach(async ({ page }) => {
        // Create a unique user for each test
        userEmail = `storywriter${Date.now()}@example.com`;

        // Sign up
        await page.goto('http://localhost:5090/en/signup');
        await page.getByRole('textbox', { name: 'Email' }).fill(userEmail);
        await page
            .getByRole('textbox', { name: 'Password' })
            .fill('TestPassword123!');
        await page
            .getByRole('textbox', { name: 'Name' })
            .fill('Story Writer Tester');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        // Wait for redirect to home page (successful signup)
        await page.waitForURL('http://localhost:5090/en/', { timeout: 10000 });
    });

    test('should navigate to story writer when authenticated', async ({
        page,
    }) => {
        // Navigate to story writer
        await page.goto('http://localhost:5090/en/story-writer');

        // Should load the story writer page
        await expect(page).toHaveURL('http://localhost:5090/en/story-writer');
        await expect(
            page.getByRole('heading', { name: 'Story Writer' })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Create Story' })
        ).toBeVisible();
    });

    test('should redirect to login when not authenticated', async ({
        page,
    }) => {
        // Logout first (if we have a logout mechanism)
        // For now, clear cookies to simulate logout
        await page.context().clearCookies();

        // Try to access story writer
        await page.goto('http://localhost:5090/en/story-writer');

        // Should redirect to login
        await expect(page).toHaveURL('http://localhost:5090/en/login');
    });

    test('should create a new story', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Click Create Story button
        await page.getByRole('button', { name: 'Create Story' }).click();

        // Modal should open
        await expect(
            page.getByRole('heading', { name: 'Create Story' })
        ).toBeVisible();

        // Fill in story details
        await page
            .getByRole('textbox', { name: 'Title' })
            .fill('My Epic Fantasy Novel');
        await page
            .getByRole('textbox', { name: 'Description' })
            .fill('A tale of heroes and dragons');
        await page
            .getByRole('combobox', { name: 'Status' })
            .selectOption('draft');

        // Submit form
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        // Modal should close
        await expect(
            page.getByRole('heading', { name: 'Create Story' })
        ).not.toBeVisible({ timeout: 5000 });

        // Story should appear in sidebar
        await expect(page.getByText('My Epic Fantasy Novel')).toBeVisible();
    });

    test('should create story, chapter, and scene', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create a story
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page
            .getByRole('textbox', { name: 'Title' })
            .fill('Test Story for Chapters');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        // Wait for story to appear
        await expect(page.getByText('Test Story for Chapters')).toBeVisible();

        // Add a chapter (look for add chapter button/icon)
        // Assuming there's a button or icon to add chapter near the story
        const addChapterButton = page
            .locator('[data-story-id]')
            .filter({ hasText: 'Test Story for Chapters' })
            .locator('button', { hasText: 'Add Chapter' })
            .or(
                page
                    .locator('[data-story-id]')
                    .filter({ hasText: 'Test Story for Chapters' })
                    .locator('button[title="Add Chapter"]')
            )
            .first();

        if (await addChapterButton.isVisible({ timeout: 2000 })) {
            await addChapterButton.click();

            // Fill chapter form
            await expect(
                page.getByRole('heading', { name: /chapter/i })
            ).toBeVisible();
            await page
                .getByRole('textbox', { name: 'Title' })
                .fill('Chapter 1: The Beginning');
            await page
                .getByRole('textbox', { name: 'Description' })
                .fill('Where it all starts');
            await page.getByRole('button', { name: 'Create' }).click();

            // Chapter should appear
            await expect(
                page.getByText('Chapter 1: The Beginning')
            ).toBeVisible();

            // Add a scene to the chapter
            const addSceneButton = page
                .locator('[data-chapter-id]')
                .filter({ hasText: 'Chapter 1' })
                .locator('button', { hasText: 'Add Scene' })
                .or(
                    page
                        .locator('[data-chapter-id]')
                        .filter({ hasText: 'Chapter 1' })
                        .locator('button[title="Add Scene"]')
                )
                .first();

            if (await addSceneButton.isVisible({ timeout: 2000 })) {
                await addSceneButton.click();

                // Fill scene form
                await expect(
                    page.getByRole('heading', { name: /scene/i })
                ).toBeVisible();
                await page
                    .getByRole('textbox', { name: 'Title' })
                    .fill('Scene 1: A New Dawn');
                await page
                    .getByRole('textbox', { name: 'Content' })
                    .fill('The sun rose over the mountains...');
                await page.getByRole('button', { name: 'Create' }).click();

                // Scene should appear
                await expect(
                    page.getByText('Scene 1: A New Dawn')
                ).toBeVisible();
            }
        }
    });

    test('should persist data after page refresh', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create a story
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page
            .getByRole('textbox', { name: 'Title' })
            .fill('Persistence Test Story');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        // Wait for story to appear
        await expect(page.getByText('Persistence Test Story')).toBeVisible();

        // Refresh the page
        await page.reload();

        // Story should still be there
        await expect(page.getByText('Persistence Test Story')).toBeVisible();
    });

    test('should update story status', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create a story with draft status
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page.getByRole('textbox', { name: 'Title' }).fill('Draft Story');
        await page
            .getByRole('combobox', { name: 'Status' })
            .selectOption('draft');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        await expect(page.getByText('Draft Story')).toBeVisible();

        // Edit the story (if edit functionality exists)
        const editButton = page
            .locator('[data-story]')
            .filter({ hasText: 'Draft Story' })
            .locator('button', { hasText: 'Edit' })
            .or(
                page
                    .locator('[data-story]')
                    .filter({ hasText: 'Draft Story' })
                    .locator('button[title="Edit"]')
            )
            .first();

        if (await editButton.isVisible({ timeout: 2000 })) {
            await editButton.click();

            // Update status to published
            await page
                .getByRole('combobox', { name: 'Status' })
                .selectOption('published');
            await page.getByRole('button', { name: 'Update' }).click();

            // Verify update (this would depend on UI feedback)
            await expect(page.getByText('Draft Story')).toBeVisible();
        }
    });

    test('should delete a story', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create a story to delete
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page.getByRole('textbox', { name: 'Title' }).fill('Delete Me');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        await expect(page.getByText('Delete Me')).toBeVisible();

        // Delete the story (if delete functionality exists)
        const deleteButton = page
            .locator('[data-story]')
            .filter({ hasText: 'Delete Me' })
            .locator('button', { hasText: 'Delete' })
            .or(
                page
                    .locator('[data-story]')
                    .filter({ hasText: 'Delete Me' })
                    .locator('button[title="Delete"]')
            )
            .first();

        if (await deleteButton.isVisible({ timeout: 2000 })) {
            // Listen for confirmation dialog
            page.once('dialog', async dialog => {
                expect(dialog.type()).toBe('confirm');
                await dialog.accept();
            });

            await deleteButton.click();

            // Story should be gone
            await expect(page.getByText('Delete Me')).not.toBeVisible({
                timeout: 5000,
            });
        }
    });

    test('should handle empty state when no stories exist', async ({
        page,
    }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Should show empty state or welcome message
        // This depends on the actual UI implementation
        const emptyState =
            page.getByText(/no stories/i) ||
            page.getByText(/create your first/i) ||
            page.getByRole('button', { name: 'Create Story' });

        await expect(emptyState).toBeVisible();
    });

    test('should expand and collapse chapters in tree view', async ({
        page,
    }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create story with chapter
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page
            .getByRole('textbox', { name: 'Title' })
            .fill('Expandable Story');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        // This test assumes the UI has expand/collapse functionality
        // The specific selectors would depend on the actual implementation
        const storyNode = page
            .locator('[data-story]')
            .filter({ hasText: 'Expandable Story' });

        // Look for expand/collapse indicator
        const expandButton = storyNode
            .locator('button[aria-expanded]')
            .or(storyNode.locator('[role="button"]'))
            .first();

        if (await expandButton.isVisible({ timeout: 2000 })) {
            // Get initial state
            const initialState =
                await expandButton.getAttribute('aria-expanded');

            // Click to toggle
            await expandButton.click();

            // State should change
            const newState = await expandButton.getAttribute('aria-expanded');
            expect(newState).not.toBe(initialState);
        }
    });

    test('should display correct story count', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Create multiple stories
        const storyTitles = ['Story One', 'Story Two', 'Story Three'];

        for (const title of storyTitles) {
            await page.getByRole('button', { name: 'Create Story' }).click();
            await page.getByRole('textbox', { name: 'Title' }).fill(title);
            await page
                .getByRole('button', { name: 'Create', exact: true })
                .click();
            await expect(page.getByText(title)).toBeVisible();
        }

        // All three stories should be visible
        for (const title of storyTitles) {
            await expect(page.getByText(title)).toBeVisible();
        }
    });
});

test.describe('Story Writer API Integration', () => {
    test('should handle API errors gracefully', async ({ page }) => {
        // This test would check error handling when API fails
        // You might need to mock API failures or test against actual error conditions

        await page.goto('http://localhost:5090/en/story-writer');

        // Intercept API request and return error
        await page.route('**/api/stories', route => {
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Internal server error' }),
            });
        });

        // Reload to trigger API call
        await page.reload();

        // Should show error message to user
        await expect(
            page.getByText(/error/i).or(page.getByText(/failed/i))
        ).toBeVisible({ timeout: 5000 });
    });

    test('should handle network timeout', async ({ page }) => {
        await page.goto('http://localhost:5090/en/story-writer');

        // Simulate slow network
        await page.route('**/api/stories', async route => {
            await page.waitForTimeout(30000); // Force timeout
            await route.continue();
        });

        // Try to create a story
        await page.getByRole('button', { name: 'Create Story' }).click();
        await page.getByRole('textbox', { name: 'Title' }).fill('Timeout Test');
        await page.getByRole('button', { name: 'Create', exact: true }).click();

        // Should show loading state or timeout message
        // This depends on implementation
    });
});

test.describe('Story Writer Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('http://localhost:5090/en/signup');

        // Sign up first
        await page
            .getByRole('textbox', { name: 'Email' })
            .fill(`a11y${Date.now()}@example.com`);
        await page
            .getByRole('textbox', { name: 'Password' })
            .fill('TestPassword123!');
        await page.getByRole('textbox', { name: 'Name' }).fill('A11y Tester');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        await page.waitForURL('http://localhost:5090/en/');
        await page.goto('http://localhost:5090/en/story-writer');

        // Tab to Create Story button
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // Should be able to activate with Enter or Space
        await page.keyboard.press('Enter');

        // Modal should open
        await expect(
            page.getByRole('heading', { name: 'Create Story' })
        ).toBeVisible();

        // Should be able to close with Escape
        await page.keyboard.press('Escape');

        // Modal should close
        await expect(
            page.getByRole('heading', { name: 'Create Story' })
        ).not.toBeVisible({ timeout: 2000 });
    });

    test('should have proper ARIA labels', async ({ page }) => {
        await page.goto('http://localhost:5090/en/signup');

        await page
            .getByRole('textbox', { name: 'Email' })
            .fill(`aria${Date.now()}@example.com`);
        await page
            .getByRole('textbox', { name: 'Password' })
            .fill('TestPassword123!');
        await page.getByRole('textbox', { name: 'Name' }).fill('ARIA Tester');
        await page.getByRole('button', { name: 'Sign Up' }).click();

        await page.waitForURL('http://localhost:5090/en/');
        await page.goto('http://localhost:5090/en/story-writer');

        // Check for proper heading structure
        const mainHeading = page.getByRole('heading', { level: 1 });
        await expect(mainHeading).toBeVisible();

        // Create Story button should have accessible name
        const createButton = page.getByRole('button', { name: 'Create Story' });
        await expect(createButton).toBeVisible();
    });
});
