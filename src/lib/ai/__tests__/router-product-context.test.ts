import { beforeEach, describe, expect, it, vi } from 'vitest';

const { create, execute, persist } = vi.hoisted(() => ({
    create: vi.fn(), execute: vi.fn(), persist: vi.fn(),
}));
vi.mock('../anthropicClient', async importOriginal => ({
    ...await importOriginal<typeof import('../anthropicClient')>(),
    isAnthropicConfigured: () => true,
    getAnthropic: () => ({ messages: { create } }),
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
let callSeq = 0;
const reply = (text: string, calls: Array<{ name: string; args: object }> = []) => ({
    role: 'assistant',
    stop_reason: calls.length ? 'tool_use' : 'end_turn',
    content: [
        ...(text ? [{ type: 'text', text }] : []),
        ...calls.map(c => ({ type: 'tool_use', id: `toolu_${++callSeq}`, name: c.name, input: c.args })),
    ],
    usage: { input_tokens: 100, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
});
type Block = { type: string; text?: string; tool_use_id?: string; content?: string };
type Msg = { role: string; content: string | Block[] };
const requestOf = (i: number) => create.mock.calls[i][0] as {
    system: Array<{ type: string; text: string }>; messages: Msg[];
    tools?: Array<{ name: string }>; thinking?: { type: string }; temperature?: number;
};
const toolResultsOf = (msgs: Msg[]) => msgs.flatMap(m =>
    Array.isArray(m.content) ? m.content.filter(b => b.type === 'tool_result') : []);

beforeEach(() => {
    vi.clearAllMocks();
    persist.mockResolvedValue(undefined);
});

describe('router product lookup integration', () => {
    it('reads omitted details and counts both API calls without executing business tools', async () => {
        create.mockResolvedValueOnce(reply('', [{ name: 'get_product_details', args: { product_id: 'p1' } }]))
            .mockResolvedValueOnce(reply('Дэлгэрэнгүй хариулт.'));
        const result = await routeToAI('Дэлгэрэнгүй хэлнэ үү', context);
        const first = requestOf(0);
        expect(first.system[0].text).not.toContain(product.description);
        expect(first.messages[0].role).toBe('user');
        expect(first.thinking).toEqual({ type: 'disabled' });
        expect(first).not.toHaveProperty('temperature');
        expect(first.tools?.map(t => t.name)).toEqual(expect.arrayContaining(['get_product_details']));
        const [toolResult] = toolResultsOf(requestOf(1).messages);
        expect(JSON.parse(toolResult.content!).description).toBe(product.description);
        expect(execute).not.toHaveBeenCalled();
        expect(result.text).toBe('Дэлгэрэнгүй хариулт.');
        expect(result.usage?.tokensUsed).toBe(220);
        expect(persist).toHaveBeenCalledWith('test-shop', 220, 'chat_reply', expect.any(Object));
    });

    it('supplies named details immediately and keeps order tool routing intact', async () => {
        execute.mockResolvedValue({ success: true, message: 'Сагсанд нэмлээ.' });
        create.mockResolvedValueOnce(reply('', [{ name: 'add_to_cart', args: { product_name: 'Бараа', quantity: 1 } }]))
            .mockResolvedValueOnce(reply('Сагсанд нэмлээ.'));
        await routeToAI('Бараа авъя', context);
        expect(requestOf(0).system[0].text).toContain(product.description);
        expect(execute).toHaveBeenCalledWith('add_to_cart', { product_name: 'Бараа', quantity: 1 },
            expect.objectContaining({ shopId: 'test-shop', products: [product] }));
        // assistant tool_use turn must directly precede the user turn carrying its tool_result
        const second = requestOf(1).messages;
        const resultIdx = second.findIndex(m => Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result'));
        const assistant = second[resultIdx - 1];
        expect(second[resultIdx].role).toBe('user');
        expect(assistant.role).toBe('assistant');
        const toolUse = (assistant.content as Array<{ type: string; id?: string }>).find(b => b.type === 'tool_use');
        expect(toolResultsOf([second[resultIdx]])[0].tool_use_id).toBe(toolUse?.id);
    });

    it('falls back to the last tool message when the final reply is empty', async () => {
        execute.mockResolvedValue({ success: true, message: 'Захиалга үүслээ.' });
        create.mockResolvedValueOnce(reply('', [{ name: 'add_to_cart', args: { product_name: 'Бараа', quantity: 1 } }]))
            .mockResolvedValueOnce(reply(''));
        const result = await routeToAI('Бараа авъя', context);
        expect(result.text).toBe('Захиалга үүслээ.');
    });
});
