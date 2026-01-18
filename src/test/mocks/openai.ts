import { vi } from 'vitest';

/**
 * Mock OpenAI client for testing
 */
export const mockOpenAIClient = {
    chat: {
        completions: {
            create: vi.fn(),
        },
    },
};

/**
 * Mock OpenAI response
 */
export interface MockChatCompletion {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: 'assistant';
            content: string | null;
            tool_calls?: Array<{
                id: string;
                type: 'function';
                function: {
                    name: string;
                    arguments: string;
                };
            }>;
        };
        finish_reason: 'stop' | 'tool_calls' | 'length';
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Create a mock text response
 */
export function createMockTextResponse(content: string): MockChatCompletion {
    return {
        id: 'mock-completion-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content,
                },
                finish_reason: 'stop',
            },
        ],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        },
    };
}

/**
 * Create a mock tool call response
 */
export function createMockToolCallResponse(
    toolName: string,
    toolArgs: Record<string, unknown>
): MockChatCompletion {
    return {
        id: 'mock-completion-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4o',
        choices: [
            {
                index: 0,
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                        {
                            id: 'mock-tool-call-id',
                            type: 'function',
                            function: {
                                name: toolName,
                                arguments: JSON.stringify(toolArgs),
                            },
                        },
                    ],
                },
                finish_reason: 'tool_calls',
            },
        ],
        usage: {
            prompt_tokens: 100,
            completion_tokens: 50,
            total_tokens: 150,
        },
    };
}

/**
 * Reset OpenAI mocks
 */
export function resetOpenAIMocks() {
    mockOpenAIClient.chat.completions.create.mockClear();
}
