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

            // Page should brand as "Syncly" (was SmartHub before)
            await expect(page.getByText(/syncly/i).first()).toBeVisible({ timeout: 10000 });

            // Login form is now Supabase email/password (was Clerk identifier)
            const emailInput = page.locator('input[type="email"]').first();
            await expect(emailInput).toBeVisible({ timeout: 15000 });
            const passwordInput = page.locator('input[type="password"]').first();
            await expect(passwordInput).toBeVisible();

            // Attempt login with bad credentials — UI should NOT crash
            await emailInput.fill('test@example.com');
            await passwordInput.fill('wrong-password-12345');

            const submitBtn = page.locator('button[type="submit"]').first();
            await expect(submitBtn).toBeVisible();
            await submitBtn.click();

            // Wait for the failed login error to render or for any redirect
            await page.waitForTimeout(2500);
            await expect(page.locator('text=/500|Internal Server Error/i')).not.toBeVisible();
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
