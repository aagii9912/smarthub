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
import type { ChatContext, ChatMessage, ChatResponse, ImageAction, ChatAction } from '@/types/ai';
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
    'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite-preview',
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
 * Filters out empty messages that can cause Gemini to return empty responses
 * Ensures: 1) First message is 'user' role, 2) Roles alternate (merges consecutive same-role)
 */
function toGeminiHistory(messages: ChatMessage[]): Content[] {
    const filtered = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
        .map(m => ({
            role: m.role === 'assistant' ? 'model' as const : 'user' as const,
            parts: [{ text: m.content }] as Part[],
        }));

    // Drop leading 'model' messages — Gemini requires first content to be 'user'
    let startIndex = 0;
    while (startIndex < filtered.length && filtered[startIndex].role === 'model') {
        startIndex++;
    }
    const trimmed = filtered.slice(startIndex);

    // Merge consecutive messages with the same role (Gemini requires alternating roles)
    const merged: Content[] = [];
    for (const msg of trimmed) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
            // Merge text into previous message
            const prevText = (last.parts[0] as { text: string }).text;
            const newText = (msg.parts[0] as { text: string }).text;
            last.parts = [{ text: prevText + '\n' + newText }];
        } else {
            merged.push({ ...msg });
        }
    }

    return merged;
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
    let actions: ChatAction[] | undefined;

    try {
        // Get actual model
        const modelName = planConfig.model;
        const backendModel = MODEL_MAPPING[modelName] || 'gemini-3.1-flash-lite-preview';

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

            // Safely extract text (text() can throw when response has only function calls)
            let finalResponseText = '';
            try {
                finalResponseText = response.text?.() || '';
            } catch (textError) {
                logger.debug('First response text() unavailable (likely function call response)');
            }

            // Handle Function Calls
            const functionCalls = response.functionCalls?.();
            if (functionCalls && functionCalls.length > 0 && planConfig.features.toolCalling) {
                logger.info('Gemini triggered function calls:', {
                    count: functionCalls.length,
                    names: functionCalls.map(fc => fc.name),
                });

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
                                    error: `Энэ боломж (${functionName}) одоогийн ${planType} багцад идэвхгүй байна. Pro багц руу шилжвэл захиалга, checkout, дэлгэрэнгүй тайлан зэрэг бүх боломж нээгдэнэ! 🚀`
                                }
                            }
                        });
                        continue;
                    }

                    const args = (fc.args || {}) as Record<string, unknown>;
                    logger.info(`Executing tool: ${functionName}`, { data: args as Record<string, unknown> });

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

                    if (toolResult.actions && toolResult.actions.length > 0) {
                        actions = [...(actions || []), ...toolResult.actions];
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

                try {
                    finalResponseText = secondResult.response.text?.() || '';
                } catch (textError) {
                    logger.warn('Second response text() threw error:', { error: String(textError) });
                }

                // Diagnostic: log what Gemini returned if empty
                if (!finalResponseText.trim()) {
                    const candidates = secondResult.response.candidates;
                    logger.warn('Gemini returned empty after tool call', {
                        candidateCount: candidates?.length,
                        finishReason: candidates?.[0]?.finishReason,
                        safetyRatings: candidates?.[0]?.safetyRatings?.map(r => ({ category: r.category, probability: r.probability })),
                        partTypes: candidates?.[0]?.content?.parts?.map(p => Object.keys(p)),
                    });

                    // Fallback: use the tool's own message
                    const lastToolMessage = functionResponseParts
                        .map(p => (p.functionResponse?.response as Record<string, unknown>)?.message)
                        .filter(Boolean)
                        .pop() as string | undefined;

                    if (lastToolMessage) {
                        logger.info('Using tool message as fallback');
                        finalResponseText = lastToolMessage;
                    }
                }
            } else if (!finalResponseText.trim()) {
                // No function calls and no text — retry once
                logger.warn('Gemini returned empty, retrying once...');

                // Retry with a nudge message
                const retryResult = await chat.sendMessage(
                    message + '\n\n(Хэрэглэгчид заавал хариу бичнэ үү)'
                );
                try {
                    finalResponseText = retryResult.response.text?.() || '';
                } catch { /* ignore */ }

                if (!finalResponseText.trim()) {
                    logger.warn('Gemini still empty after retry', {
                        promptTokens: response.usageMetadata?.promptTokenCount,
                        historyLength: geminiHistory.length,
                    });
                } else {
                    logger.info('Gemini retry succeeded');
                }
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
                actions,
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
        const geminiVision = new GeminiProvider('gemini-3.1-flash-lite-preview');

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
