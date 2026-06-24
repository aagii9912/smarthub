/**
 * Dashboard archetype screenshots
 *
 * Captures the business-model-aware dashboard for every archetype by
 * temporarily flipping the test shop's `business_type` + `ai_agent_capabilities`
 * (the discriminator `resolveArchetype` reads), reloading /dashboard and
 * /dashboard/reports, and screenshotting each. The shop's original config is
 * restored at the end.
 *
 * Prereq:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   - auth.setup.ts has produced playwright/.auth/user.json (storageState)
 *   - the test user owns at least one shop
 *
 * Run:
 *   npx playwright test e2e/dashboard-archetypes.spec.ts --project=chromium
 *
 * Output: screenshots/dashboard-<archetype>.png and screenshots/reports-<archetype>.png
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

interface ArchetypeCase {
    key: string;
    business_type: string;
    capabilities: string[];
}

// One representative business_type per archetype (+ a hybrid that triggers the
// "More insights" secondary blocks).
const CASES: ArchetypeCase[] = [
    { key: 'commerce', business_type: 'retail', capabilities: ['sales', 'support'] },
    { key: 'booking', business_type: 'service', capabilities: ['booking', 'information'] },
    { key: 'lead', business_type: 'realestate_auto', capabilities: ['lead_capture', 'information'] },
    { key: 'hybrid-restaurant', business_type: 'restaurant', capabilities: ['sales', 'booking', 'information'] },
];

const SHOTS = path.resolve(process.cwd(), 'screenshots');

test.describe('Dashboard archetype screenshots', () => {
    // Sequential — each case mutates the shared shop row.
    test.describe.configure({ mode: 'serial' });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let shopId = '';
    let original: { business_type: string | null; ai_agent_capabilities: string[] | null } | null = null;

    test.beforeAll(async ({ browser }) => {
        if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars');

        // Resolve the test shop via the authenticated /api/features endpoint.
        const ctx = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
        const page = await ctx.newPage();
        await page.goto('/dashboard');
        const feat = await page.request.get('/api/features').then((r) => r.json());
        shopId = feat.shopId;
        await ctx.close();
        expect(shopId, 'Test user has no shop — cannot screenshot dashboards').toBeTruthy();

        // Snapshot the shop's real config so we can restore it afterwards.
        const { data } = await admin
            .from('shops')
            .select('business_type, ai_agent_capabilities')
            .eq('id', shopId)
            .single();
        original = data;
    });

    test.afterAll(async () => {
        // Restore the shop's original archetype config.
        if (shopId && original) {
            await admin
                .from('shops')
                .update({
                    business_type: original.business_type,
                    ai_agent_capabilities: original.ai_agent_capabilities,
                })
                .eq('id', shopId);
        }
    });

    for (const c of CASES) {
        test(`capture ${c.key}`, async ({ page }) => {
            // Flip the shop into this archetype.
            await admin
                .from('shops')
                .update({ business_type: c.business_type, ai_agent_capabilities: c.capabilities })
                .eq('id', shopId);

            // Ensure the active-shop id is set before any app code runs.
            await page.addInitScript((id) => {
                localStorage.setItem('smarthub_active_shop_id', id);
            }, shopId);

            // Dashboard overview
            await page.goto('/dashboard');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500); // let KPIs / charts settle
            await page.screenshot({ path: path.join(SHOTS, `dashboard-${c.key}.png`), fullPage: true });

            // Reports (archetype tab is default for booking/lead)
            await page.goto('/dashboard/reports');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            await page.screenshot({ path: path.join(SHOTS, `reports-${c.key}.png`), fullPage: true });
        });
    }
});
