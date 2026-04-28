import { test, expect, Page } from '@playwright/test';

// Skip the onboarding tour by setting localStorage before navigating
async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Dashboard Orders Bulk Update', () => {

    test.beforeEach(async ({ page }) => {
        // Skip onboarding tour
        await skipOnboardingTour(page);
        // Authenticated via storageState
        await page.goto('/dashboard');
        // Wait for dashboard to load
        await page.waitForLoadState('networkidle');
    });

    test('Bulk Status Update Flow', async ({ page }) => {
        await page.goto('/dashboard/orders');
        // Wait for page to finish loading
        await page.waitForLoadState('networkidle');
        await expect(page.getByText(/orders|захиалга/i).first()).toBeVisible({ timeout: 10000 });

        // The DataTable is `hidden md:block` — only visible on >= 768px. Playwright
        // viewport default is 1280×720 which qualifies.
        const table = page.locator('table');
        await expect(table).toBeVisible({ timeout: 15000 });

        // If the test user has no orders, the data row will be missing.
        // Skip the bulk flow rather than fail — bulk-update logic is exercised
        // by Vitest in OrderService.bulk.test.ts.
        await page.waitForTimeout(1500);
        const rowCheckboxes = page.locator('tbody tr td input[type="checkbox"]');
        const checkboxCount = await rowCheckboxes.count();
        if (checkboxCount === 0) {
            test.skip(true, 'No orders for test user — bulk flow covered by unit tests');
        }

        // Click checkbox of first row
        await rowCheckboxes.first().click();

        // Verify Bulk Actions Bar appears
        const bulkBar = page.getByText('сонгогдсон'); // "1 сонгогдсон"
        await expect(bulkBar).toBeVisible({ timeout: 5000 });

        // Click "Change Status" (Төлөв өөрчлөх)
        const statusBtn = page.getByRole('button', { name: /Төлөв өөрчлөх/i });
        await statusBtn.click();

        // Modal should appear with the "X захиалгын төлөв өөрчлөх" heading
        const modalHeading = page.getByText(/захиалгын төлөв өөрчлөх/i);
        await expect(modalHeading).toBeVisible({ timeout: 5000 });

        // Select "Бэлтгэж буй" (Processing) inside the modal
        await page.waitForTimeout(500);
        const processingBtn = page.locator('button').filter({ hasText: 'Бэлтгэж буй' }).last();
        await expect(processingBtn).toBeVisible();
        await processingBtn.click({ force: true });

        // Modal closes after the bulk update completes
        await expect(modalHeading).toBeHidden({ timeout: 5000 });

        // Selection clears
        await expect(bulkBar).toBeHidden({ timeout: 5000 });
    });
});
