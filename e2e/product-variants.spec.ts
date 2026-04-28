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
        // Page title is "Бүтээгдэхүүн"
        await expect(page.getByText(/products|бүтээгдэхүүн/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('Create Product with Variants', async ({ page }) => {
        // 1. Open "New Product" sheet/modal — button text is "Шинэ нэмэх"
        const createBtn = page.locator('button', { hasText: /шинэ нэмэх|нэмэх/i }).first();
        await expect(createBtn).toBeVisible();
        await createBtn.click();

        // Form is in a slide-over/modal. Wait for the name input.
        const nameInput = page.locator('input[name="name"]').first();
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await nameInput.fill('Test Variant Product ' + Date.now());
        await page.locator('input[name="price"]').first().fill('50000');

        // 2. Enable Variants — click the checkbox inside the "Олон төрөл / Хувилбартай" label
        const variantToggle = page.locator('label:has-text("Олон төрөл")').locator('input[type="checkbox"]').first();
        await expect(variantToggle).toBeVisible({ timeout: 5000 });
        await variantToggle.check();

        // 3. Add Option Group — wait for the section to render after the toggle
        const addGroupBtn = page.getByRole('button', { name: /Сонголт нэмэх/i });
        await expect(addGroupBtn).toBeVisible({ timeout: 5000 });
        await addGroupBtn.click();

        // 4. Fill Option Name + Values
        const optionNameInput = page.locator('input[name="option_name_0"]');
        await expect(optionNameInput).toBeVisible();
        await optionNameInput.fill('Color');

        const valueInput = page.locator('input[name="option_values_0"]');
        await valueInput.fill('Red, Blue');
        await valueInput.blur();

        // 5. Click "Хувилбар үүсгэх" (generate)
        const generateBtn = page.getByRole('button', { name: /Хувилбар үүсгэх/i });
        await expect(generateBtn).toBeEnabled();
        await generateBtn.click();

        // Wait for generation
        await page.waitForTimeout(1000);

        // 6. Verify variants table renders with the two variants
        await expect(page.getByText('Red', { exact: true })).toBeVisible();
        await expect(page.getByText('Blue', { exact: true })).toBeVisible();

        // 7. Add second option group (Size) and regenerate
        await page.getByRole('button', { name: /Сонголт нэмэх/i }).click();
        await page.locator('input[name="option_name_1"]').fill('Size');
        await page.locator('input[name="option_values_1"]').fill('S, M');
        await generateBtn.click();
        await page.waitForTimeout(500);

        // 8. Verify matrix combinations
        await expect(page.getByText('Red / S')).toBeVisible();
        await expect(page.getByText('Blue / M')).toBeVisible();
    });
});
