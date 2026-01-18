/**
 * OpenAI Chat Integration
 * Main entry point for AI chat functionality
 * 
 * Refactored to use modular components:
 * - services/PromptService - System prompt building
 * - services/ToolExecutor - Tool execution handling
 * - tools/definitions - AI tool definitions
 */

import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, ImageAction } from '@/types/ai';
import { buildSystemPrompt } from './services/PromptService';
import { executeTool, ToolExecutionContext, ToolExecutionResult } from './services/ToolExecutor';
import { AI_TOOLS, ToolName } from './tools/definitions';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Retry operation with exponential backoff
 */
async function retryOperation<T>(
    operation: () => Promise<T>,
    retries = 3,
    delay = 1000
): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.status === 503)) {
            logger.warn(`OpenAI rate limited, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Analyze product image using GPT-4 Vision
 */
export async function analyzeProductImage(
    imageUrl: string,
    products: Array<{ id: string; name: string; description?: string }>
): Promise<{ matchedProduct: string | null; confidence: number; description: string }> {
    try {
        logger.info('analyzeProductImage called for:', { imageUrl });

        const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

        const prompt = `Та бол дэлгүүрийн туслах юм. Энэ зургийг судалж, доорх бүтээгдэхүүнүүдийн алинтай нь тохирч байгааг хэлнэ үү.

Боломжит бүтээгдэхүүнүүд:
${productList}

Зөвхөн JSON форматаар хариулна уу:
{
  "matchedProduct": "Тохирсон бүтээгдэхүүний нэр (яг ижил нэрээр), эсвэл null",
  "confidence": 0.0-1.0 хооронд тоо,
  "description": "Зураг дээр юу харагдаж байгааг товч монголоор тайлбарла"
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }
            ],
            max_completion_tokens: 500,
        });

        const responseText = response.choices[0]?.message?.content || '';
        logger.success('Vision response:', { responseText });

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { matchedProduct: null, confidence: 0, description: 'Зургийг таньж чадсангүй.' };
    } catch (error) {
        logger.error('OpenAI Vision Error:', { error });
        return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

/**
 * Generate chat response using GPT-4o mini with tool calling
 */
export async function generateChatResponse(
    message: string,
    context: ChatContext,
    previousHistory: ChatMessage[] = []
): Promise<ChatResponse> {
    let imageAction: ImageAction | undefined;

    try {
        logger.debug('generateChatResponse called with:', {
            message,
            contextShopName: context.shopName,
            productsCount: context.products?.length || 0,
            historyLength: previousHistory.length
        });

        if (!context.shopName) {
            throw new Error('Shop name is required');
        }

        if (!Array.isArray(context.products)) {
            logger.warn('Products is not an array, converting to empty array');
            context.products = [];
        }

        // Build system prompt using PromptService
        const systemPrompt = buildSystemPrompt(context);

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...previousHistory,
            { role: 'user', content: message }
        ];

        logger.debug('System prompt prepared', { length: systemPrompt.length });

        return await retryOperation(async () => {
            logger.info('Sending message to OpenAI GPT-4o mini...');

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_completion_tokens: 800,
                tools: AI_TOOLS,
                tool_choice: 'auto',
            });

            const responseMessage = response.choices[0]?.message;
            let finalResponseText = responseMessage?.content || '';

            // Handle Tool Calls
            if (responseMessage?.tool_calls) {
                const toolCalls = responseMessage.tool_calls;
                logger.info('AI triggered tool calls:', { count: toolCalls.length });

                // Add assistant's tool call message to history
                messages.push(responseMessage as any);

                // Create tool execution context
                const toolContext: ToolExecutionContext = {
                    shopId: context.shopId,
                    customerId: context.customerId,
                    customerName: context.customerName,
                    products: context.products,
                    notifySettings: context.notifySettings,
                };

                // Execute each tool call
                for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name as ToolName;
                        const args = JSON.parse(toolCall.function.arguments);

                        logger.info(`Executing tool: ${functionName}`, args);

                        // Execute tool using ToolExecutor
                        const result: ToolExecutionResult = await executeTool(
                            functionName,
                            args,
                            toolContext
                        );

                        // Check for image action
                        if (result.imageAction) {
                            imageAction = result.imageAction;
                        }

                        // Add tool result to messages
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(
                                result.success
                                    ? { success: true, message: result.message, ...result.data }
                                    : { error: result.error }
                            )
                        } as any);
                    }
                }

                // Call OpenAI again with tool results
                const secondResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_completion_tokens: 800,
                });

                finalResponseText = secondResponse.choices[0]?.message?.content || '';

                if (secondResponse.usage) {
                    logger.info('Token usage (post-tool):', {
                        total_tokens: secondResponse.usage.total_tokens
                    });
                }
            }

            // Log token usage
            const usage = response.usage;
            if (usage) {
                logger.info('Token usage:', {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens,
                    estimated_cost_usd: ((usage.prompt_tokens * 0.00025 / 1000) + (usage.completion_tokens * 0.002 / 1000)).toFixed(6)
                });
            }

            logger.success('OpenAI response received', { length: finalResponseText.length });

            return { text: finalResponseText, imageAction };
        });
    } catch (error: any) {
        logger.error('OpenAI API Error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            status: error?.status
        });
        throw error;
    }
}

/**
 * Parse product data from file content using AI
 */
export async function parseProductDataWithAI(
    fileContent: string,
    fileName: string
): Promise<Array<{
    name: string;
    price: number;
    stock: number;
    description: string;
    type: 'physical' | 'service';
    unit: string;
    colors: string[];
    sizes: string[];
}>> {
    try {
        logger.info('Parsing product data with AI...', { fileName, contentLength: fileContent.length });

        const prompt = `
You are a data extraction assistant. Extract products and services from the provided file content.
Filename: "${fileName}"

RULES:
1. Extract ALL items found.
2. Determine 'type': 'physical' for physical goods (phones, clothes), 'service' for services (repair, editing, consulting).
3. Determine 'unit': e.g., 'ширхэг' for goods, 'захиалга', 'цаг', 'хүн' for services.
4. Extract 'stock': For services, this is the Number of Available Slots/Orders. If not specified, default to 0.
5. Extract 'colors' and 'sizes' if available.
6. Return a JSON object with a "products" array.

Input Content:
${fileContent.slice(0, 15000)} -- truncated if too long

Response Format (JSON only):
{
  "products": [
    {
      "name": "Product Name",
      "price": 0,
      "stock": 0,
      "description": "Description",
      "type": "physical" | "service",
      "unit": "ширхэг" | "захиалга" | "цаг",
      "colors": ["red", "blue"],
      "sizes": ["S", "M"]
    }
  ]
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a helpful data extraction assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);

        if (!Array.isArray(result.products)) {
            logger.warn('AI returned invalid format', result);
            return [];
        }

        return result.products.map((p: any) => ({
            name: p.name || 'Unnamed',
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
            description: p.description || '',
            type: p.type === 'service' ? 'service' : 'physical',
            unit: p.unit || (p.type === 'service' ? 'захиалга' : 'ширхэг'),
            colors: Array.isArray(p.colors) ? p.colors : [],
            sizes: Array.isArray(p.sizes) ? p.sizes : []
        }));

    } catch (error: any) {
        logger.error('AI Parse Error:', { message: error?.message || error });
        return [];
    }
}

// Re-export types for backward compatibility
export type { ChatContext, ChatMessage, ChatResponse, ImageAction } from '@/types/ai';
