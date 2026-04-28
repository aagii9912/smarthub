/**
 * Webhook security E2E
 *
 * Protects the money path: every Meta payload to /api/webhook must pass
 * X-Hub-Signature-256 verification before reaching the AI router. Tests
 * cover GET verification (verify_token) and POST signature validation
 * for both Facebook and Instagram secrets.
 */
import { test, expect } from '@playwright/test';
import * as crypto from 'crypto';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
const FB_SECRET = process.env.FACEBOOK_APP_SECRET;
const IG_SECRET = process.env.INSTAGRAM_APP_SECRET;

function sign(body: string, secret: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

test.describe('Webhook GET (verify_token challenge)', () => {
    test('returns challenge when verify_token matches', async ({ request }) => {
        test.skip(!VERIFY_TOKEN, 'FACEBOOK_VERIFY_TOKEN not configured');
        const challenge = String(Date.now());
        const res = await request.get('/api/webhook', {
            params: {
                'hub.mode': 'subscribe',
                'hub.verify_token': VERIFY_TOKEN!,
                'hub.challenge': challenge,
            },
        });
        expect(res.status()).toBe(200);
        const body = await res.text();
        expect(body).toBe(challenge);
    });

    test('rejects wrong verify_token', async ({ request }) => {
        test.skip(!VERIFY_TOKEN, 'FACEBOOK_VERIFY_TOKEN not configured');
        const res = await request.get('/api/webhook', {
            params: {
                'hub.mode': 'subscribe',
                'hub.verify_token': 'definitely-not-the-token',
                'hub.challenge': 'x',
            },
        });
        expect(res.status()).not.toBe(200);
    });
});

test.describe('Webhook POST (signature security)', () => {
    const samplePayload = {
        object: 'page',
        entry: [
            {
                id: 'PAGE_ID_TEST_E2E',
                time: 1700000000,
                messaging: [
                    {
                        sender: { id: 'CUSTOMER_TEST_E2E' },
                        recipient: { id: 'PAGE_ID_TEST_E2E' },
                        timestamp: 1700000000,
                        message: { mid: 'mid_test', text: 'Сайн уу' },
                    },
                ],
            },
        ],
    };
    const body = JSON.stringify(samplePayload);

    test('rejects POST without signature header', async ({ request }) => {
        const res = await request.post('/api/webhook', {
            data: body,
            headers: { 'content-type': 'application/json' },
        });
        expect(res.status()).toBe(401);
    });

    test('rejects POST with malformed signature', async ({ request }) => {
        const res = await request.post('/api/webhook', {
            data: body,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': 'sha256=not-valid-hex',
            },
        });
        expect(res.status()).toBe(401);
    });

    test('rejects POST signed with wrong secret', async ({ request }) => {
        const res = await request.post('/api/webhook', {
            data: body,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': sign(body, 'wrong-secret-12345'),
            },
        });
        expect(res.status()).toBe(401);
    });

    test('accepts POST with valid Facebook signature (graceful when no shop matches)', async ({ request }) => {
        test.skip(!FB_SECRET, 'FACEBOOK_APP_SECRET not configured');

        const res = await request.post('/api/webhook', {
            data: body,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': sign(body, FB_SECRET!),
            },
        });
        // Page id is fake, so no shop will match — handler returns 200 with success:true
        // (signature verification passed, business logic is a no-op)
        expect([200, 202]).toContain(res.status());
    });

    test('accepts POST with valid Instagram signature', async ({ request }) => {
        test.skip(!IG_SECRET, 'INSTAGRAM_APP_SECRET not configured');

        const igPayload = JSON.stringify({
            ...samplePayload,
            object: 'instagram',
        });
        const res = await request.post('/api/webhook', {
            data: igPayload,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': sign(igPayload, IG_SECRET!),
            },
        });
        expect([200, 202]).toContain(res.status());
    });

    test('rejects POST with invalid object type', async ({ request }) => {
        test.skip(!FB_SECRET, 'FACEBOOK_APP_SECRET not configured');

        const badPayload = JSON.stringify({ object: 'not-a-real-object', entry: [] });
        const res = await request.post('/api/webhook', {
            data: badPayload,
            headers: {
                'content-type': 'application/json',
                'x-hub-signature-256': sign(badPayload, FB_SECRET!),
            },
        });
        expect(res.status()).toBe(400);
    });
});
