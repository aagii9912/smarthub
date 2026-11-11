import { describe, it, expect, vi, beforeEach } from 'vitest';

type Op = { method: string; args: unknown[] };
type Result = { data: unknown; error: unknown };
type Resolver = (table: string, ops: Op[]) => Result;

let resolver: Resolver = () => ({ data: null, error: null });
const fromCalls: Array<{ table: string; ops: Op[] }> = [];

function makeChain(table: string) {
    const ops: Op[] = [];
    fromCalls.push({ table, ops });
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'update']) {
        chain[method] = (...args: unknown[]) => {
            ops.push({ method, args });
            return chain;
        };
    }
    chain.maybeSingle = () => Promise.resolve(resolver(table, ops));
    chain.then = (onFulfilled: (r: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolver(table, ops)).then(onFulfilled, onRejected);
    return chain;
}

const getUserById = vi.fn();

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => ({
        from: (table: string) => makeChain(table),
        auth: { admin: { getUserById: (...args: unknown[]) => getUserById(...args) } },
    }),
}));

const sendPushNotification = vi.fn();
vi.mock('@/lib/notifications', () => ({
    sendPushNotification: (...args: unknown[]) => sendPushNotification(...args),
}));

const sendChannelAlertEmail = vi.fn();
vi.mock('@/lib/email/templates', () => ({
    sendChannelAlertEmail: (...args: unknown[]) => sendChannelAlertEmail(...args),
}));

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));

vi.mock('@/lib/utils/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
    alertIfOrphanedChannel,
    isMissingChannelContextColumn,
    notifyChannelClaimed,
    resetOrphanAlertCache,
    withChannelContext,
    ORPHAN_ALERT_MAX,
} from '@/lib/shop/channelEvents';

const hasOp = (ops: Op[], method: string) => ops.some((o) => o.method === method);

beforeEach(() => {
    vi.clearAllMocks();
    fromCalls.length = 0;
    resetOrphanAlertCache();
    sendPushNotification.mockResolvedValue({ success: 1, failed: 0 });
    sendChannelAlertEmail.mockResolvedValue(true);
    getUserById.mockResolvedValue({ data: { user: { email: 'owner@example.com' } } });
});

describe('isMissingChannelContextColumn', () => {
    it('detects the PostgREST schema-cache error for the context column', () => {
        expect(
            isMissingChannelContextColumn({
                code: 'PGRST204',
                message: "Could not find the 'channel_change_context' column of 'shops' in the schema cache",
            })
        ).toBe(true);
        expect(
            isMissingChannelContextColumn({ code: '42703', message: 'column "channel_change_context" does not exist' })
        ).toBe(true);
    });

    it('ignores other errors', () => {
        expect(isMissingChannelContextColumn(null)).toBe(false);
        expect(isMissingChannelContextColumn({ code: 'PGRST204', message: "Could not find the 'foo' column" })).toBe(false);
        expect(isMissingChannelContextColumn({ code: '23505', message: 'channel_change_context' })).toBe(false);
    });
});

describe('withChannelContext', () => {
    it('runs once without extra fields when there is no context', async () => {
        const run = vi.fn().mockResolvedValue({ error: null });
        await withChannelContext(null, run);
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith({});
    });

    it('passes the context through on success', async () => {
        const run = vi.fn().mockResolvedValue({ error: null });
        const ctx = { source: 'owner_disconnect' as const, actor_user_id: 'u1' };
        await withChannelContext(ctx, run);
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith({ channel_change_context: ctx });
    });

    it('retries without the context when the migration is not applied yet', async () => {
        const run = vi
            .fn()
            .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'channel_change_context' column" } })
            .mockResolvedValueOnce({ error: null });
        const result = await withChannelContext({ source: 'owner_disconnect' }, run);
        expect(run).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenLastCalledWith({});
        expect(result.error).toBeNull();
    });

    it('does not retry on unrelated errors', async () => {
        const error = { code: '23505', message: 'duplicate key' };
        const run = vi.fn().mockResolvedValue({ error });
        const result = await withChannelContext({ source: 'settings_update' }, run);
        expect(run).toHaveBeenCalledTimes(1);
        expect(result.error).toBe(error);
    });
});

