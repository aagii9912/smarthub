/**
 * AIRouter - Routes AI requests to appropriate GPT-5 Family model
 * 
 * Strategy:
 * - All plans use GPT-5 Family models
 * - Plan determines the specific model (Nano, Mini, Full)
 */

import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, ImageAction } from '@/types/ai';
import { buildSystemPrompt } from './services/PromptService';
import { executeTool, ToolExecutionContext, ToolExecutionResult } from './services/ToolExecutor';
import { AI_TOOLS, ToolName } from './tools/definitions';
import {
    PlanType,
    getPlanConfig,
    getPlanTypeFromSubscription,
    isToolEnabledForPlan,
    getEnabledToolsForPlan,
    checkMessageLimit,
    AIModel,
} from './config/plans';

// Initialize OpenAI client with timeout to avoid Vercel function limits
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    dangerouslyAllowBrowser: true, // Needed for potential edge runtime or test env
    timeout: 8000, // 8 seconds to stay within Vercel's 10s limit
    maxRetries: 1, // Reduce retries to save time
});

/**
 * Model mapping - GPT-5 models (when available, fallback to GPT-4o family)
 */
const MODEL_MAPPING: Record<AIModel, string> = {
    'gpt-5-nano': process.env.GPT5_NANO_MODEL || 'gpt-4o-mini',
    'gpt-5-mini': process.env.GPT5_MINI_MODEL || 'gpt-4o-mini',
    'gpt-5': process.env.GPT5_MODEL || 'gpt-4o', // Backend flagship
    'gemini-2.5-flash': 'gemini-2.5-flash', // Direct mapping for Gemini
};

/**
 * Extended ChatContext with plan information
 */
export interface RouterChatContext extends ChatContext {
    subscription?: {
        plan?: string;
        status?: string;
        trial_ends_at?: string;
    };
    messageCount?: number;
    aiProvider?: 'openai' | 'gemini'; // AI provider selection
}

/**
 * Router response with usage info
 */
