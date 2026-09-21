import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send, createModel, execute, persist } = vi.hoisted(() => ({
    send: vi.fn(), createModel: vi.fn(), execute: vi.fn(), persist: vi.fn(),
}));
vi.mock('@google/generative-ai', async importOriginal => ({
    ...await importOriginal<typeof import('@google/generative-ai')>(),
    GoogleGenerativeAI: class {
        getGenerativeModel = createModel;
    },
}));
vi.mock('../services/ToolExecutor', () => ({ executeTool: execute }));
vi.mock('../tokenUsage', () => ({ persistTokenUsage: persist }));
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
}) }));

import { routeToAI } from '../AIRouter';
const product = { id: 'p1', name: 'Бараа', price: 50000, stock: 10, description: 'Дэлгэрэнгүй. '.repeat(90) };
const context = { shopId: 'test-shop', shopName: 'Тест', products: [product],
    subscription: { plan: 'enterprise', status: 'active' } };
const reply = (text: string, calls: Array<{ name: string; args: object }> = []) => ({ response: {
    text: () => text, functionCalls: () => calls,
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 10, totalTokenCount: 110 },
} });

beforeEach(() => {
    vi.clearAllMocks();
    createModel.mockReturnValue({ startChat: () => ({ sendMessage: send }) });
    persist.mockResolvedValue(undefined);
});

describe('router product lookup integration', () => {
    it('reads omitted details and counts both API calls without executing business tools', async () => {
        send.mockResolvedValueOnce(reply('', [{ name: 'get_product_details', args: { product_id: 'p1' } }]))
            .mockResolvedValueOnce(reply('Дэлгэрэнгүй хариулт.'));
        const result = await routeToAI('Дэлгэрэнгүй хэлнэ үү', context);
        expect(createModel.mock.calls[0][0].systemInstruction).not.toContain(product.description);
        expect(createModel.mock.calls[0][0].tools[0].functionDeclarations).toEqual(
            expect.arrayContaining([expect.objectContaining({ name: 'get_product_details' })]));
        expect(send.mock.calls[1][0][0].functionResponse.response.description).toBe(product.description);
        expect(execute).not.toHaveBeenCalled();
        expect(result.text).toBe('Дэлгэрэнгүй хариулт.');
        expect(result.usage?.tokensUsed).toBe(220);
        expect(persist).toHaveBeenCalledWith('test-shop', 220, 'chat_reply', expect.any(Object));
    });

    it('supplies named details immediately and keeps order tool routing intact', async () => {
        execute.mockResolvedValue({ success: true, message: 'Сагсанд нэмлээ.' });
        send.mockResolvedValueOnce(reply('', [{ name: 'add_to_cart', args: { product_name: 'Бараа', quantity: 1 } }]))
            .mockResolvedValueOnce(reply('Сагсанд нэмлээ.'));
        await routeToAI('Бараа авъя', context);
        expect(createModel.mock.calls[0][0].systemInstruction).toContain(product.description);
        expect(execute).toHaveBeenCalledWith('add_to_cart', { product_name: 'Бараа', quantity: 1 },
            expect.objectContaining({ shopId: 'test-shop', products: [product] }));
    });
});
