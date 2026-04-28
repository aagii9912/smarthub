/**
 * AIRouter - Routes AI requests to Gemini models
 *
 * Billing: Credit-based user-facing / Token-based backend accounting (1 credit = 1000 tokens).
 * Per-customer `messageCount` is analytics-only and never enforced.
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
import { persistTokenUsage } from './tokenUsage';
import {
    PlanType,
    getPlanConfig,
    getPlanTypeFromSubscription,
    isToolEnabledForPlan,
    getEnabledToolsForPlan,
    checkTokenLimit,
    tokensToCredits,
    getCreditsPerMonth,
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
};

/**
 * Extended ChatContext with plan information
 */
export interface RouterChatContext extends ChatContext {
    subscription?: {
        plan?: string;
        status?: string;
        trialEndsAt?: string;
    };
    /** Per-customer message count — analytics only, not billing. */
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
        /** Per-customer message count — analytics only. */
        messagesUsed: number;
        tokensUsed?: number;
        tokensRemaining?: number;
        tokenUsagePercent?: number;
        /** User-facing credit metrics (1 credit = 1000 tokens). */
        creditsUsed?: number;
        creditsRemaining?: number;
        creditsLimit?: number;
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
 * Filter tool definitions based on plan, optionally overridden by the
 * admin-editable plans.enabled_tools column.
 */
function getToolsForPlan(plan: PlanType, override?: ToolName[] | null) {
    const enabledTools = getEnabledToolsForPlan(plan, override);
    const filtered = TOOL_DEFINITIONS.filter(tool =>
        enabledTools.includes(tool.name as ToolName)
    );
    return getGeminiFunctionDeclarations(filtered);
}

/**
 * Load the per-plan AI tool override from the plans table (admin-editable).
 * Returns null when the plan has no override or the lookup fails — callers
 * should treat null as "use the hardcoded default from PLAN_CONFIGS".
 */
async function loadPlanEnabledToolsOverride(slug: string | undefined | null): Promise<ToolName[] | null> {
    if (!slug) return null;
    try {
        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('plans')
            .select('enabled_tools')
            .eq('slug', slug)
            .maybeSingle();
        if (error || !data?.enabled_tools || !Array.isArray(data.enabled_tools) || data.enabled_tools.length === 0) {
            return null;
        }
        return data.enabled_tools as ToolName[];
    } catch (err) {
        logger.warn('loadPlanEnabledToolsOverride failed, falling back to hardcoded:', { error: err, slug });
        return null;
    }
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

    // Trial expiry gate — block AI when trial period is over and user hasn't paid
    const subStatus = context.subscription?.status;
    const trialEndsAt = context.subscription?.trialEndsAt;
    const trialExpired =
        subStatus === 'expired_trial' ||
        (subStatus === 'trial' && !!trialEndsAt && new Date(trialEndsAt) < new Date());

    if (trialExpired) {
        logger.warn('Trial expired — blocking AI', {
            shopId: context.shopId,
            plan: planType,
            status: subStatus,
            trialEndsAt,
        });
        return {
            text: 'Туршилтын хугацаа дууссан байна. Үргэлжлүүлэхийн тулд багц сонгоно уу. 🛒',
            limitReached: true,
            usage: {
                plan: planType,
                model: planConfig.model,
                messagesUsed: context.messageCount || 0,
                tokensUsed: context.tokenUsageTotal || 0,
                tokensRemaining: 0,
                tokenUsagePercent: 0,
                creditsUsed: 0,
                creditsRemaining: 0,
                creditsLimit: getCreditsPerMonth(planType),
            },
        };
    }

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

    // Per-customer message count — analytics only, not enforced.
    const messageCount = context.messageCount || 0;
    const creditsLimit = getCreditsPerMonth(planType);
    const creditsUsed = tokensToCredits(currentTokenUsage);

    if (!tokenLimitCheck.allowed) {
        logger.warn('Credit limit reached', {
            plan: planType,
            tokensUsed: currentTokenUsage,
            tokenLimit: tokenLimitCheck.limit,
            creditsUsed,
            creditsLimit,
            usagePercent: tokenLimitCheck.usagePercent,
        });

        return {
            text: `Уучлаарай, та энэ сарын AI credit лимитдээ хүрсэн байна (${creditsUsed.toLocaleString()}/${creditsLimit.toLocaleString()} credits). Илүү их хэрэглэхийг хүсвэл план-аа шинэчлэнэ үү! 📈`,
            limitReached: true,
            usage: {
                plan: planType,
                model: planConfig.model,
                messagesUsed: messageCount,
                tokensUsed: currentTokenUsage,
                tokensRemaining: 0,
                tokenUsagePercent: 100,
                creditsUsed,
                creditsRemaining: 0,
                creditsLimit,
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

        // Resolve admin-editable per-plan tool override (plans.enabled_tools).
        // Returns null when the plan row has no override → falls back to PLAN_CONFIGS.
        const enabledToolsOverride = await loadPlanEnabledToolsOverride(context.subscription?.plan);

        // Get function declarations enabled for this plan
        const functionDeclarations = planConfig.features.toolCalling
            ? getToolsForPlan(planType, enabledToolsOverride)
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

            // Multi-turn tool-call loop.
            //
            // Gemini-д олон шатлалт tool call хийж болно (жишээ нь:
            // search_products → add_to_cart → create_order). Тиймээс нэг сонгон
            // авалтанд хязгаарлахгүй — max iteration-оор аюулгүй болго.
            const MAX_TOOL_ITERATIONS = 5;

            const toolContext: ToolExecutionContext = {
                shopId: context.shopId,
                customerId: context.customerId,
                customerName: context.customerName,
                products: context.products,
                notifySettings: context.notifySettings,
            };

            const extractText = (res: Awaited<ReturnType<typeof chat.sendMessage>>): string => {
                try {
                    return res.response.text?.() || '';
                } catch {
                    return '';
                }
            };

            // Initial turn
            let currentResult = await chat.sendMessage(message);
            let finalResponseText = extractText(currentResult);

            let totalTokensConsumed = currentResult.response.usageMetadata?.totalTokenCount || 0;
            let lastFunctionResponseParts: Part[] = [];
            let iteration = 0;

            // Tool-call loop — continues as long as Gemini keeps requesting tools
            while (iteration < MAX_TOOL_ITERATIONS) {
                const functionCalls = currentResult.response.functionCalls?.();
                if (!functionCalls || functionCalls.length === 0) break;
                if (!planConfig.features.toolCalling) break;

                iteration++;
                logger.info(`Gemini tool-call iteration ${iteration}:`, {
                    count: functionCalls.length,
                    names: functionCalls.map(fc => fc.name),
                });

                const functionResponseParts: Part[] = [];

                for (const fc of functionCalls) {
                    const functionName = fc.name as ToolName;

                    if (!isToolEnabledForPlan(functionName, planType, enabledToolsOverride)) {
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

                lastFunctionResponseParts = functionResponseParts;

                // Send tool results back to Gemini — the response may be:
                //  a) plain text (loop exits)
                //  b) more function calls (loop continues)
                currentResult = await chat.sendMessage(functionResponseParts);
                finalResponseText = extractText(currentResult);
                totalTokensConsumed += currentResult.response.usageMetadata?.totalTokenCount || 0;
            }

            if (iteration === MAX_TOOL_ITERATIONS) {
                const stillCalling = (currentResult.response.functionCalls?.() ?? []).length > 0;
                if (stillCalling) {
                    logger.warn('AIRouter hit MAX_TOOL_ITERATIONS — using last partial result', {
                        shopId: context.shopId,
                        customerId: context.customerId,
                    });
                }
            }

            // Empty-text fallback after tool loop
            if (iteration > 0 && !finalResponseText.trim()) {
                const candidates = currentResult.response.candidates;
                logger.warn('Gemini returned empty after tool call loop', {
                    iterations: iteration,
                    candidateCount: candidates?.length,
                    finishReason: candidates?.[0]?.finishReason,
                    safetyRatings: candidates?.[0]?.safetyRatings?.map(r => ({ category: r.category, probability: r.probability })),
                    partTypes: candidates?.[0]?.content?.parts?.map(p => Object.keys(p)),
                });

                const lastToolMessage = lastFunctionResponseParts
                    .map(p => (p.functionResponse?.response as Record<string, unknown>)?.message)
                    .filter(Boolean)
                    .pop() as string | undefined;

                if (lastToolMessage) {
                    logger.info('Using tool message as fallback');
                    finalResponseText = lastToolMessage;
                }
            }

            // No-tool-calls empty-response retry (original behavior)
            if (iteration === 0 && !finalResponseText.trim()) {
                logger.warn('Gemini returned empty, retrying once...');

                const retryResult = await chat.sendMessage(
                    message + '\n\n(Хэрэглэгчид заавал хариу бичнэ үү)'
                );
                finalResponseText = extractText(retryResult);
                totalTokensConsumed += retryResult.response.usageMetadata?.totalTokenCount || 0;

                if (!finalResponseText.trim()) {
                    logger.warn('Gemini still empty after retry', {
                        historyLength: geminiHistory.length,
                    });
                } else {
                    logger.info('Gemini retry succeeded');
                }
            }

            if (totalTokensConsumed > 0) {
                logger.info('Token usage (total across all calls):', {
                    toolIterations: iteration,
                    totalTokens: totalTokensConsumed,
                });
            }

            // Persist token usage to shop record (non-blocking)
            persistTokenUsage(context.shopId, totalTokensConsumed, 'chat_reply', {
                model: planConfig.model,
            }).catch(() => {});

            logger.success(`AIRouter response received (${planType}/${planConfig.model}, ${totalTokensConsumed} tokens)`);

            const tokensRemaining = Math.max(0, tokenLimitCheck.remaining - totalTokensConsumed);
            return {
                text: finalResponseText,
                imageAction,
                quickReplies,
                actions,
                usage: {
                    plan: planType,
                    model: planConfig.model,
                    messagesUsed: messageCount + 1,
                    tokensUsed: totalTokensConsumed,
                    tokensRemaining,
                    tokenUsagePercent: tokenLimitCheck.usagePercent,
                    creditsUsed: tokensToCredits(currentTokenUsage + totalTokensConsumed),
                    creditsRemaining: Math.floor(tokensRemaining / 1000),
                    creditsLimit,
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
 *
 * `shopId` is optional for backward compatibility, but callers should pass it
 * so vision tokens get attributed to the right shop in the breakdown.
 */
export async function analyzeProductImageWithPlan(
    imageUrl: string,
    products: Array<{ id: string; name: string; description?: string }>,
    planType: PlanType = 'starter',
    shopId?: string
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
        const visionModel = 'gemini-3.1-flash-lite-preview';
        const geminiVision = new GeminiProvider(visionModel);

        if (!geminiVision.isAvailable()) {
            logger.warn('Gemini not available for vision');
            return { matchedProduct: null, confidence: 0, description: 'Vision API тохируулагдаагүй байна.' };
        }

        logger.info('Using Gemini 2.5 Flash for vision analysis...');
        // GeminiProvider.analyzeImage only uses id, name, description from products
        const result = await geminiVision.analyzeImage(imageUrl, products as unknown as import('@/types/ai').AIProduct[]);

        if (shopId && result.tokensUsed && result.tokensUsed > 0) {
            persistTokenUsage(shopId, result.tokensUsed, 'vision', { model: visionModel }).catch(() => {});
        }

        logger.success('Gemini Vision analysis complete', {
            matched: result.matchedProduct,
            confidence: result.confidence,
            tokensUsed: result.tokensUsed,
        });
        const { tokensUsed: _tokensUsed, ...visionPayload } = result;
        return visionPayload;

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
    getEnabledToolsForPlan,
    tokensToCredits,
    creditsToTokens,
    getCreditsPerMonth,
    checkCreditLimit,
    TOKENS_PER_CREDIT,
    PLAN_CONFIGS,
} from './config/plans';
