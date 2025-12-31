import { test, expect } from '@playwright/test';
import { signUpFreshUserViaUI } from './utils';

/**
 * Story Writer E2E Flow Tests
 *
 * These tests cover the core CRUD flows for the story writer:
 * - Create story with chapters and scenes
 * - Edit and delete stories
 * - Data persistence
 *
 * Detailed form validation, keyboard navigation, and API error handling
 * should be tested in unit/component tests.
 */

async function gotoStoryWriter(page: import('@playwright/test').Page) {
    await page.goto('/en/story-writer', { waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/en\/story-writer\/?$/);
    await expect(
        page.getByRole('heading', { name: 'Story Writer' })
    ).toBeVisible();
}

test.describe('Story Writer Core Flows', () => {
    test.beforeEach(async ({ page }) => {
        await signUpFreshUserViaUI(page, {
            locale: 'en',
            emailPrefix: 'story',
        });
    });

    test('authenticated user can access story writer', async ({ page }) => {
        await gotoStoryWriter(page);
        await expect(
            page.locator('button[title="Create new story"]')
        ).toBeVisible();
    });

    test('unauthenticated user is redirected to login', async ({ page }) => {
        await page.context().clearCookies();
        await page.goto('/en/story-writer', { waitUntil: 'commit' });
        await expect(page).toHaveURL(/\/en\/login\/?$/);
    });

    test('complete CRUD flow: create story → add chapter → add scene', async ({
        page,
    }) => {
        await gotoStoryWriter(page);

        // Create story
        await page.locator('button[title="Create new story"]').click();
        await expect(
            page.getByRole('heading', { name: 'Create New Story' })
        ).toBeVisible();
        await page.locator('#story-title').fill('My Epic Novel');
        await page
            .locator('#story-description')
            .fill('A tale of heroes and dragons');
        await page.getByRole('button', { name: 'Create Story' }).click();
        await expect(page.getByText('My Epic Novel')).toBeVisible();

        // Add chapter
        await page.locator('button[title="Add chapter"]').click();
        await page.locator('#chapter-title').fill('Chapter 1: The Beginning');
        await page.locator('#chapter-description').fill('Where it all starts');
        await page.getByRole('button', { name: 'Create Chapter' }).click();

        const chapterItem = page
            .locator('.chapter-item')
            .filter({ hasText: 'Chapter 1: The Beginning' });
        await expect(chapterItem).toBeVisible();

        // Expand chapter and add scene
        await chapterItem.locator('button').first().click();
        await chapterItem.locator('button[title="Add scene"]').first().click();
        await page.locator('#scene-title').fill('Scene 1: A New Dawn');
        await page
            .locator('#scene-content')
            .fill('The sun rose over the mountains...');
        await page.getByRole('button', { name: 'Create Scene' }).click();
        await expect(page.getByText('Scene 1: A New Dawn')).toBeVisible();
    });

    test('edit story status from draft to published', async ({ page }) => {
        await gotoStoryWriter(page);

        // Create draft story
        await page.locator('button[title="Create new story"]').click();
        await page.locator('#story-title').fill('Draft Story');
        await page.locator('#story-status').selectOption('draft');
        await page.getByRole('button', { name: 'Create Story' }).click();
        await expect(page.getByText('Draft Story')).toBeVisible();

        // Edit to published
        await page
            .locator('button')
            .filter({ hasText: 'Draft Story' })
            .first()
            .click();
        await page.locator('button[title="Edit story"]').click();
        await page.locator('#story-status').selectOption('published');
        await page.getByRole('button', { name: 'Update Story' }).click();

        const storyRow = page
            .locator('button')
            .filter({ hasText: 'Draft Story' })
            .first();
        await expect(storyRow).toContainText('published');
    });

    test('delete a story', async ({ page }) => {
        await gotoStoryWriter(page);

        // Create story
        await page.locator('button[title="Create new story"]').click();
        await page.locator('#story-title').fill('Delete Me');
        await page.getByRole('button', { name: 'Create Story' }).click();
        await expect(page.getByText('Delete Me')).toBeVisible();

        // Delete it
        await page
            .locator('button')
            .filter({ hasText: 'Delete Me' })
            .first()
            .click();
        await page.locator('button[title="Delete story"]').click();
        await expect(page.getByText('Delete Me')).toHaveCount(0);
    });

    test('data persists after page refresh', async ({ page }) => {
        await gotoStoryWriter(page);

        // Create story
        await page.locator('button[title="Create new story"]').click();
        await page.locator('#story-title').fill('Persistence Test');
        await page.getByRole('button', { name: 'Create Story' }).click();
        await expect(page.getByText('Persistence Test')).toBeVisible();

        // Refresh and verify
        await page.reload();
        await expect(page.getByText('Persistence Test')).toBeVisible();
    });
});
