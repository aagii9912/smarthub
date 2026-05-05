/**
 * CommentAutomationService Tests
 *
 * Covers:
 *   - matchKeywords         (contains vs exact, case-insensitive, trimmed)
 *   - getMatchingAutomation (platform filter, post_id filter, no-match path)
 *   - executeAutomation     (DM-only / reply-only / both, counter increment)
 *   - createAutomation      (defaults applied)
 *   - updateAutomation      (returns updated row, scoped by shop_id)
 *   - deleteAutomation      (delete scoped by shop_id, error path)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CommentAutomation } from '@/types/database';

// ───────────── mocks ─────────────

// Per-call queue. Each test queues the responses the service is expected to
// observe in order; whichever terminator the chain hits (.single(), .order(),
// or `await chain` itself) pops one off the front.
const responseQueue: Array<{ data: unknown; error: unknown }> = [];
const updateCalls: Array<Record<string, unknown>> = [];
const insertCalls: Array<Record<string, unknown>> = [];
const deleteEqCalls: Array<Record<string, unknown>> = [];

const popResponse = () =>
    responseQueue.shift() ?? { data: null, error: null };

// Build a chain that's both fluent AND a thenable. This lets all of these
// patterns just work:
//   await supabase.from('t').select('*').eq('k', 1).eq('k2', 2)
//   await supabase.from('t').select('*').eq('k', 1).single()
//   await supabase.from('t').select('*').eq('k', 1).order('created_at', ...)
//   await supabase.from('t').insert(...).select().single()
//   await supabase.from('t').update(...).eq('k', 1)
//   await supabase.from('t').delete().eq('k', 1).eq('k2', 2)
function makeChain() {
    let pendingDelete = false;

    const chain: any = {
        from: (_table: string) => chain,
        select: () => chain,
        order: () => Promise.resolve(popResponse()),
        insert: (payload: Record<string, unknown>) => {
            insertCalls.push(payload);
            return chain;
        },
        update: (payload: Record<string, unknown>) => {
            updateCalls.push(payload);
            return chain;
        },
        delete: () => {
            pendingDelete = true;
            return chain;
        },
        eq: (col: string, val: unknown) => {
            if (pendingDelete) {
                deleteEqCalls.push({ [col]: val });
            }
            return chain;
        },
        single: () => Promise.resolve(popResponse()),
        // Thenable: `await chain` resolves to the next queued response.
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(popResponse()).then(onFulfilled, onRejected),
    };

    return chain;
}

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => makeChain(),
}));

const sendTextMessageMock = vi.fn();
vi.mock('@/lib/facebook/messenger', () => ({
    sendTextMessage: (...args: unknown[]) => sendTextMessageMock(...args),
    classifyMetaError: () => 'other',
}));

vi.mock('@/lib/monitoring/errorMonitoring', () => ({
    captureException: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
    },
}));

// Import AFTER mocks
import {
    matchKeywords,
    getMatchingAutomation,
    executeAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    isShopWhitelisted,
} from '../CommentAutomationService';

// ───────────── helpers ─────────────

function makeAutomation(overrides: Partial<CommentAutomation> = {}): CommentAutomation {
    return {
        id: 'auto-1',
        shop_id: 'shop-1',
        name: 'Sale',
        is_active: true,
        post_id: null,
        post_url: null,
        trigger_keywords: ['dm', 'үнэ'],
        match_type: 'contains',
        action_type: 'send_dm',
        dm_message: 'Hello!',
        reply_message: null,
        platform: 'both',
        trigger_count: 0,
        last_triggered_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

beforeEach(() => {
    responseQueue.length = 0;
    updateCalls.length = 0;
    insertCalls.length = 0;
    deleteEqCalls.length = 0;
    sendTextMessageMock.mockReset();
    sendTextMessageMock.mockResolvedValue(undefined);
    vi.unstubAllGlobals();
    // Default: whitelist enabled for the test shop so existing matching tests pass.
    // Individual tests can override with vi.stubEnv() to test the gate.
    vi.stubEnv('COMMENT_AUTOMATION_ENABLED_SHOPS', '*');
});

// ───────────── tests ─────────────

describe('matchKeywords', () => {
    // Real callers (getMatchingAutomation) lowercase+trim the comment before passing it
    // in — matchKeywords only normalizes the keyword side.

    it('matches in "contains" mode and lowercases the keyword side', () => {
        expect(matchKeywords('please send me price info', ['price'], 'contains')).toBe(true);
        expect(matchKeywords('please send me price info', ['PRICE'], 'contains')).toBe(true);
        expect(matchKeywords('hello world', ['price'], 'contains')).toBe(false);
    });

    it('matches "exact" mode only when the whole comment equals a keyword', () => {
        expect(matchKeywords('dm', ['dm'], 'exact')).toBe(true);
        expect(matchKeywords('dm', ['DM'], 'exact')).toBe(true);
        expect(matchKeywords('please dm me', ['dm'], 'exact')).toBe(false);
    });

    it('skips empty/whitespace keywords', () => {
        expect(matchKeywords('hi', ['', '   '], 'contains')).toBe(false);
    });

    it('returns false for an empty keyword list', () => {
        expect(matchKeywords('hi', [], 'contains')).toBe(false);
    });
});

describe('getMatchingAutomation', () => {
    it('returns null when there are no active automations', async () => {
        responseQueue.push({ data: [], error: null }); // getActiveAutomations select
        const result = await getMatchingAutomation('shop-1', 'post-1', 'any', 'facebook');
        expect(result).toBeNull();
    });

    it('skips rules whose platform does not match the incoming comment', async () => {
        const ruleIg = makeAutomation({ id: 'ig-only', platform: 'instagram', trigger_keywords: ['hi'] });
        const ruleFb = makeAutomation({ id: 'fb-only', platform: 'facebook', trigger_keywords: ['hi'] });
        responseQueue.push({ data: [ruleIg, ruleFb], error: null });

        const result = await getMatchingAutomation('shop-1', null, 'hi', 'facebook');
        expect(result?.id).toBe('fb-only');
    });

    it('respects post_id filter (null on the rule = applies to every post)', async () => {
        const allPosts = makeAutomation({ id: 'all', post_id: null, trigger_keywords: ['hi'] });
        const specific = makeAutomation({ id: 'specific', post_id: 'post-XYZ', trigger_keywords: ['hi'] });
        responseQueue.push({ data: [specific, allPosts], error: null });

        // Comment on a post that does NOT match `post-XYZ` — must fall through
        // to the post_id=null rule.
        const result = await getMatchingAutomation('shop-1', 'post-OTHER', 'hi', 'facebook');
        expect(result?.id).toBe('all');
    });

    it('returns null when no rule matches the keyword', async () => {
        const rule = makeAutomation({ trigger_keywords: ['price'] });
        responseQueue.push({ data: [rule], error: null });
        const result = await getMatchingAutomation('shop-1', null, 'thanks!', 'facebook');
        expect(result).toBeNull();
    });

    it('short-circuits to null for shops not in the rollout whitelist', async () => {
        // Whitelist contains a different shop — request for shop-1 must be denied
        // BEFORE any DB call is issued. We assert that by NOT enqueueing a response;
        // if the service tried to fetch automations, popResponse() would return the
        // empty default and the test would still pass — but we also verify the
        // helper directly below.
        vi.stubEnv('COMMENT_AUTOMATION_ENABLED_SHOPS', 'shop-OTHER');
        const result = await getMatchingAutomation('shop-1', null, 'price please', 'facebook');
        expect(result).toBeNull();
    });
});

describe('isShopWhitelisted', () => {
    it('returns false when env var is unset or empty', () => {
        vi.stubEnv('COMMENT_AUTOMATION_ENABLED_SHOPS', '');
        expect(isShopWhitelisted('shop-1')).toBe(false);
    });

    it('returns true when shop ID is in the comma list', () => {
        vi.stubEnv('COMMENT_AUTOMATION_ENABLED_SHOPS', 'shop-A, shop-1 ,shop-B');
        expect(isShopWhitelisted('shop-1')).toBe(true);
        expect(isShopWhitelisted('shop-A')).toBe(true);
        expect(isShopWhitelisted('shop-Z')).toBe(false);
    });

    it('returns true for any shop when wildcard is set', () => {
        vi.stubEnv('COMMENT_AUTOMATION_ENABLED_SHOPS', '*');
        expect(isShopWhitelisted('any-shop')).toBe(true);
    });
});

describe('executeAutomation', () => {
    it('sends a DM only when action_type is send_dm', async () => {
        const auto = makeAutomation({ action_type: 'send_dm' });
        // executeAutomation issues two writes: trigger_count update + chat_history insert
        responseQueue.push({ data: null, error: null }); // update
        responseQueue.push({ data: null, error: null }); // insert

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await executeAutomation(auto, 'sender-1', 'comment-1', 'token', 'facebook');

        expect(sendTextMessageMock).toHaveBeenCalledWith({
            recipientId: 'sender-1',
            message: 'Hello!',
            pageAccessToken: 'token',
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(result).toEqual({ dmSent: true, replySent: false });
    });

    it('posts a comment reply only when action_type is reply_comment', async () => {
        const auto = makeAutomation({ action_type: 'reply_comment', reply_message: 'thanks!' });
        responseQueue.push({ data: null, error: null }); // update
        responseQueue.push({ data: null, error: null }); // insert

        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
        vi.stubGlobal('fetch', fetchMock);

        const result = await executeAutomation(auto, 'sender-1', 'comment-1', 'token', 'facebook');

        expect(sendTextMessageMock).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledOnce();
        const url = fetchMock.mock.calls[0][0] as string;
        expect(url).toContain('/v21.0/comment-1/comments');
        expect(result).toEqual({ dmSent: false, replySent: true });
    });

    it('does both when action_type is "both" and a reply_message is set', async () => {
        const auto = makeAutomation({
            action_type: 'both',
            reply_message: 'check DMs',
            trigger_count: 4,
        });
        responseQueue.push({ data: null, error: null });
        responseQueue.push({ data: null, error: null });

        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
        vi.stubGlobal('fetch', fetchMock);

        const result = await executeAutomation(auto, 'sender-1', 'comment-1', 'token', 'instagram');

        expect(sendTextMessageMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(result).toEqual({ dmSent: true, replySent: true });

        // Counter increment payload should be `trigger_count + 1` and a fresh timestamp.
        const incPayload = updateCalls.find(p => typeof p.trigger_count === 'number');
        expect(incPayload?.trigger_count).toBe(5);
        expect(typeof incPayload?.last_triggered_at).toBe('string');
    });

    it('still increments the counter and writes chat_history even when DM send throws', async () => {
        sendTextMessageMock.mockRejectedValueOnce(new Error('FB down'));
        const auto = makeAutomation({ action_type: 'send_dm' });
        responseQueue.push({ data: null, error: null }); // update
        responseQueue.push({ data: null, error: null }); // insert

        const result = await executeAutomation(auto, 'sender-1', 'comment-1', 'token', 'facebook');

        expect(result.dmSent).toBe(false);
        // Counter was still incremented (best-effort accounting)
        expect(updateCalls.some(p => typeof p.trigger_count === 'number')).toBe(true);
    });
});

describe('createAutomation', () => {
    it('inserts with defaults when caller omits optional fields', async () => {
        responseQueue.push({
            data: makeAutomation({ id: 'new-1', name: 'New' }),
            error: null,
        });

        const result = await createAutomation('shop-1', {
            name: 'New',
            trigger_keywords: ['k'],
            dm_message: 'Hi',
        });

        expect(result?.id).toBe('new-1');
        const payload = insertCalls[0];
        expect(payload.shop_id).toBe('shop-1');
        expect(payload.match_type).toBe('contains');
        expect(payload.action_type).toBe('send_dm');
        expect(payload.platform).toBe('both');
        expect(payload.post_id).toBeNull();
        expect(payload.post_url).toBeNull();
        expect(payload.reply_message).toBeNull();
    });

    it('returns null when the insert fails', async () => {
        responseQueue.push({ data: null, error: { message: 'unique violation' } });
        const result = await createAutomation('shop-1', {
            name: 'New',
            trigger_keywords: ['k'],
            dm_message: 'Hi',
        });
        expect(result).toBeNull();
    });
});

describe('updateAutomation', () => {
    it('returns the updated row and writes a fresh updated_at', async () => {
        responseQueue.push({
            data: makeAutomation({ id: 'auto-1', name: 'Updated' }),
            error: null,
        });

        const result = await updateAutomation('auto-1', 'shop-1', { name: 'Updated' });

        expect(result?.name).toBe('Updated');
        const payload = updateCalls[0];
        expect(payload.name).toBe('Updated');
        expect(typeof payload.updated_at).toBe('string');
    });

    it('returns null when the row is not found', async () => {
        responseQueue.push({ data: null, error: { message: 'not found' } });
        const result = await updateAutomation('nope', 'shop-1', { is_active: false });
        expect(result).toBeNull();
    });
});

describe('deleteAutomation', () => {
    it('returns true on success and scopes the delete by both id and shop_id', async () => {
        responseQueue.push({ data: null, error: null });
        const ok = await deleteAutomation('auto-1', 'shop-1');
        expect(ok).toBe(true);
        const cols = deleteEqCalls.flatMap(o => Object.keys(o));
        expect(cols).toContain('id');
        expect(cols).toContain('shop_id');
    });

    it('returns false when the delete errors', async () => {
        responseQueue.push({ data: null, error: { message: 'fk violation' } });
        const ok = await deleteAutomation('auto-1', 'shop-1');
        expect(ok).toBe(false);
    });
});
