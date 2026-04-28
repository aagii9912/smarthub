/**
 * Playwright auth setup
 *
 * Mints a Supabase session for the test user via service-role
 * `generateLink`, follows the verification redirect, extracts tokens from
 * the URL hash, then injects them into localhost cookies + localStorage so
 * authenticated specs can run against the local dev server. The Supabase
 * client picks up the session on first request.
 *
 * Required env (in .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - PLAYWRIGHT_TEST_EMAIL    (defaults to aagii9912@gmail.com)
 */
import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const STORAGE = path.resolve(process.cwd(), 'playwright/.auth/user.json');

setup('authenticate test user', async ({ page, context }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const email = process.env.PLAYWRIGHT_TEST_EMAIL || 'aagii9912@gmail.com';

    if (!supabaseUrl || !serviceKey) {
        throw new Error('Missing Supabase env vars for auth setup');
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Step 1: ask Supabase to generate a magic link for our test user
    const { data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });
    if (error || !data.properties?.action_link) {
        throw new Error(`generateLink failed: ${error?.message || 'no link'}`);
    }

    // Step 2: follow the verify URL. Supabase redirects to its configured
    // site_url with #access_token=...&refresh_token=... in the hash.
    // We accept any final URL — we only need the hash.
    await page.goto(data.properties.action_link, { waitUntil: 'load' });
    const finalUrl = page.url();
    const hashIdx = finalUrl.indexOf('#');
    if (hashIdx === -1) {
        throw new Error(`No tokens in redirect URL: ${finalUrl}`);
    }
    const params = new URLSearchParams(finalUrl.slice(hashIdx + 1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
        throw new Error('Magic-link redirect did not include access/refresh tokens');
    }

    // Step 3: derive the project ref so we can name the cookie correctly.
    // Supabase auth cookie format: sb-<project-ref>-auth-token
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
    const cookieName = `sb-${projectRef}-auth-token`;

    // Step 4: navigate to the local app first, then inject the session.
    await page.goto('http://localhost:4001/');

    // Set localStorage in the same shape supabase-js expects.
    const sessionPayload = {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'bearer',
        expires_in: parseInt(params.get('expires_in') || '3600', 10),
        expires_at: parseInt(params.get('expires_at') || '0', 10),
        user: null,
    };
    await page.evaluate(
        ([key, payload]) => {
            window.localStorage.setItem(key, JSON.stringify(payload));
        },
        [cookieName, sessionPayload] as const
    );

    // Set the auth cookie too (server-side reads it via @supabase/ssr).
    await context.addCookies([
        {
            name: cookieName,
            value: 'base64-' + Buffer.from(JSON.stringify(sessionPayload)).toString('base64'),
            domain: 'localhost',
            path: '/',
            expires: parseInt(params.get('expires_at') || '0', 10) || -1,
            httpOnly: false,
            secure: false,
            sameSite: 'Lax',
        },
    ]);

    // Step 5: hit a known authed page to confirm the session sticks.
    await page.goto('http://localhost:4001/dashboard');
    // Either we land on /dashboard (auth ok) or get bounced to /auth/login (auth bad)
    const url = page.url();
    expect(url, `Auth setup did not produce a working session, ended at: ${url}`)
        .not.toMatch(/\/auth\/login/);

    await context.storageState({ path: STORAGE });
});
