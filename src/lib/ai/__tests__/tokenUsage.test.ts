/**
 * Unit tests for src/lib/ai/tokenUsage.ts — `persistTokenUsage`.
 *
 * This is the most safety-critical billing surface in the app: every AI call
 * site funnels through it, and silent failures here mean shop owners get
 * incorrectly charged or under-credited. Coverage here is intentionally thick.
 *
 * What we lock down:
 *   1. Inputs — empty shopId / 0 / negative tokens never call the RPC
 *   2. Happy path — 3-arg RPC invoked with feature key
 *   3. Migration race window — 3-arg fails ⇒ 2-arg legacy fallback runs
 *   4. Both-fail path — error logged, function still resolves (non-blocking)
 *   5. Throw safety — RPC throwing must NEVER propagate (billing != UX block)
 *   6. All 9 feature keys are accepted and forwarded correctly
 *   7. meta is not part of RPC args (current state — pinned to detect drift)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock factories are hoisted above any `const` declaration, so we use
// vi.hoisted() to share refs between mock factories and the test body.
const { rpcMock, loggerMock } = vi.hoisted(() => ({
    rpcMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: vi.fn(() => ({ rpc: rpcMock })),
}));
vi.mock('@/lib/utils/logger', () => ({
    logger: loggerMock,
}));

// Imports must come AFTER vi.mock so the mocks resolve first
import { persistTokenUsage } from '@/lib/ai/tokenUsage';
import { TOKEN_FEATURE_KEYS, type TokenFeature } from '@/lib/ai/tokenFeatures';

beforeEach(() => {
    rpcMock.mockReset();
    loggerMock.info.mockClear();
    loggerMock.debug.mockClear();
    loggerMock.error.mockClear();
    loggerMock.warn.mockClear();
    loggerMock.success.mockClear();
});

// Convenience: assert the RPC call shape
function expectRpcCall(
    callIndex: number,
    fn: string,
    args: Record<string, unknown>
) {
    const call = rpcMock.mock.calls[callIndex];
    expect(call).toBeDefined();
    expect(call[0]).toBe(fn);
    expect(call[1]).toEqual(args);
}

describe('persistTokenUsage — input guard rails', () => {
    it('skips when shopId is empty string (no RPC invoked)', async () => {
        await persistTokenUsage('', 1000, 'chat_reply');
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('skips when tokensUsed is 0 (no RPC invoked, no log noise)', async () => {
        await persistTokenUsage('shop-1', 0, 'chat_reply');
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('skips when tokensUsed is negative (defensive — never bill back)', async () => {
        await persistTokenUsage('shop-1', -42, 'chat_reply');
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('skips when tokensUsed is NaN (would corrupt the BIGINT counter)', async () => {
        await persistTokenUsage('shop-1', Number.NaN, 'chat_reply');
        expect(rpcMock).not.toHaveBeenCalled();
    });
});

describe('persistTokenUsage — happy path (3-arg RPC)', () => {
    it('invokes increment_shop_token_usage with shopId, tokens, and feature', async () => {
        rpcMock.mockResolvedValue({ data: 12500, error: null });

        await persistTokenUsage('shop-abc', 750, 'chat_reply');

        expect(rpcMock).toHaveBeenCalledTimes(1);
        expectRpcCall(0, 'increment_shop_token_usage', {
            p_shop_id: 'shop-abc',
            p_tokens: 750,
            p_feature: 'chat_reply',
        });
    });

    it('logs at debug level on success (no warn/error noise)', async () => {
        rpcMock.mockResolvedValue({ data: 1, error: null });

        await persistTokenUsage('shop-1', 100, 'ai_memo', { model: 'gemini-3.1-flash-lite-preview' });

        expect(loggerMock.debug).toHaveBeenCalled();
        expect(loggerMock.warn).not.toHaveBeenCalled();
        expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('passes meta.model and meta.requestId via the log payload (not into the RPC args)', async () => {
        rpcMock.mockResolvedValue({ data: 1, error: null });

        await persistTokenUsage('shop-1', 100, 'vision', {
            model: 'gemini-2.5-flash-lite',
            requestId: 'req-xyz',
        });

        // RPC args should NOT include meta — pinned so a future refactor that
        // adds p_model to the SQL function gets a deliberate test update
        expectRpcCall(0, 'increment_shop_token_usage', {
            p_shop_id: 'shop-1',
            p_tokens: 100,
            p_feature: 'vision',
        });

        // But the log line should carry the model for observability
        const debugCalls = loggerMock.debug.mock.calls as unknown as Array<[string, Record<string, unknown>]>;
        const matched = debugCalls.find((call) => {
            const [msg, payload] = call;
            return msg === 'Token usage persisted' && payload?.model === 'gemini-2.5-flash-lite';
        });
        expect(matched).toBeDefined();
    });
});

describe('persistTokenUsage — migration-window legacy fallback', () => {
    it('falls back to 2-arg signature when 3-arg returns an error (function not yet migrated)', async () => {
        // First call: 3-arg fails (function signature not deployed)
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'function increment_shop_token_usage(uuid, bigint, text) does not exist' },
        });
        // Second call: 2-arg legacy succeeds
        rpcMock.mockResolvedValueOnce({ data: 5000, error: null });

        await persistTokenUsage('shop-9', 250, 'chat_reply');

        expect(rpcMock).toHaveBeenCalledTimes(2);
        // 1st call — full 3-arg
        expectRpcCall(0, 'increment_shop_token_usage', {
            p_shop_id: 'shop-9',
            p_tokens: 250,
            p_feature: 'chat_reply',
        });
        // 2nd call — legacy 2-arg (no p_feature)
        expectRpcCall(1, 'increment_shop_token_usage', {
            p_shop_id: 'shop-9',
            p_tokens: 250,
        });
        // We warn (not error) on graceful fallback so on-call doesn't get paged
        expect(loggerMock.warn).toHaveBeenCalledWith(
            'Per-feature RPC unavailable, used legacy 2-arg fallback',
            expect.objectContaining({
                shopId: 'shop-9',
                feature: 'chat_reply',
                tokensUsed: 250,
            })
        );
    });

    it('logs error (no warn) and resolves when BOTH 3-arg and 2-arg fail', async () => {
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'function increment_shop_token_usage(uuid, bigint, text) does not exist' },
        });
        rpcMock.mockResolvedValueOnce({
            data: null,
            error: { message: 'permission denied' },
        });

        // Must not throw — billing failures cannot block the AI response
        await expect(persistTokenUsage('shop-9', 100, 'chat_reply')).resolves.toBeUndefined();

        expect(loggerMock.error).toHaveBeenCalledWith(
            'Token usage RPC failed (both signatures):',
            expect.objectContaining({
                shopId: 'shop-9',
                feature: 'chat_reply',
                tokensUsed: 100,
                error: 'function increment_shop_token_usage(uuid, bigint, text) does not exist',
                legacyError: 'permission denied',
            })
        );
    });
});

describe('persistTokenUsage — non-blocking exception safety', () => {
    it('swallows synchronous RPC throws (logs error, resolves cleanly)', async () => {
        rpcMock.mockImplementation(() => {
            throw new Error('Network unreachable');
        });

        await expect(persistTokenUsage('shop-1', 1, 'chat_reply')).resolves.toBeUndefined();
        expect(loggerMock.error).toHaveBeenCalledWith(
            'Failed to persist token usage:',
            expect.objectContaining({
                error: 'Network unreachable',
                shopId: 'shop-1',
                feature: 'chat_reply',
            })
        );
    });

    it('swallows asynchronous RPC rejections', async () => {
        rpcMock.mockRejectedValue(new Error('Connection timeout'));

        await expect(persistTokenUsage('shop-1', 1, 'chat_reply')).resolves.toBeUndefined();
        expect(loggerMock.error).toHaveBeenCalledWith(
            'Failed to persist token usage:',
            expect.objectContaining({
                error: 'Connection timeout',
                shopId: 'shop-1',
                feature: 'chat_reply',
            })
        );
    });

    it('handles non-Error thrown values without crashing the message formatter', async () => {
        rpcMock.mockImplementation(() => {
            // eslint-disable-next-line @typescript-eslint/no-throw-literal
            throw 'unexpected string error';
        });

        await expect(persistTokenUsage('shop-1', 1, 'chat_reply')).resolves.toBeUndefined();
        expect(loggerMock.error).toHaveBeenCalled();
    });
});

describe('persistTokenUsage — every feature key is forwarded verbatim', () => {
    // This test is the contract between tokenFeatures.ts and the DB lookup
    // table. If a new feature is added to TOKEN_FEATURES, this loop expands
    // automatically and proves the RPC is called with the new key.
    it.each(TOKEN_FEATURE_KEYS)('forwards feature key "%s" unchanged', async (feature: TokenFeature) => {
        rpcMock.mockResolvedValue({ data: 1, error: null });

        await persistTokenUsage('shop-1', 100, feature);

        expect(rpcMock).toHaveBeenCalledTimes(1);
        const callArgs = rpcMock.mock.calls[0][1] as { p_feature: string };
        expect(callArgs.p_feature).toBe(feature);
    });
});

describe('persistTokenUsage — large / fractional / boundary tokens', () => {
    it('passes huge token counts (e.g. multi-shot tool calling) without truncation', async () => {
        rpcMock.mockResolvedValue({ data: 1, error: null });
        const big = 1_500_000;

        await persistTokenUsage('shop-1', big, 'chat_reply');

        const args = rpcMock.mock.calls[0][1] as { p_tokens: number };
        expect(args.p_tokens).toBe(big);
    });

    it('passes fractional tokens verbatim (Gemini sometimes returns floats)', async () => {
        rpcMock.mockResolvedValue({ data: 1, error: null });

        await persistTokenUsage('shop-1', 12.5, 'chat_reply');

        const args = rpcMock.mock.calls[0][1] as { p_tokens: number };
        expect(args.p_tokens).toBe(12.5);
    });

    it('exactly 1 token is recorded (boundary above 0)', async () => {
        rpcMock.mockResolvedValue({ data: 1, error: null });

        await persistTokenUsage('shop-1', 1, 'chat_reply');

        expect(rpcMock).toHaveBeenCalledTimes(1);
    });
});
