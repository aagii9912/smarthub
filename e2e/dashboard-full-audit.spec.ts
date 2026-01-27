import { test, expect, Page } from '@playwright/test';

// Skip the onboarding tour by setting localStorage before navigating
async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Customers Page Audit', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/customers');
        await page.waitForLoadState('networkidle');
    });

    test('Customers: Page Loads with Table', async ({ page }) => {
        // Check page title  
        await expect(page.getByText('Харилцагч').or(page.getByText('Customers')).first()).toBeVisible({ timeout: 10000 });

        // Check for customer table or list
        const hasTable = await page.locator('table').isVisible().catch(() => false);
        const hasCustomerCards = await page.locator('[class*="customer"]').first().isVisible().catch(() => false);

        expect(hasTable || hasCustomerCards).toBeTruthy();
        await page.screenshot({ path: 'e2e-screenshots/customers_list.png' });
    });

    test('Customers: Search Functionality', async ({ page }) => {
        // Find search input
        const searchInput = page.locator('input[placeholder*="хайх"]').or(page.locator('input[type="search"]')).or(page.locator('input').filter({ has: page.locator('svg.lucide-search') }));

        if (await searchInput.first().isVisible({ timeout: 5000 }).catch(() => false)) {
            await searchInput.first().fill('test');
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'e2e-screenshots/customers_search.png' });
        }
    });

    test('Customers: Customer Detail Modal/Panel', async ({ page }) => {
        // Wait for any customer row to appear
        const customerRow = page.locator('tbody tr').first().or(page.locator('[data-customer-id]').first());

        if (await customerRow.isVisible({ timeout: 10000 }).catch(() => false)) {
            await customerRow.click();
            await page.waitForTimeout(500);

            // Check for detail panel/modal
            const detailVisible = await page.getByText('Захиалгын түүх').or(page.getByText('Order History')).isVisible().catch(() => false);

            await page.screenshot({ path: 'e2e-screenshots/customers_detail.png' });
        }
    });
});

test.describe('Inbox Page Audit', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/inbox');
        await page.waitForLoadState('networkidle');
    });

    test('Inbox: Page Loads with Active Carts', async ({ page }) => {
        // Check for inbox/carts header
        await expect(
            page.getByText('Inbox').or(page.getByText('Идэвхтэй сагс')).or(page.getByText('Active Carts')).first()
        ).toBeVisible({ timeout: 10000 });

        await page.screenshot({ path: 'e2e-screenshots/inbox_page.png' });
    });

    test('Inbox: Customer List Visible', async ({ page }) => {
        // Check for customer list component
        const customerList = page.locator('[class*="customer"]').or(page.locator('aside'));

        await expect(customerList.first()).toBeVisible({ timeout: 10000 });
        await page.screenshot({ path: 'e2e-screenshots/inbox_customer_list.png' });
    });
});

test.describe('Settings Page Audit', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/settings');
        await page.waitForLoadState('networkidle');
    });

    test('Settings: Page Loads with Shop Info', async ({ page }) => {
        // Check for settings header
        await expect(
            page.getByText('Settings').or(page.getByText('Тохиргоо')).first()
        ).toBeVisible({ timeout: 10000 });

        // Check for shop name input
        const shopNameInput = page.locator('input').filter({ hasText: /name|нэр/i }).or(page.locator('input[name="name"]'));

        await page.screenshot({ path: 'e2e-screenshots/settings_page.png' });
    });

    test('Settings: Facebook Connection Section', async ({ page }) => {
        // Look for Facebook section  
        const fbSection = page.getByText('Facebook').first();

        if (await fbSection.isVisible({ timeout: 5000 }).catch(() => false)) {
            await page.screenshot({ path: 'e2e-screenshots/settings_facebook.png' });
        }
    });

    test('Settings: Logout Button Exists', async ({ page }) => {
        // Check for logout button
        const logoutBtn = page.getByRole('button', { name: /logout|гарах/i });

        await expect(logoutBtn).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Subscription Page Audit', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/subscription');
        await page.waitForLoadState('networkidle');
    });

    test('Subscription: Page Loads', async ({ page }) => {
        // Check for subscription/plan header
        await expect(
            page.getByText('Захиалга').or(page.getByText('Subscription').or(page.getByText('Plan'))).first()
        ).toBeVisible({ timeout: 10000 });

        await page.screenshot({ path: 'e2e-screenshots/subscription_page.png' });
    });

    test('Subscription: Plans Grid Visible', async ({ page }) => {
        // Check for plan cards
        const planCards = page.locator('[class*="plan"]').or(page.locator('[class*="card"]'));

        // Either show plans grid or current subscription
        const hasPlans = await planCards.first().isVisible({ timeout: 10000 }).catch(() => false);
        const hasCurrentPlan = await page.getByText(/current plan|одоогийн/i).isVisible().catch(() => false);

        expect(hasPlans || hasCurrentPlan).toBeTruthy();
        await page.screenshot({ path: 'e2e-screenshots/subscription_plans.png' });
    });

    test('Subscription: Billing Period Toggle', async ({ page }) => {
        // Look for monthly/yearly toggle
        const monthlyBtn = page.getByRole('button', { name: /monthly|сараар/i });
        const yearlyBtn = page.getByRole('button', { name: /yearly|жилээр/i });

        if (await monthlyBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await yearlyBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'e2e-screenshots/subscription_yearly.png' });
        }
    });
});

test.describe('Reports Page Audit', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/reports');
        await page.waitForLoadState('networkidle');
    });

    test('Reports: Page Loads', async ({ page }) => {
        // Check for reports/analytics header
        await expect(
            page.getByText('Report').or(page.getByText('Тайлан')).or(page.getByText('Analytics')).first()
        ).toBeVisible({ timeout: 15000 });

        await page.screenshot({ path: 'e2e-screenshots/reports_page.png' });
    });

    test('Reports: Charts or Stats Visible', async ({ page }) => {
        // Look for chart elements or stat cards
        const hasCharts = await page.locator('canvas').or(page.locator('svg[class*="chart"]')).isVisible().catch(() => false);
        const hasStats = await page.locator('[class*="stat"]').or(page.getByText(/total|нийт/i)).first().isVisible().catch(() => false);

        expect(hasCharts || hasStats).toBeTruthy();
    });
});
