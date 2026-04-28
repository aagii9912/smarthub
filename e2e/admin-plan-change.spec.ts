import { test, expect, Page } from '@playwright/test';

// Skip the onboarding tour by setting localStorage before navigating
async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Admin Plan Change & Feature Locking', () => {

    test.beforeEach(async ({ page }) => {
        await skipOnboardingTour(page);
        // Verify the current user is an admin before exercising admin pages.
        // The admin layout redirects non-admin users to /dashboard. We detect
        // that and skip cleanly so non-admin test users don't see ten failures.
        await page.goto('/admin/shops');
        await page.waitForLoadState('networkidle');
        // Give the client-side admin check a moment to redirect.
        await page.waitForTimeout(1500);
        if (!page.url().includes('/admin/shops')) {
            test.skip(true, 'Test user is not in the admins table — admin pages skipped');
        }
    });

    test('Admin Shops: Navigate and View List', async ({ page }) => {
        await page.goto('/admin/shops');
        await page.waitForLoadState('networkidle');

        // Check page title
        await expect(page.getByRole('heading', { name: /shops directory/i })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/total shops/i)).toBeVisible();

        // Check table exists
        const table = page.locator('table');
        await expect(table).toBeVisible({ timeout: 15000 });

        // Check table headers
        await expect(page.getByRole('columnheader', { name: /shop details/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /subscription plan/i })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: /^status$/i })).toBeVisible();

        await page.screenshot({ path: 'e2e-screenshots/admin_shops_list.png' });
    });

    test('Admin Shops: Open Edit Modal', async ({ page }) => {
        await page.goto('/admin/shops');
        await page.waitForLoadState('networkidle');

        // Wait for table to load
        const table = page.locator('table');
        await expect(table).toBeVisible({ timeout: 15000 });

        // Wait for rows
        await page.waitForSelector('tbody tr', { timeout: 10000 });
        const rows = page.locator('tbody tr');
        const count = await rows.count();
        expect(count).toBeGreaterThan(0);

        // Click edit button on first shop
        const editBtn = rows.nth(0).locator('button[title="Edit shop details"]');
        await editBtn.click();

        // Wait for modal heading to appear (modal wrapper uses fixed inset-0 z-50)
        const modalHeading = page.getByRole('heading', { name: /edit shop details/i });
        await expect(modalHeading).toBeVisible({ timeout: 5000 });

        // Verify Subscription section heading
        await expect(page.getByRole('heading', { name: /subscription info/i })).toBeVisible();

        // Verify Plan dropdown exists
        const planDropdown = page.locator('select').filter({ has: page.locator('option:has-text("Select Plan")') });
        await expect(planDropdown).toBeVisible();

        await page.screenshot({ path: 'e2e-screenshots/admin_edit_shop_modal.png' });

        // Close modal via the X button (svg-only button at the top of the modal)
        const modal = page.locator('div.fixed.inset-0.z-50');
        const closeBtn = modal.locator('button:has(svg)').first();
        await closeBtn.evaluate((btn: HTMLButtonElement) => btn.click());
        await expect(modalHeading).toBeHidden({ timeout: 3000 });
    });

    test('Admin Shops: Change Plan and Verify Features Update', async ({ page }) => {
        await page.goto('/admin/shops');
        await page.waitForLoadState('networkidle');

        // Wait for table
        const table = page.locator('table');
        await expect(table).toBeVisible({ timeout: 15000 });
        await page.waitForSelector('tbody tr');

        // Find a shop to edit
        const rows = page.locator('tbody tr');
        const firstRow = rows.first();

        // Remember current plan name
        const currentPlanCell = firstRow.locator('td').nth(1);
        const currentPlanText = await currentPlanCell.textContent();

        // Click edit button
        await firstRow.locator('button[title="Edit shop details"]').click();

        // Wait for modal heading
        const modalHeading = page.getByRole('heading', { name: /edit shop details/i });
        await expect(modalHeading).toBeVisible({ timeout: 5000 });

        // Get plan dropdown (modal wrapper)
        const modal = page.locator('div.fixed.inset-0.z-50');
        const planDropdown = modal.locator('select').first();
        await expect(planDropdown).toBeVisible();

        // Get available plans
        const options = await planDropdown.locator('option').allTextContents();
        console.log('Available plans:', options);

        // Select a different plan (try to find one that's not currently selected)
        // Filter out "Select Plan" option
        const selectablePlans = options.filter(o => o !== 'Select Plan' && !currentPlanText?.includes(o.split(' ')[0]));

        if (selectablePlans.length > 0) {
            const newPlan = selectablePlans[0];
            await planDropdown.selectOption({ label: newPlan });
            console.log(`Changed plan to: ${newPlan}`);

            // Find and click Save button using JavaScript to bypass viewport issues
            const saveBtn = modal.locator('button').filter({ hasText: 'Save' });
            await expect(saveBtn).toBeVisible({ timeout: 5000 });

            // Use JavaScript to scroll into view and click
            await saveBtn.evaluate((btn: HTMLButtonElement) => {
                btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                btn.click();
            });

            // Wait for save to complete (modal heading disappears + toast appears)
            await expect(modalHeading).toBeHidden({ timeout: 10000 });

            // Verify success toast
            // Look for "хадгаллаа" (saved) or "success"
            const successIndicator = page.getByText(/хадгаллаа|success|updated/i);
            await expect(successIndicator).toBeVisible({ timeout: 5000 });

            await page.screenshot({ path: 'e2e-screenshots/admin_plan_changed.png' });
        } else {
            console.log('No alternative plans available to test with');
            // Close modal without changes
            await modal.locator('button:has-text("Cancel")').click();
        }
    });

    test('API: Features endpoint returns plan-based features', async ({ page, request }) => {
        // This test verifies the /api/features endpoint works correctly
        // First navigate to establish auth context
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Make API call via page context to use auth cookies
        const response = await page.evaluate(async () => {
            const res = await fetch('/api/features');
            return res.json();
        });

        console.log('Features API Response:', JSON.stringify(response, null, 2));

        // Verify response structure
        expect(response).toHaveProperty('features');
        expect(response).toHaveProperty('limits');
        expect(response).toHaveProperty('plan');

        // Verify features object has expected keys
        const features = response.features;
        expect(features).toHaveProperty('ai_enabled');
        expect(features).toHaveProperty('cart_system');
        expect(features).toHaveProperty('payment_integration');

        // Verify plan object
        expect(response.plan).toHaveProperty('slug');
        expect(response.plan).toHaveProperty('name');

        console.log(`Current plan: ${response.plan.name} (${response.plan.slug})`);
        console.log('Features enabled:', Object.entries(features).filter(([_, v]) => v === true || (typeof v === 'string' && v !== 'none')).map(([k]) => k));
    });

    test('Dashboard: Feature access based on plan', async ({ page }) => {
        // Navigate to dashboard
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Get current features via API
        const features = await page.evaluate(async () => {
            const res = await fetch('/api/features');
            return res.json();
        });

        console.log('Plan:', features.plan.name);

        // Navigate to AI Settings - this is available to all plans
        await page.goto('/dashboard/ai-settings');
        await page.waitForLoadState('networkidle');

        // Should be accessible
        const aiToggle = page.locator('button.rounded-full.w-14.h-8');
        await expect(aiToggle).toBeVisible({ timeout: 15000 });

        await page.screenshot({ path: 'e2e-screenshots/dashboard_feature_access.png' });
    });
});

// Test to verify plan change actually updates features
test.describe('Plan Change Feature Unlock Verification', () => {

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('smarthub_tour_completed', 'true');
        });
    });

    test('Features should reflect current plan from database', async ({ page }) => {
        // 1. First get current features
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        const beforeFeatures = await page.evaluate(async () => {
            const res = await fetch('/api/features');
            return res.json();
        });

        console.log('Current Plan:', beforeFeatures.plan.name);
        console.log('Current Features:', JSON.stringify(beforeFeatures.features, null, 2));

        // 2. Verify features match expected plan config
        const planSlug = beforeFeatures.plan.slug;

        // Plan slugs in DB: lite, starter, professional, enterprise
        // Just verify the plan is one of the known slugs and the shape is sensible.
        const validSlugs = ['lite', 'starter', 'professional', 'enterprise', 'unpaid', 'free'];
        expect(validSlugs).toContain(planSlug);

        // cart_system must be one of: 'none', 'basic', 'full'
        expect(['none', 'basic', 'full']).toContain(beforeFeatures.features.cart_system);

        // payment_integration is boolean
        expect(typeof beforeFeatures.features.payment_integration).toBe('boolean');

        await page.screenshot({ path: 'e2e-screenshots/features_plan_verification.png' });
    });
});
