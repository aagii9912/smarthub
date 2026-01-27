import { test, expect, Page } from '@playwright/test';

// Skip the onboarding tour by setting localStorage before navigating
async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Product Variants Management', () => {

    test.beforeEach(async ({ page }) => {
        // Skip onboarding tour
        await skipOnboardingTour(page);
        // Authenticated via storageState
        await page.goto('/dashboard/products');
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=Products').or(page.locator('text=Бараа')).first()).toBeVisible({ timeout: 10000 });
    });

    test('Create Product with Variants', async ({ page }) => {
        // 1. Open "New Product" sheet/modal
        // Text is "Шинэ нэмэх" on desktop
        const createBtn = page.locator('button', { hasText: /шинэ нэмэх|нэмэх/i }).first();
        await expect(createBtn).toBeVisible();
        await createBtn.click();

        // 2. Fill Basic Info
        await page.locator('input[name="name"]').fill('Test Variant Product ' + Date.now());
        await page.locator('input[name="price"]').fill('50000');

        // 3. Enable Variants
        // Label: "Олон төрөл/хувилбартай (Өнгө, Размер)"
        // It's a checkbox inside a label
        const variantLabel = page.locator('label').filter({ hasText: /Олон төрөл\/хувилбартай/i });
        await expect(variantLabel).toBeVisible();
        await variantLabel.click();

        // 4. Add Option Group (e.g. Color)
        // Button: "Сонголт нэмэх"
        await page.getByRole('button', { name: 'Сонголт нэмэх' }).click();

        // 5. Fill Option Name (e.g. Color)
        // Input placeholder: "Өнгө" (first one)
        const optionNameInput = page.locator('input[name="option_name_0"]');
        await expect(optionNameInput).toBeVisible();
        await optionNameInput.fill('Color');

        // 6. Add Values (Red, Blue)
        // Input: "option_values_0"
        const valueInput = page.locator('input[name="option_values_0"]');
        await valueInput.fill('Red, Blue'); // Comma separated in the actual component logic
        // Trigger blur to ensure change events (sometimes needed for controlled inputs in frameworks)
        await valueInput.blur();

        // 7. Verify Combinations Generated
        // Button: "Хувилбаруудыг үүсгэх"
        const generateBtn = page.getByRole('button', { name: 'Хувилбаруудыг үүсгэх' });
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // Wait for generation
        await page.waitForTimeout(1000);

        // Verify rows in table inside modal
        const modal = page.locator('div.fixed.z-50');
        await expect(modal.locator('table')).toBeVisible();
        await expect(modal.getByText('Red', { exact: true })).toBeVisible();
        await expect(modal.getByText('Blue', { exact: true })).toBeVisible();

        // 8. Add Second Option Group (Size)
        await page.getByRole('button', { name: 'Сонголт нэмэх' }).click();

        const optionNameInput2 = page.locator('input[name="option_name_1"]');
        await optionNameInput2.fill('Size');

        const valueInput2 = page.locator('input[name="option_values_1"]');
        await valueInput2.fill('S, M');

        // Regenerate
        await generateBtn.click();

        // 9. Verify Matrix (Red / S, Red / M, Blue / S, Blue / M)
        await expect(page.getByText('Red / S')).toBeVisible();
        await expect(page.getByText('Blue / M')).toBeVisible();
    });
});
