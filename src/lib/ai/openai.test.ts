import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateChatResponse, ChatContext } from '@/lib/ai/openai';

// Mock OpenAI
const mockCreate = vi.fn();

// Mock the default export class properly
vi.mock('openai', () => {
    return {
        default: class OpenAI {
            chat = {
                completions: {
                    get create() { return mockCreate }
                }
            }
        }
    };
});

// Mock Tools
vi.mock('@/lib/ai/tools', () => ({
    tools: [],
    handleToolCall: vi.fn().mockImplementation(async (toolCall, context, messages) => {
        messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: true, message: 'Tool executed' })
        });
    })
}));

describe('OpenAI Logic', () => {
    let context: ChatContext;

    beforeEach(() => {
        vi.clearAllMocks();
        context = {
            shopId: '1',
            shopName: 'Test Shop',
            products: []
        };
    });

    it('should handle simple text response', async () => {
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Hello' } }],
            usage: { total_tokens: 10 }
        });

        const response = await generateChatResponse('Hi', context);
        expect(response.text).toBe('Hello');
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle single tool call loop', async () => {
        // First call returns tool call
        mockCreate.mockResolvedValueOnce({
            choices: [{
                message: {
                    content: null,
                    tool_calls: [{
                        id: 'call_1',
                        type: 'function',
                        function: { name: 'test_tool', arguments: '{}' }
                    }]
                }
            }],
            usage: { total_tokens: 10 }
        });

        // Second call returns final text
        mockCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'Task done' } }],
            usage: { total_tokens: 20 }
        });

        const response = await generateChatResponse('Do task', context);

        expect(response.text).toBe('Task done');
        expect(mockCreate).toHaveBeenCalledTimes(2);
    });
});
