import { test, expect, Page } from '@playwright/test';

/**
 * Comment Automation page — locale-agnostic smoke test.
 *
 * Auth is preloaded via storageState (see playwright.config.ts), so no login
 * step is needed. We use `getByText(MN).or(getByText(EN))` for any visible
 * label so the test passes whichever language the saved storageState happens
 * to land in.
 */

async function skipOnboardingTour(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('smarthub_tour_completed', 'true');
    });
}

test.describe('Comment Automation', () => {
    test('page loads with hero, count chip, and create button', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/comment-automation');
        await page.waitForLoadState('networkidle');

        // Page hero title
        await expect(
            page.getByText('Comment Удирдлага').or(page.getByText('Comment Automation')).first()
        ).toBeVisible({ timeout: 15000 });

        // The "create" CTA in the hero — text varies between empty-state ("Эхлэх" /
        // "Get started") and the toolbar ("Шинэ Automation" / "New automation"),
        // so accept either.
        const createCta = page
            .getByRole('button', { name: /Шинэ Automation|New automation|Эхлэх|Get started/i })
            .first();
        await expect(createCta).toBeVisible({ timeout: 10000 });

        await page.screenshot({ path: 'e2e-screenshots/comment_automation_index.png' });
    });

    test('opens the create form and renders all required fields', async ({ page }) => {
        await skipOnboardingTour(page);
        await page.goto('/dashboard/comment-automation');
        await page.waitForLoadState('networkidle');

        const createCta = page
            .getByRole('button', { name: /Шинэ Automation|New automation|Эхлэх|Get started/i })
            .first();
        await createCta.click();

        // Form section header — "Шинэ Automation" / "New automation"
        await expect(
            page.getByText(/Шинэ Automation|New automation/i).first()
        ).toBeVisible({ timeout: 5000 });

        // Required field labels (uppercase tracking-style labels render as plain
        // text — we just match the text content).
        await expect(page.getByText(/^Нэр$|^Name$/i).first()).toBeVisible();
        await expect(page.getByText(/Платформ|Platform/i).first()).toBeVisible();
        await expect(page.getByText(/Түлхүүр үгс|Trigger keywords/i).first()).toBeVisible();
        await expect(page.getByText(/Тааруулах арга|Match type/i).first()).toBeVisible();
        await expect(page.getByText(/Үйлдэл|Action$/i).first()).toBeVisible();

        // Submit button is disabled while the form is empty
        const submit = page
            .getByRole('button', { name: /Үүсгэх|Create|Шинэчлэх|Update/i })
            .last();
        await expect(submit).toBeDisabled();

        await page.screenshot({ path: 'e2e-screenshots/comment_automation_form.png' });
    });
});
