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
 * Token limits configuration by plan
 * Optimized for e-commerce sales chatbot use cases:
 * - Starter: 600 (basic product info, short responses)
 * - Pro: 1000 (detailed sales pitches, multiple products)
 * - Ultimate: 1500 (comprehensive responses, complex orders)
 */
const DEFAULT_MAX_TOKENS = 800;    // Fallback default
const MIN_TOKENS = 300;           // Minimum to ensure complete responses
const MAX_TOKENS_LIMIT = 2000;    // Safety cap to prevent runaway costs

/**
 * Get max tokens for response based on plan
 */
function getMaxTokens(planFeatures?: ChatContext['planFeatures']): number {
    // Use plan-defined value if available
    if (planFeatures?.max_tokens) {
        // Clamp between min and max
        return Math.min(Math.max(planFeatures.max_tokens, MIN_TOKENS), MAX_TOKENS_LIMIT);
    }

    // Default based on model
    if (planFeatures?.ai_model === 'gpt-4o') {
        return 1200;  // Higher for premium model
    }

    // Check if sales intelligence is enabled (Pro+ plans)
    if (planFeatures?.sales_intelligence) {
        return 1000;  // Sales responses need more tokens
    }

    return DEFAULT_MAX_TOKENS;
}

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
/**
 * Analyze product image using GPT-4 Vision
 * - Detects if it's a product inquiry or a payment receipt
 */
export async function analyzeProductImage(
    imageUrl: string,
    products: Array<{ id: string; name: string; description?: string }>
): Promise<{
    matchedProduct: string | null;
    confidence: number;
    description: string;
    isReceipt?: boolean;
    receiptAmount?: number;
}> {
    try {
        logger.info('analyzeProductImage called for:', { imageUrl });

        const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

        const prompt = `Та бол дэлгүүрийн ухаалаг туслах юм. Энэ зургийг шинжилж, хоёр зүйлийн аль нэг гэж ангилна уу:
1. "product_inquiry": Хэрэглэгч барааны зураг явуулж, байгаа эсэхийг асууж байна.
2. "payment_receipt": Хэрэглэгч төлбөрийн баримт (банкны шилжүүлэг, скриншот) явуулж байна.

Боломжит бүтээгдэхүүнүүд:
${productList}

Зөвхөн JSON форматаар хариулна уу:
{
  "type": "product_inquiry" эсвэл "payment_receipt",
  "matchedProduct": "Тохирсон бүтээгдэхүүний нэр (хэрэв бараа бол), эсвэл null",
  "confidence": 0.0-1.0 (итгэлтэй байдал),
  "description": "Зураг дээр юу харагдаж байгааг товч монголоор тайлбарла",
  "receiptAmount": 0 (хэрэв баримт бол дүн, үгүй бол 0)
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // or 'gpt-4o' if vision needed, currently alias usually points to vision capable model or use gpt-4o
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
            const result = JSON.parse(jsonMatch[0]);
            return {
                matchedProduct: result.matchedProduct,
                confidence: result.confidence,
                description: result.description,
                isReceipt: result.type === 'payment_receipt',
                receiptAmount: result.receiptAmount
            };
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
    let quickReplies: Array<{ title: string; payload: string }> | undefined;

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
            // Dynamic model selection based on plan
            const aiModel = context.planFeatures?.ai_model || 'gpt-4o-mini';
            logger.info(`Sending message to OpenAI ${aiModel}...`);

            // Dynamic token limit based on plan
            const maxTokens = getMaxTokens(context.planFeatures);
            logger.debug('Using max_tokens:', { maxTokens, plan: context.planFeatures });

            const response = await openai.chat.completions.create({
                model: aiModel,
                messages: messages,
                max_completion_tokens: maxTokens,
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

                        // Check for quick replies
                        if (result.quickReplies && result.quickReplies.length > 0) {
                            quickReplies = result.quickReplies;
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

                // Call OpenAI again with tool results (use same token limit)
                const secondResponse = await openai.chat.completions.create({
                    model: aiModel,
                    messages: messages,
                    max_completion_tokens: maxTokens,
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

            return { text: finalResponseText, imageAction, quickReplies };
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
