/**
 * AIRouter - Routes AI requests to Gemini models
 * 
 * Strategy:
 * - All plans use Gemini models
 * - Plan determines the specific model (flash-lite, flash)
 * - Function calling via Gemini SDK's functionDeclarations
 */

import { GoogleGenerativeAI, Content, Part, FunctionCall } from '@google/generative-ai';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, ImageAction } from '@/types/ai';
import { buildSystemPrompt } from './services/PromptService';
import { executeTool, ToolExecutionContext, ToolExecutionResult } from './services/ToolExecutor';
import { TOOL_DEFINITIONS, ToolName, getGeminiFunctionDeclarations } from './tools/definitions';
import {
    PlanType,
    getPlanConfig,
    getPlanTypeFromSubscription,
    isToolEnabledForPlan,
    getEnabledToolsForPlan,
    checkMessageLimit,
    AIModel,
} from './config/plans';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Model mapping - Gemini models
 */
const MODEL_MAPPING: Record<AIModel, string> = {
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash': 'gemini-2.5-flash',
};

/**
 * Extended ChatContext with plan information
 */
export interface RouterChatContext extends ChatContext {
    subscription?: {
        plan?: string;
        status?: string;
    };
    messageCount?: number;
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
        const errMsg = error instanceof Error ? error.message : '';
        if (retries > 0 && (errMsg.includes('503') || errMsg.includes('overloaded') || errMsg.includes('429'))) {
            logger.warn(`API rate limited/overloaded, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Convert ChatMessage history to Gemini Content format
 */
function toGeminiHistory(messages: ChatMessage[]): Content[] {
    return messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }] as Part[],
        }));
}

/**
 * Filter tool definitions based on plan
 */
function getToolsForPlan(plan: PlanType) {
    const enabledTools = getEnabledToolsForPlan(plan);
    const filtered = TOOL_DEFINITIONS.filter(tool =>
        enabledTools.includes(tool.name as ToolName)
    );
    return getGeminiFunctionDeclarations(filtered);
}

/**
 * Main AI Router - generates response based on plan configuration using Gemini SDK
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
        // Get actual model
        const modelName = planConfig.model;
        const backendModel = MODEL_MAPPING[modelName] || 'gemini-2.5-flash';

        logger.info(`AIRouter: Routing to Gemini [${modelName}] (Backend: ${backendModel})`);

        // Build system prompt
        const systemPrompt = buildSystemPrompt({
            ...context,
            planFeatures: {
                ai_model: modelName,
                sales_intelligence: planConfig.features.salesIntelligence,
                ai_memory: planConfig.features.memory,
                max_tokens: planConfig.maxTokens,
            },
        });

        // Get function declarations enabled for this plan
        const functionDeclarations = planConfig.features.toolCalling
            ? getToolsForPlan(planType)
            : undefined;

        // Convert history to Gemini format
        const geminiHistory = toGeminiHistory(previousHistory);

        return await retryOperation(async () => {
            logger.info(`Sending to Gemini ${backendModel}...`);

            // Create model with system instruction and tools
            const model = genAI.getGenerativeModel({
                model: backendModel,
                systemInstruction: systemPrompt,
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: planConfig.maxTokens,
                },
                tools: functionDeclarations && functionDeclarations.length > 0
                    ? [{ functionDeclarations }]
                    : undefined,
            });

            // Start chat with history
            const chat = model.startChat({
                history: geminiHistory,
            });

            // Send message
            let result = await chat.sendMessage(message);
            let response = result.response;
            let finalResponseText = response.text?.() || '';

            // Handle Function Calls
            const functionCalls = response.functionCalls?.();
            if (functionCalls && functionCalls.length > 0 && planConfig.features.toolCalling) {
                logger.info('Gemini triggered function calls:', { count: functionCalls.length });

                // Create tool execution context
                const toolContext: ToolExecutionContext = {
                    shopId: context.shopId,
                    customerId: context.customerId,
                    customerName: context.customerName,
                    products: context.products,
                    notifySettings: context.notifySettings,
                };

                // Build function response parts
                const functionResponseParts: Part[] = [];

                for (const fc of functionCalls) {
                    const functionName = fc.name as ToolName;

                    // Check if tool is enabled for this plan
                    if (!isToolEnabledForPlan(functionName, planType)) {
                        logger.warn(`Tool ${functionName} not enabled for ${planType} plan`);
                        functionResponseParts.push({
                            functionResponse: {
                                name: fc.name,
                                response: {
                                    error: 'This feature is not available on your current plan. Please upgrade to access this feature.'
                                }
                            }
                        });
                        continue;
                    }

                    const args = (fc.args || {}) as Record<string, unknown>;
                    logger.info(`Executing tool: ${functionName}`, args as Record<string, unknown>);

                    const toolResult: ToolExecutionResult = await executeTool(
                        functionName,
                        args,
                        toolContext
                    );

                    if (toolResult.imageAction) {
                        imageAction = toolResult.imageAction;
                    }

                    if (toolResult.quickReplies && toolResult.quickReplies.length > 0) {
                        quickReplies = toolResult.quickReplies;
                    }

                    functionResponseParts.push({
                        functionResponse: {
                            name: fc.name,
                            response: toolResult.success
                                ? { success: true, message: toolResult.message, ...toolResult.data }
                                : { error: toolResult.error }
                        }
                    });
                }

                // Send function results back to Gemini
                const secondResult = await chat.sendMessage(functionResponseParts);
                finalResponseText = secondResult.response.text?.() || '';
            }

            // Log usage info
            const usageMetadata = response.usageMetadata;
            if (usageMetadata) {
                logger.info('Token usage:', {
                    promptTokens: usageMetadata.promptTokenCount,
                    candidatesTokens: usageMetadata.candidatesTokenCount,
                    totalTokens: usageMetadata.totalTokenCount,
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
                    tokensUsed: usageMetadata?.totalTokenCount,
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

        // Track in Sentry
        if (error instanceof Error) {
            Sentry.captureException(error, {
                tags: { plan: planType, model: planConfig.model },
                extra: { message, shopId: context.shopId }
            });
        }

        throw error;
    }
}

/**
 * Analyze product image using vision (plan-dependent)
 * Uses Gemini 2.5 Flash for vision analysis
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
        // Use GeminiProvider for vision
        const { GeminiProvider } = await import('./providers/GeminiProvider');
        const geminiVision = new GeminiProvider('gemini-2.5-flash');

        if (!geminiVision.isAvailable()) {
            logger.warn('Gemini not available for vision');
            return { matchedProduct: null, confidence: 0, description: 'Vision API тохируулагдаагүй байна.' };
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

// Re-export types
export type { PlanType, AIModel } from './config/plans';
export {
    getPlanConfig,
    getPlanTypeFromSubscription,
    checkMessageLimit,
    getEnabledToolsForPlan,
    PLAN_CONFIGS
} from './config/plans';
