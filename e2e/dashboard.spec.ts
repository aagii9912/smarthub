import { test, expect, Page } from '@playwright/test';

// Uses storageState from playwright.config.ts for authentication
// No beforeEach login needed - user is pre-authenticated via saved session

// Skip the onboarding tour by setting localStorage before navigating
async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Dashboard Audit', () => {

    test('Products: Navigation and List', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/products');
        await page.waitForLoadState('networkidle');
        // Page title is "Бүтээгдэхүүн" (with eyebrow "Бүтээгдэхүүний каталог")
        await expect(page.getByText(/бүтээгдэхүүн|products/i).first()).toBeVisible({ timeout: 10000 });
        // Products may render in a grid or table; just confirm we did not land on /auth/login
        expect(page.url()).toContain('/dashboard/products');
        await page.screenshot({ path: 'e2e-screenshots/dashboard_products.png' });
    });

    test('Orders: Navigation and List', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/orders');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/orders|захиалга/i).first()).toBeVisible({ timeout: 10000 });
        await page.screenshot({ path: 'e2e-screenshots/dashboard_orders.png' });
    });

    test('AI Settings: Check Controls', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/ai-settings');
        // Wait for page to finish loading (dismiss any loading spinners)
        await page.waitForLoadState('networkidle');
        // The AI toggle is a custom rounded-full button. Selector is intentionally
        // permissive — we just want SOME toggle button on the page.
        const toggle = page.locator('button.rounded-full').first();
        await expect(toggle).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: 'e2e-screenshots/dashboard_ai_settings.png' });
    });
});