export interface RouterResponse extends ChatResponse {
    usage?: {
        plan: PlanType;
        model: string;
        messagesUsed: number;
        messagesRemaining: number;
        tokensUsed?: number;
    };
    limitReached?: boolean;
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
    } catch (error: unknown) {
        const err = error as { status?: number };
        if (retries > 0 && (err.status === 429 || err.status === 503)) {
            logger.warn(`API rate limited, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}



/**
 * Filter tools based on plan
 */
function getToolsForPlan(plan: PlanType): typeof AI_TOOLS {
    const enabledTools = getEnabledToolsForPlan(plan);
    return AI_TOOLS.filter((tool) => {
        const funcTool = tool as { type: string; function: { name: string } };
        return enabledTools.includes(funcTool.function.name as ToolName);
    });
}

/**
 * Main AI Router - generates response based on plan configuration
 */
export async function routeToAI(
    message: string,
    context: RouterChatContext,
    previousHistory: ChatMessage[] = []
): Promise<RouterResponse> {
    // Determine plan type
    const planType = getPlanTypeFromSubscription(context.subscription);
    const planConfig = getPlanConfig(planType);

    // Check message limit
    const messageCount = context.messageCount || 0;
    const limitCheck = checkMessageLimit(planType, messageCount);

    if (!limitCheck.allowed) {
        logger.warn('Message limit reached', {
            plan: planType,
            count: messageCount,
            limit: limitCheck.limit
        });

        return {
            text: `Уучлаарай, та энэ сарын мессежийн лимитдээ хүрсэн байна (${limitCheck.limit} мессеж). Илүү олон мессеж авахын тулд план-аа шинэчлэнэ үү! 📈`,
            limitReached: true,
            usage: {
                plan: planType,
                model: planConfig.model,
                messagesUsed: messageCount,
                messagesRemaining: 0,
            },
        };
    }

    let imageAction: ImageAction | undefined;
    let quickReplies: Array<{ title: string; payload: string }> | undefined;

    try {
        // Get actual model and GPT-5 display name
        const modelName = planConfig.model;
        const backendModel = MODEL_MAPPING[modelName];

        logger.info(`AIRouter: Routing to GPT-5 Family [${modelName}] (Backend: ${backendModel})`);

        // Build system prompt
        const systemPrompt = buildSystemPrompt({
            ...context,
            planFeatures: {
                ai_model: modelName, // Pass GPT-5 name to PromptService
                sales_intelligence: planConfig.features.salesIntelligence,
                ai_memory: planConfig.features.memory,
                max_tokens: planConfig.maxTokens,
            },
        });

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...previousHistory,
            { role: 'user', content: message }
        ];

        // Get tools enabled for this plan
        const planTools = planConfig.features.toolCalling
            ? getToolsForPlan(planType)
            : undefined;

        return await retryOperation(async () => {
            logger.info(`Sending to ${modelName} (${backendModel})...`);

            const response = await openai.chat.completions.create({
                model: backendModel,
                messages: messages,
                max_completion_tokens: planConfig.maxTokens,
                tools: planTools,
                tool_choice: planTools ? 'auto' : undefined,
            });

            const responseMessage = response.choices[0]?.message;
            let finalResponseText = responseMessage?.content || '';

            // Handle Tool Calls
            if (responseMessage?.tool_calls && planConfig.features.toolCalling) {
                const toolCalls = responseMessage.tool_calls;
                logger.info('AI triggered tool calls:', { count: toolCalls.length });

                // Add assistant's tool call message to history
                messages.push(responseMessage as ChatMessage);

                // Create tool execution context
                const toolContext: ToolExecutionContext = {
                    shopId: context.shopId,
                    customerId: context.customerId,
                    customerName: context.customerName,
                    products: context.products,
                    notifySettings: context.notifySettings,
                };

                // Execute each tool call (only if enabled for plan)
                for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name as ToolName;

                        // Check if tool is enabled for this plan
                        if (!isToolEnabledForPlan(functionName, planType)) {
                            logger.warn(`Tool ${functionName} not enabled for ${planType} plan`);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            messages.push({
                                role: 'tool',
                                tool_call_id: toolCall.id,
                                content: JSON.stringify({
                                    error: 'This feature is not available on your current plan. Please upgrade to access this feature.'
                                })
                            } as unknown as ChatMessage);
                            continue;
                        }

                        const args = JSON.parse(toolCall.function.arguments);
                        logger.info(`Executing tool: ${functionName}`, args);

                        const result: ToolExecutionResult = await executeTool(
                            functionName,
                            args,
                            toolContext
                        );

                        if (result.imageAction) {
                            imageAction = result.imageAction;
                        }

                        if (result.quickReplies && result.quickReplies.length > 0) {
                            quickReplies = result.quickReplies;
                        }

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(
                                result.success
                                    ? { success: true, message: result.message, ...result.data }
                                    : { error: result.error }
                            )
                        } as unknown as ChatMessage);
                    }
                }

                // Call OpenAI again with tool results
                const secondResponse = await openai.chat.completions.create({
                    model: backendModel,
                    messages: messages,
                    max_completion_tokens: planConfig.maxTokens,
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
                });
            }

            logger.success(`AIRouter response received (${planType}/${planConfig.model})`);

            return {
                text: finalResponseText,
                imageAction,
                quickReplies,
                usage: {
                    plan: planType,
                    model: planConfig.model,
                    messagesUsed: messageCount + 1,
                    messagesRemaining: limitCheck.remaining - 1,
                    tokensUsed: usage?.total_tokens,
                },
            };
        });

    } catch (error: unknown) {
        const err = error as { message?: string; stack?: string; name?: string; status?: number };
        logger.error('AIRouter Error:', {
            message: err.message,
            stack: err.stack,
            name: err.name,
            status: err.status,
            plan: planType,
            model: planConfig.model,
        });
        throw error;
    }
}

/**
 * Download image and convert to base64 for OpenAI Vision API
 * Facebook CDN URLs are not directly accessible by OpenAI servers
 */
async function downloadImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SmartHub/1.0)',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Detect content type from response or default to jpeg
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
}

/**
 * Analyze product image using vision (plan-dependent)
 * Now uses Gemini 2.5 Flash for faster and cheaper vision analysis
 */
export async function analyzeProductImageWithPlan(
    imageUrl: string,
    products: Array<{ id: string; name: string; description?: string }>,
    planType: PlanType = 'starter'
): Promise<{
    matchedProduct: string | null;
    confidence: number;
    description: string;
    isReceipt?: boolean;
    receiptAmount?: number;
}> {
    const planConfig = getPlanConfig(planType);

    if (!planConfig.features.vision) {
        return {
            matchedProduct: null,
            confidence: 0,
            description: 'Image analysis is not available on your current plan.',
        };
    }

    try {
        // Use Gemini for vision (faster and cheaper)
        const { GeminiProvider } = await import('./providers/GeminiProvider');
        const geminiVision = new GeminiProvider('gemini-2.5-flash');

        // Check if Gemini is available, fallback to OpenAI if not
        if (!geminiVision.isAvailable()) {
            logger.warn('Gemini not available for vision, falling back to OpenAI');
            // Fallback to existing OpenAI logic
            const base64Image = await downloadImageAsBase64(imageUrl);
            const modelName = MODEL_MAPPING[planConfig.model];
            const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

            const response = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: buildVisionPrompt(productList) },
                            { type: 'image_url', image_url: { url: base64Image } }
                        ]
                    }
                ],
                max_completion_tokens: 500,
            });

            return parseVisionResponse(response.choices[0]?.message?.content || '');
        }

        logger.info('Using Gemini 2.5 Flash for vision analysis...');
        const result = await geminiVision.analyzeImage(imageUrl, products as any);

        logger.success('Gemini Vision analysis complete', { matched: result.matchedProduct, confidence: result.confidence });
        return result;

    } catch (error: unknown) {
        const err = error as { message?: string; status?: number; code?: string };
        logger.error('Vision Error:', {
            message: err.message,
            status: err.status,
            code: err.code,
            imageUrl: imageUrl.substring(0, 100) + '...',
        });
        return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

/**
 * Build vision prompt for product matching
 */
function buildVisionPrompt(productList: string): string {
    return `Та бол онлайн дэлгүүрийн ухаалаг туслах. Хэрэглэгчийн илгээсэн зургийг шинжилж дараах бүтээгдэхүүнүүдийн жагсаалтаас ТОХИРОХ барааг олоорой.

БҮТЭЭГДЭХҮҮНҮҮД (яг энэ нэрээр хариулна уу):
${productList}

ДААЛГАВАР:
1. Зургийг сайтар ажиглаарай
2. Дээрх жагсаалтаас ижил төстэй бараа байвал "matchedProduct" талбарт ЯГ ТЭР НЭРИЙГ бичнэ үү
3. Хэрэв ямар ч бараа тохирохгүй бол matchedProduct = null

JSON хариулна уу:
{
  "type": "product_inquiry",
  "matchedProduct": "Жагсаалтаас тохирсон бүтээгдэхүүний ЯГ НЭР, эсвэл null",
  "confidence": 0.0-1.0,
  "description": "Зурагт юу байгаа товч тайлбар"
}`;
}

/**
 * Parse vision response JSON
 */
function parseVisionResponse(responseText: string): {
    matchedProduct: string | null;
    confidence: number;
    description: string;
    isReceipt?: boolean;
    receiptAmount?: number;
} {
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
}

// Re-export types
export type { PlanType, AIModel } from './config/plans';
export {
    getPlanConfig,
    getPlanTypeFromSubscription,
    checkMessageLimit,
    getEnabledToolsForPlan,
    PLAN_CONFIGS
} from './config/plans';
