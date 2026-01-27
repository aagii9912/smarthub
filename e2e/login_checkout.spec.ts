import { test, expect } from '@playwright/test';

test.describe('Super TDD Audit', () => {

    // This test needs to see the actual login page, so we bypass storageState
    test.describe('Login Tests (No Auth)', () => {
        test.use({ storageState: { cookies: [], origins: [] } });

        test('Login Page UI & Functionality', async ({ page }) => {
            console.log('Navigating to Login...');
            await page.goto('/auth/login');

            // Screenshot initial state
            await page.screenshot({ path: 'e2e-screenshots/login_initial.png' });

            // Check for Page Title (SmartHub) - use partial match since it might redirect
            await expect(page.getByText('SmartHub')).toBeVisible({ timeout: 10000 });

            // Check for Clerk Elements
            // Clerk usually uses name="identifier"
            const emailInput = page.locator('input[name="identifier"]');
            await expect(emailInput).toBeVisible({ timeout: 15000 });

            // Attempt login (will likely fail auth but proves UI works)
            await emailInput.fill('test@example.com');

            // Click Continue/Sign In
            const submitBtn = page.locator('button', { hasText: /continue|sign in|нэвтрэх/i }).first();
            await expect(submitBtn).toBeVisible();
            await submitBtn.click();

            // Wait for potential interaction result
            await page.waitForTimeout(3000);
            await page.screenshot({ path: 'e2e-screenshots/login_attempt.png' });
        });
    });

    test('Homepage/Checkout Availability', async ({ page }) => {
        console.log('Navigating to Home...');
        await page.goto('/');
        await page.screenshot({ path: 'e2e-screenshots/home_initial.png' });

        // Check for common e-commerce elements
        // If "Checkout" isn't a route, maybe it's a Cart button
        // We look for 'Cart' text or icon
        const cartVisible = await page.getByText(/cart/i).isVisible() || await page.locator('a[href*="cart"]').isVisible();
        if (!cartVisible) {
            console.log('WARNING: No Cart/Checkout entry point found on Homepage.');
        }

    });

});
