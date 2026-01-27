import { test, expect } from '@playwright/test';

test.describe('UI Playground Audit', () => {

    test('UI Playground Access and Components', async ({ page }) => {
        // Navigate to UI Playground
        await page.goto('/test-ui');

        // Expect Title
        await expect(page.getByText('UI Playground')).toBeVisible();
        await page.screenshot({ path: 'e2e-screenshots/ui_playground_initial.png' });

        // Test Cart Interaction
        await expect(page.getByText('Cart Summary')).toBeVisible();

        // Open Cart using correct Mongolian text "Харах"
        await page.getByRole('button', { name: 'Харах' }).click();

        // Check for specific cart items from the mock state (iPhone 15 Pro Max)
        await expect(page.getByText('iPhone 15 Pro Max')).toBeVisible();
        await page.screenshot({ path: 'e2e-screenshots/ui_playground_cart_open.png' });

        // Close Cart
        await page.keyboard.press('Escape');
    });

    test('Chat Component Interaction', async ({ page }) => {
        await page.goto('/test-ui');

        // Check Chat Container
        await expect(page.getByText('AI Business Assistant')).toBeVisible();

        // Test Quick Reply "Үнэ асуух"
        const quickReply = page.locator('button', { hasText: 'Үнэ асуух' }).first();
        if (await quickReply.isVisible()) {
            await quickReply.click();
            // Expect user message to appear - check for text existence
            await expect(page.getByText('Үнэ асуух', { exact: true }).last()).toBeVisible();
        }

        await page.screenshot({ path: 'e2e-screenshots/ui_playground_chat.png' });
    });

});
