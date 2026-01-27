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
        await expect(page.getByText('Products').or(page.getByText('Бараа')).first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('table')).toBeVisible({ timeout: 10000 }); // Expect a table of products
        await page.screenshot({ path: 'e2e-screenshots/dashboard_products.png' });
    });

    test('Orders: Navigation and List', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/orders');
        await page.waitForLoadState('networkidle');
        await expect(page.getByText('Orders').or(page.getByText('Захиалга')).first()).toBeVisible({ timeout: 10000 });
        await page.screenshot({ path: 'e2e-screenshots/dashboard_orders.png' });
    });

    test('AI Settings: Check Controls', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/ai-settings');
        // Wait for page to finish loading (dismiss any loading spinners)
        await page.waitForLoadState('networkidle');
        // The AI toggle is a custom button (w-14 h-8 rounded-full), not a native switch
        // Look for the toggle button next to "AI-г идэвхжүүлэх" text
        await expect(page.locator('button.rounded-full.w-14.h-8')).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: 'e2e-screenshots/dashboard_ai_settings.png' });
    });
});