describe('notifyChannelClaimed', () => {
    const victim = { id: 'shop-a', name: 'ИТО', user_id: 'owner-a', accountName: 'ITOH Page' };

    it('stays silent when the page moved between shops of the same owner', async () => {
        await notifyChannelClaimed({
            victim,
            claimingShop: { id: 'shop-b', user_id: 'owner-a' },
            platform: 'facebook',
            accountId: 'page-1',
        });
        expect(sendPushNotification).not.toHaveBeenCalled();
        expect(sendChannelAlertEmail).not.toHaveBeenCalled();
    });

    it('alerts the victim owner and admins when another user claims the page', async () => {
        resolver = (table) =>
            table === 'admins'
                ? { data: [{ email: 'admin@syncly.mn' }, { email: 'owner@example.com' }], error: null }
                : { data: null, error: null };

        await notifyChannelClaimed({
            victim,
            claimingShop: { id: 'shop-b', user_id: 'owner-b' },
            platform: 'facebook',
            accountId: 'page-1',
        });

        expect(sendPushNotification).toHaveBeenCalledWith('shop-a', expect.objectContaining({ url: '/dashboard/settings' }));
        const recipients = sendChannelAlertEmail.mock.calls.map((c) => (c[0] as { to: string }).to);
        // Эзэмшигч admin жагсаалтад байсан ч нэг л и-мэйл авна.
        expect(recipients.sort()).toEqual(['admin@syncly.mn', 'owner@example.com']);
    });
});

describe('alertIfOrphanedChannel', () => {
    const event = {
        id: 'evt-1',
        shop_id: 'shop-a',
        platform: 'facebook',
        old_account_name: 'ITOH Page',
        source: null,
        orphan_alerted_at: null,
        orphan_alert_count: 0,
        created_at: '2026-10-09T12:27:00Z',
    };
    const disconnectedShop = {
        id: 'shop-a',
        name: 'ИТО',
        user_id: 'owner-a',
        is_active: true,
        facebook_page_id: null,
        instagram_business_account_id: null,
    };

    function setup(opts: { event?: unknown; shop?: unknown; claimed?: unknown[] }) {
        resolver = (table, ops) => {
            if (table === 'shop_channel_events') {
                if (hasOp(ops, 'update')) return { data: opts.claimed ?? [{ id: 'evt-1' }], error: null };
                return { data: opts.event ?? null, error: null };
            }
            if (table === 'shops') return { data: opts.shop ?? null, error: null };
            if (table === 'admins') return { data: [{ email: 'admin@syncly.mn' }], error: null };
            return { data: null, error: null };
        };
    }

    it('does nothing for a page that was never connected', async () => {
        setup({ event: null });
        await alertIfOrphanedChannel('page-unknown');
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('alerts once and claims the throttle slot for a disconnected page with traffic', async () => {
        setup({ event, shop: disconnectedShop });
        await alertIfOrphanedChannel('page-1');

        expect(sendPushNotification).toHaveBeenCalledTimes(1);
        expect(sendChannelAlertEmail).toHaveBeenCalledTimes(2);

        const claim = fromCalls.find((c) => c.table === 'shop_channel_events' && hasOp(c.ops, 'update'));
        const update = claim?.ops.find((o) => o.method === 'update')?.args[0] as Record<string, unknown>;
        expect(update.orphan_alert_count).toBe(1);
        expect(claim?.ops).toContainEqual({ method: 'eq', args: ['orphan_alert_count', 0] });
    });

    it('skips the DB on repeat webhooks within the local recheck window', async () => {
        setup({ event, shop: disconnectedShop });
        await alertIfOrphanedChannel('page-1');
        const callsAfterFirst = fromCalls.length;
        await alertIfOrphanedChannel('page-1');
        expect(fromCalls.length).toBe(callsAfterFirst);
    });

    it('stops after the maximum number of alerts', async () => {
        setup({ event: { ...event, orphan_alert_count: ORPHAN_ALERT_MAX }, shop: disconnectedShop });
        await alertIfOrphanedChannel('page-1');
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('waits 24h between alerts', async () => {
        setup({
            event: { ...event, orphan_alert_count: 1, orphan_alerted_at: new Date(Date.now() - 60_000).toISOString() },
            shop: disconnectedShop,
        });
        await alertIfOrphanedChannel('page-1');
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('stays silent when the shop has since connected another page', async () => {
        setup({ event, shop: { ...disconnectedShop, facebook_page_id: 'page-2' } });
        await alertIfOrphanedChannel('page-1');
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('stays silent when another instance already claimed the alert', async () => {
        setup({ event, shop: disconnectedShop, claimed: [] });
        await alertIfOrphanedChannel('page-1');
        expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it('never throws, even when the lookup blows up', async () => {
        resolver = () => {
            throw new Error('db down');
        };
        await expect(alertIfOrphanedChannel('page-1')).resolves.toBeUndefined();
    });
});
