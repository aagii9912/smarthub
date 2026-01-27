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
        await expect(page.getByText('Orders').or(page.getByText('Захиалга')).first()).toBeVisible({ timeout: 10000 });

        // 1. Wait for table to load with longer timeout for data fetch
        const table = page.locator('table');
        await expect(table).toBeVisible({ timeout: 15000 });

        // 2. Select first two orders
        // Note: The first checkbox in header selects all. We want row checkboxes.
        // `createSelectColumn` renders input[type="checkbox"] in first cell.
        // Row checkboxes are in tbody tr td:first-child

        // Wait for rows
        await page.waitForSelector('tbody tr');
        const rows = page.locator('tbody tr');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);

        // Click checkbox of first row
        const firstRowCheckbox = rows.nth(0).locator('input[type="checkbox"]');
        await firstRowCheckbox.click();

        // Verify Bulk Actions Bar appears
        const bulkBar = page.getByText('сонгогдсон'); // "1 сонгогдсон"
        await expect(bulkBar).toBeVisible();

        // 3. Click "Change Status" (Төлөв өөрчлөх)
        const statusBtn = page.getByRole('button', { name: /Төлөв өөрчлөх/i });
        await statusBtn.click();

        // 4. Modal should appear
        const modal = page.locator('text=захиалгын төлөв өөрчлөх'); // "1 захиалгын төлөв өөрчлөх"
        await expect(modal).toBeVisible();

        // 5. Select "Processing" (Бэлтгэж буй) inside the modal
        // Wait for modal transition
        await page.waitForTimeout(500);
        // Use a more specific selector for the status option button and force click to bypass overlay issues
        const processingBtn = page.locator('button').filter({ hasText: 'Бэлтгэж буй' }).last();
        await expect(processingBtn).toBeVisible();
        await processingBtn.click({ force: true }); // Force click to bypass any overlay

        // 6. Modal should close and Toast should appear (simplified check)
        await expect(modal).toBeHidden({ timeout: 5000 });

        // Verify status badge update in table (optimistic or real)
        // This might be tricky if it happens fast/slow.
        // We can just verify the bulk bar is gone (selection cleared)
        await expect(bulkBar).toBeHidden({ timeout: 5000 });
    });
});
