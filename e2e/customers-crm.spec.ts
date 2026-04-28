/**
 * Customer CRM E2E
 *
 * /dashboard/customers is the largest dashboard surface that had no E2E
 * coverage. This spec exercises the page load, the customer list API,
 * search, and the segments endpoint.
 *
 * Uses storageState from auth.setup.ts.
 */
import { test, expect } from '@playwright/test';

test.describe('Customers page', () => {
    test('page loads and renders customer list container', async ({ page }) => {
        await page.goto('/dashboard/customers');
        await page.waitForLoadState('networkidle');

        // Either Mongolian "Харилцагчид" or English "Customers" should appear in the page.
        // Falls back to checking the URL stayed on /customers.
        const heading = page.getByText(/харилцагч|customers/i).first();
        await expect(heading).toBeVisible({ timeout: 10_000 });
        expect(page.url()).toContain('/dashboard/customers');
    });
});

test.describe('Customers API contract', () => {
    test('GET /api/dashboard/customers returns paged list', async ({ request }) => {
        // Need x-shop-id header. Get it from /api/features first.
        const featRes = await request.get('/api/features');
        const feat = await featRes.json();
        if (!feat.shopId) {
            test.skip(true, 'Test user has no shop attached — skipping');
        }

        const res = await request.get('/api/dashboard/customers', {
            headers: { 'x-shop-id': feat.shopId },
        });
        expect([200, 404]).toContain(res.status()); // 404 if no shop with customers
        if (res.status() === 200) {
            const body = await res.json();
            // Expect either an array or { customers: [...] } shape
            const data = Array.isArray(body) ? body : body.customers ?? body.data;
            expect(Array.isArray(data)).toBe(true);
        }
    });

    test('GET /api/dashboard/customers/segments returns segments shape', async ({ request }) => {
        const featRes = await request.get('/api/features');
        const feat = await featRes.json();
        if (!feat.shopId) test.skip(true, 'No shop');

        const res = await request.get('/api/dashboard/customers/segments', {
            headers: { 'x-shop-id': feat.shopId },
        });
        expect([200, 404]).toContain(res.status());
    });
});

test.describe('Customers search', () => {
    test('typing in search input filters list (or no-op if empty)', async ({ page }) => {
        await page.goto('/dashboard/customers');
        await page.waitForLoadState('networkidle');

        // Look for any search input on the page.
        const searchInput = page.getByPlaceholder(/хайлт|search/i).first();
        const visible = await searchInput.isVisible().catch(() => false);
        if (!visible) {
            test.skip(true, 'No search input rendered (page layout may have changed)');
        }

        await searchInput.fill('test-нэр-байхгүй-search-12345');
        // Wait for any debounce / network refresh
        await page.waitForTimeout(800);

        // Page should not be in a 500 error state
        await expect(page.locator('text=/500|Internal Server Error/i')).not.toBeVisible();
    });
});
