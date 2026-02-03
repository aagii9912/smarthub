/**
 * OpenAI Provider Implementation
 */

import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, AIProduct } from '@/types/ai';
import type { AIProviderInterface, VisionResult, ChatOptions } from './AIProvider';
import { buildSystemPrompt } from '../services/PromptService';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: 8000,
    maxRetries: 1,
});

/**
 * OpenAI GPT Provider
 */
export class OpenAIProvider implements AIProviderInterface {
    readonly name = 'openai';
    readonly model: string;

    constructor(model: string = 'gpt-4o-mini') {
        this.model = model;
    }

    isAvailable(): boolean {
        return !!process.env.OPENAI_API_KEY;
    }

    async generateChatResponse(
        message: string,
        context: ChatContext,
        history: ChatMessage[],
        options?: ChatOptions
    ): Promise<ChatResponse> {
        const systemPrompt = buildSystemPrompt(context);

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...history.map(m => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content
            })),
            { role: 'user', content: message }
        ];

        logger.info(`OpenAI Provider: Sending to ${this.model}...`);

        const response = await openai.chat.completions.create({
            model: this.model,
            messages,
            max_completion_tokens: options?.maxTokens || 800,
            tools: options?.tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
            tool_choice: options?.tools ? 'auto' : undefined,
        });

        const responseMessage = response.choices[0]?.message;

        // Log token usage
        if (response.usage) {
            logger.info('OpenAI token usage:', {
                prompt: response.usage.prompt_tokens,
                completion: response.usage.completion_tokens,
                total: response.usage.total_tokens,
            });
        }

        return {
            text: responseMessage?.content || '',
            // Tool calls would be handled by AIRouter
        };
    }

    async analyzeImage(
        imageUrl: string,
        products: AIProduct[]
    ): Promise<VisionResult> {
        try {
            // Download and convert image to base64
            const response = await fetch(imageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartHub/1.0)' },
            });

            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const base64Image = `data:${contentType};base64,${base64}`;

            const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

            const visionResponse = await openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Та бол онлайн дэлгүүрийн ухаалаг туслах. Хэрэглэгчийн илгээсэн зургийг шинжилж дараах бүтээгдэхүүнүүдийн жагсаалтаас ТОХИРОХ барааг олоорой.

БҮТЭЭГДЭХҮҮНҮҮД:
${productList}

JSON хариулна уу:
{
  "matchedProduct": "Тохирсон бүтээгдэхүүний ЯГ НЭР, эсвэл null",
  "confidence": 0.0-1.0,
  "description": "Зурагт юу байгаа товч тайлбар"
}`
                            },
                            { type: 'image_url', image_url: { url: base64Image } }
                        ]
                    }
                ],
                max_completion_tokens: 500,
            });

            const responseText = visionResponse.choices[0]?.message?.content || '';
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                logger.success('OpenAI Vision analysis complete', { matched: result.matchedProduct });
                return result;
            }

            return { matchedProduct: null, confidence: 0, description: 'Зургийг таньж чадсангүй.' };
        } catch (error) {
            const err = error as Error;
            logger.error('OpenAI Vision Error:', { message: err.message });
            return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
        }
    }
}
