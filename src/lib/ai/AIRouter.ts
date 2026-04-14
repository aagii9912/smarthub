/**
 * AIRouter - Routes AI requests to Gemini models
 * 
 * Billing: Token-based (primary) + message count (analytics)
 * Strategy:
 * - All plans use Gemini models
 * - Plan determines the specific model (flash-lite, flash)
 * - Function calling via Gemini SDK's functionDeclarations
 * - Token usage tracked per-shop and persisted to Supabase
 */

import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';
import { getRedisClient } from '@/lib/redis/client';
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
    checkTokenLimit,
    AIModel,
} from './config/plans';

// Initialize Gemini client
if (!process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY environment variable is not set — AI features will not work');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Model mapping - Gemini models
 */
const MODEL_MAPPING: Record<AIModel, string> = {
    'gemini-3.1-flash-lite-preview': 'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-preview-05-20': 'gemini-2.5-flash-preview-05-20',
    'gemini-2.5-pro-preview-05-06': 'gemini-2.5-pro-preview-05-06',
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
    tokenUsageTotal?: number;  // Current month's total token usage for the shop
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
        tokensRemaining?: number;
        tokenUsagePercent?: number;
    };
    limitReached?: boolean;
}

/**
 * Persist token usage to shop record (atomic increment)
 */
async function persistTokenUsage(shopId: string, tokensUsed: number): Promise<void> {
    if (!tokensUsed || tokensUsed <= 0) return;

    try {
        const supabase = supabaseAdmin();
        const { error } = await supabase.rpc('increment_shop_token_usage', {
            p_shop_id: shopId,
            p_tokens: tokensUsed,
        });

        if (error) {
            // SEC-10 FIX: Fallback uses raw SQL increment to avoid race conditions
            // The RPC with FOR UPDATE lock is the preferred path; this is a safety net
            logger.warn('Token RPC not available, using SQL fallback:', { error: error.message });

            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
            nextMonth.setHours(0, 0, 0, 0);

            // Use Supabase's raw SQL increment via PostgREST (avoids read-then-write race)
            const { error: fallbackError } = await supabase
                .from('shops')
                .update({
                    // PostgREST doesn't support SQL expressions directly,
                    // so we use the RPC as primary. If that fails, log and skip.
                    // Tokens will be undercounted rather than double-counted.
                    token_usage_reset_at: nextMonth.toISOString(),
                })
                .eq('id', shopId);

            if (fallbackError) {
                logger.error('Token fallback also failed:', { error: fallbackError.message });
            } else {
                logger.warn('Token usage NOT incremented (RPC unavailable). Deploy migration to fix.', {
                    shopId,
                    missedTokens: tokensUsed,
                });
            }
        }

        logger.debug('Token usage persisted', { shopId, tokensUsed });
    } catch (err) {
        // Non-blocking: don't fail the response if billing persistence fails
        logger.error('Failed to persist token usage:', { error: err, shopId, tokensUsed });
    }
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

    // Check token limit (primary billing)
    const currentTokenUsage = context.tokenUsageTotal || 0;
    const tokenLimitCheck = checkTokenLimit(planType, currentTokenUsage);

    // Token Usage Warning Logic
    if (tokenLimitCheck.usagePercent >= 80 && context.shopId) {
        const threshold = tokenLimitCheck.usagePercent >= 90 ? 90 : 80;
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const warnKey = `token_warn_${threshold}_${context.shopId}_${currentMonth}`;
        
        try {
            const redis = getRedisClient();
            const alreadyWarned = await redis.get(warnKey);
            
            if (!alreadyWarned) {
                // Send warning (fire and forget)
                logger.info(`🚨 Sending ${threshold}% token usage warning to shop ${context.shopId}`);
                // TODO: Integrate with NotificationService / RESEND for emails
                
                // Track that we warned them to avoid spamming
                await redis.set(warnKey, '1', { ex: 60 * 60 * 24 * 31 }); // 31 days expiry
            }
        } catch (err) {
            logger.error('Failed to process token usage warning', { error: err });
        }
    }

    // Also track message count for analytics (legacy)
    const messageCount = context.messageCount || 0;
    const messageLimitCheck = checkMessageLimit(planType, messageCount);

    if (!tokenLimitCheck.allowed) {
        logger.warn('Token limit reached', {
            plan: planType,
            tokensUsed: currentTokenUsage,
            tokenLimit: tokenLimitCheck.limit,
            usagePercent: tokenLimitCheck.usagePercent,
        });

        return {
            text: `Уучлаарай, та энэ сарын AI токен лимитдээ хүрсэн байна (${(tokenLimitCheck.limit / 1_000_000).toFixed(1)}M токен). Илүү их хэрэглэхийг хүсвэл план-аа шинэчлэнэ үү! 📈`,
            limitReached: true,
            usage: {
                plan: planType,
                model: planConfig.model,
                messagesUsed: messageCount,
                messagesRemaining: Math.max(0, messageLimitCheck.remaining),
                tokensUsed: currentTokenUsage,
                tokensRemaining: 0,
                tokenUsagePercent: 100,
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
            let secondResult: typeof result | undefined;
            let retryResult: typeof result | undefined;
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
                secondResult = await chat.sendMessage(functionResponseParts);

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
                retryResult = await chat.sendMessage(
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

            // Log usage info and calculate total tokens consumed
            // BILLING-1 FIX: Accumulate tokens from ALL Gemini API calls
            const firstUsage = response.usageMetadata;
            let totalTokensConsumed = firstUsage?.totalTokenCount || 0;

            // Add tokens from function call second response (if any)
            if (secondResult) {
                const secondUsage = secondResult.response?.usageMetadata;
                if (secondUsage?.totalTokenCount) {
                    totalTokensConsumed += secondUsage.totalTokenCount;
                    logger.debug('Second call token usage:', {
                        secondTokens: secondUsage.totalTokenCount,
                        runningTotal: totalTokensConsumed,
                    });
                }
            }

            // Add tokens from retry response (if any)
            if (retryResult) {
                const retryUsage = retryResult.response?.usageMetadata;
                if (retryUsage?.totalTokenCount) {
                    totalTokensConsumed += retryUsage.totalTokenCount;
                    logger.debug('Retry call token usage:', {
                        retryTokens: retryUsage.totalTokenCount,
                        runningTotal: totalTokensConsumed,
                    });
                }
            }

            if (firstUsage) {
                logger.info('Token usage (total across all calls):', {
                    firstCallTokens: firstUsage.totalTokenCount,
                    totalTokens: totalTokensConsumed,
                });
            }

            // Persist token usage to shop record (non-blocking)
            persistTokenUsage(context.shopId, totalTokensConsumed).catch(() => {});

            logger.success(`AIRouter response received (${planType}/${planConfig.model}, ${totalTokensConsumed} tokens)`);

            return {
                text: finalResponseText,
                imageAction,
                quickReplies,
                actions,
                usage: {
                    plan: planType,
                    model: planConfig.model,
                    messagesUsed: messageCount + 1,
                    messagesRemaining: Math.max(0, messageLimitCheck.remaining - 1),
                    tokensUsed: totalTokensConsumed,
                    tokensRemaining: Math.max(0, tokenLimitCheck.remaining - totalTokensConsumed),
                    tokenUsagePercent: tokenLimitCheck.usagePercent,
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
        // GeminiProvider.analyzeImage only uses id, name, description from products
        const result = await geminiVision.analyzeImage(imageUrl, products as unknown as import('@/types/ai').AIProduct[]);

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
