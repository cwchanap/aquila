# Playwright Tests for Aquila

This directory contains end-to-end tests for the Aquila game application using Playwright.

## Test Structure

- `homepage.spec.ts` - Tests for the main menu/homepage
- `stories.spec.ts` - Tests for the story selection page
- `navigation.spec.ts` - Tests for navigation flow and responsive design
- `accessibility.spec.ts` - Tests for accessibility and performance
- `page-objects.spec.ts` - Example tests using Page Object Model pattern
- `utils.ts` - Shared utilities and Page Object Models
- `global-setup.ts` - Global setup configuration

## Running Tests

### Basic Commands

```bash
# Run all tests
pnpm test

# Run tests with UI mode (interactive)
pnpm test:ui

# Run tests in headed mode (see browser)
pnpm test:headed

# Debug tests step by step
pnpm test:debug

# Show test report
pnpm test:report
```

### Advanced Commands

```bash
# Run specific test file
npx playwright test homepage.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium

# Run tests matching a pattern
npx playwright test --grep "navigation"

# Run tests in parallel
npx playwright test --workers=4

# Generate test results
npx playwright test --reporter=html
```

## Test Categories

### 🏠 Homepage Tests
- Main menu display and functionality
- Button interactions
- Styling verification
- Navigation to stories page

### 📚 Stories Tests  
- Story selection page display
- Story button functionality
- Navigation to story setup
- Consistent styling

### 🧭 Navigation Tests
- Full user journey flow
- Browser back/forward navigation
- Responsive design on different viewports
- Mobile and tablet compatibility

### ♿ Accessibility Tests
- Heading structure
- Button accessibility
- Keyboard navigation
- Meta tags and SEO
- Performance metrics
- Console error checking

## Page Object Model

The tests use the Page Object Model pattern for better maintainability:

```typescript
import { MainMenuPage, StoriesPage } from './utils';

test('example', async ({ page }) => {
  const mainMenu = new MainMenuPage(page);
  await mainMenu.goto();
  await mainMenu.clickStartGame();
});
```

## Configuration

The tests are configured to:
- Run on Chromium, Firefox, and WebKit
- Test mobile viewports (Pixel 5, iPhone 12)
- Start the dev server automatically on port 5090
- Generate HTML reports
- Retry failed tests on CI

## CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

The GitHub Actions workflow is in `.github/workflows/playwright.yml`.

## Best Practices

1. **Use Page Objects** - For reusable page interactions
2. **Wait for Elements** - Use proper waiting strategies
3. **Descriptive Tests** - Write clear test descriptions
4. **Parallel Safe** - Ensure tests can run in parallel
5. **Clean State** - Each test should be independent
6. **Responsive Testing** - Test different viewport sizes
7. **Accessibility** - Include accessibility checks

## Debugging

### Visual Debugging
```bash
# Run with headed browser
pnpm test:headed

# Debug mode with step-by-step execution
pnpm test:debug
```

### Screenshots and Videos
```bash
# Take screenshots on failure
npx playwright test --screenshot=only-on-failure

# Record videos
npx playwright test --video=retain-on-failure
```

### Trace Viewer
```bash
# Generate traces
npx playwright test --trace=on

# View traces
npx playwright show-trace trace.zip
```

## Common Issues

### Port Conflicts
If port 5090 is in use, update `playwright.config.ts`:
```typescript
webServer: {
  command: 'pnpm dev --port 3000',
  url: 'http://127.0.0.1:3000',
}
```

### Flaky Tests
Use proper waiting strategies:
```typescript
// Wait for element to be visible
await expect(page.locator('#element')).toBeVisible();

// Wait for network to be idle
await page.waitForLoadState('networkidle');
```

### Test Isolation
Ensure tests don't depend on each other:
```typescript
test.beforeEach(async ({ page }) => {
  // Reset to clean state
  await page.goto('/');
});
```
