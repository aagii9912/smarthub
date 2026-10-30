import { describe, it, expect } from 'vitest';
import { decideChannel, MESSAGING_WINDOW_MS, renderUtilityBody } from '../deliver';
import { hasAllTemplateParams } from '../utilityTemplates';

const now = new Date('2026-10-10T08:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const base = {
    platform: 'messenger' as const,
    lastInboundAt: hoursAgo(1),
    now,
    hasToken: true,
    hasUtilityTemplate: false,
};

describe('decideChannel', () => {
    it('sends plain text inside the 24h window (Messenger and Instagram)', () => {
        expect(decideChannel(base)).toEqual({ channel: 'text', reason: 'within_window' });
        expect(decideChannel({ ...base, platform: 'instagram' })).toEqual({
            channel: 'text',
            reason: 'within_window',
        });
    });

    it('prefers plain text over a template while the window is open', () => {
        expect(decideChannel({ ...base, hasUtilityTemplate: true }).channel).toBe('text');
    });

    it('treats the last 5 minutes before 24h as closed (clock-skew margin)', () => {
        const justInside = new Date(now.getTime() - MESSAGING_WINDOW_MS + 1000);
        const edge = hoursAgo(24 - 1 / 60); // 23h59m ago
        expect(decideChannel({ ...base, lastInboundAt: justInside }).channel).toBe('text');
        expect(decideChannel({ ...base, lastInboundAt: edge }).channel).toBe('owner');
    });

    it('uses a Utility template outside the window on Messenger', () => {
        expect(
            decideChannel({ ...base, lastInboundAt: hoursAgo(30), hasUtilityTemplate: true }),
        ).toEqual({ channel: 'utility', reason: 'utility_template' });
    });

    it('falls back to the owner outside the window without a template', () => {
        expect(decideChannel({ ...base, lastInboundAt: hoursAgo(30) })).toEqual({
            channel: 'owner',
            reason: 'outside_window_no_template',
        });
        expect(decideChannel({ ...base, lastInboundAt: null })).toEqual({
            channel: 'owner',
            reason: 'outside_window_no_template',
        });
    });

    it('never uses a template on Instagram — owner fallback instead', () => {
        expect(
            decideChannel({
                ...base,
                platform: 'instagram',
                lastInboundAt: hoursAgo(30),
                hasUtilityTemplate: true,
            }),
        ).toEqual({ channel: 'owner', reason: 'outside_window_instagram' });
    });

    it('skips when there is no recipient or no token', () => {
        expect(decideChannel({ ...base, platform: null })).toEqual({
            channel: 'skip',
            reason: 'no_recipient',
        });
        expect(decideChannel({ ...base, hasToken: false })).toEqual({
            channel: 'skip',
            reason: 'no_token',
        });
    });
});

describe('hasAllTemplateParams', () => {
    it('requires every named param to be non-empty', () => {
        expect(hasAllTemplateParams('payment_confirmed', { amount: '50,000', order_ref: 'ab12cd34' })).toBe(true);
        expect(hasAllTemplateParams('payment_confirmed', { amount: '50,000' })).toBe(false);
        expect(hasAllTemplateParams('order_status', { order_ref: 'ab12cd34', status: ' ' })).toBe(false);
    });
});

describe('renderUtilityBody', () => {
    it('fills named params so the inbox shows what the customer received', () => {
        expect(renderUtilityBody('appointment_reminder', { shop: 'Гоо салон', when: '10-р сарын 11, 15:00', service: 'Үс засах' }))
            .toBe('Сануулга: Гоо салон-д 10-р сарын 11, 15:00-д Үс засах цаг захиалгатай байна. Өөрчлөх бол бидэнд бичээрэй.');
    });
});
