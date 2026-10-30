/**
 * AIRouter - Routes AI requests to Anthropic Claude models (Haiku 5.5 by default)
 *
 * Billing: Credit-based user-facing / Token-based backend accounting (1 credit = 1000 tokens).
 * Per-customer `messageCount` is analytics-only and never enforced.
 * Strategy:
 * - All plans use the Claude model from `resolveBackendModel` (ANTHROPIC_MODEL env)
 * - Function calling via Messages API `tools` (thinking off, effort 'low')
 * - Token usage tracked per-shop and persisted to Supabase
 */

import type Anthropic from '@anthropic-ai/sdk';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';
import { getRedisClient } from '@/lib/redis/client';
import { sendPushNotification } from '@/lib/notifications';
import { isNotificationEnabled } from '@/lib/notifications-prefs';
import type { ChatContext, ChatMessage, ChatResponse, ImageAction, ChatAction } from '@/types/ai';
import { buildSystemPrompt } from './services/PromptService';
import { PRODUCT_DETAILS_TOOL, getProductDetails, needsProductDetails } from './services/ProductContext';
import { matchQuickReply } from './quickReplies';
import { executeTool, ToolExecutionContext, ToolExecutionResult } from './services/ToolExecutor';
import { TOOL_DEFINITIONS, ToolName, getClaudeTools } from './tools/definitions';
import {
    AI_REQUEST_DEFAULTS,
    extractText,
    getAnthropic,
    isAnthropicConfigured,
    resolveBackendModel,
    totalTokens,
} from './anthropicClient';
import { persistTokenUsage } from './tokenUsage';
import { getAllowedToolsForRole } from './agents/registry';
import type { AgentRole, AgentCapability } from './agents/types';
import {
    PlanType,
    getPlanConfig,
    getPlanTypeFromSubscription,
    normalizePlanSlug,
    isToolEnabledForPlan,
    getEnabledToolsForPlan,
    checkTokenLimit,
    tokensToCredits,
    getCreditsPerMonth,
    TOKENS_PER_CREDIT,
} from './config/plans';

if (!isAnthropicConfigured()) {
    logger.warn('ANTHROPIC_API_KEY environment variable is not set — AI features will not work');
}

/**
 * Extended ChatContext with plan information
 */
export interface RouterChatContext extends ChatContext {
    subscription?: {
        plan?: string;
        status?: string;
        trialEndsAt?: string;
        /**
         * DB-authoritative token limit for this plan's current period (from
         * `plans.limits.tokens_per_month` via the billing snapshot). When
         * present it overrides the hardcoded PLAN_CONFIGS limit so enforcement
         * matches the dashboard. Null/undefined → fall back to plan config.
         */
        tokensLimit?: number | null;
    };
    /** Per-customer message count — analytics only, not billing. */
    messageCount?: number;
    /**
     * Tokens consumed in the current rolling 30-day window. With the per-user
     * pool, this is the SUM across all of the user's shops (not per-shop).
     */
    tokenUsageTotal?: number;
    /**
     * Owner of the shop. Required so token persistence accounts the call
     * against the correct user pool. Optional only for legacy callers — when
     * absent, persistTokenUsage falls back to a shop→user lookup.
     */
    userId?: string;
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
 * Convert ChatMessage history to Claude messages.
 * Empty messages are dropped — they add tokens without context. The API
 * merges consecutive same-role turns, but the first turn must be `user`, so
 * leading assistant messages are dropped. Retries for 429/5xx are handled
 * per-request by the Anthropic SDK (maxRetries), which also avoids re-running
 * already-executed tools on a retry.
 */
function toClaudeHistory(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const history = messages
        .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const firstUser = history.findIndex(m => m.role === 'user');
    return firstUser === -1 ? [] : history.slice(firstUser);
}

/** Normalize tool input defensively — never trust the model's shape. */
function toToolArgs(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
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
    return getClaudeTools(filtered);
}

/**
 * Filter tools by plan AND agent role/capabilities. The intersection means a
 * tool must be both enabled by the plan and supported by the active role.
 *
 * `userOverride` lets a shop owner narrow the tool list further (e.g. an
 * info-agent shop disabling `collect_contact_info`). It can never broaden
 * past the plan/role intersection.
 */
export function getToolsForAgent(args: {
    plan: PlanType;
    role: AgentRole;
    capabilities: AgentCapability[];
    planOverride?: ToolName[] | null;
    userOverride?: ToolName[] | null;
}) {
    const { plan, role, capabilities, planOverride, userOverride } = args;

    const planAllowed = new Set(getEnabledToolsForPlan(plan, planOverride));
    const roleAllowed = new Set(getAllowedToolsForRole(role, capabilities));

    let intersection = TOOL_DEFINITIONS.filter((tool) => {
        if (!planAllowed.has(tool.name as ToolName)) return false;
        if (!roleAllowed.has(tool.name as ToolName)) return false;
        // If the tool itself declares capabilities, require overlap with
        // the active set (or the tool's whitelist for non-hybrid roles).
        if (tool.capabilities && tool.capabilities.length > 0) {
            const activeCaps = role === 'hybrid' ? capabilities : ([role] as AgentCapability[]);
            const ok = tool.capabilities.some((c) => activeCaps.includes(c));
            if (!ok) return false;
        }
        return true;
    });

    if (userOverride && userOverride.length > 0) {
        const userSet = new Set(userOverride);
        intersection = intersection.filter((t) => userSet.has(t.name as ToolName));
    }

    return getClaudeTools(intersection);
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
            .eq('slug', normalizePlanSlug(slug)!)
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
 * Main AI Router - generates response based on plan configuration using the Anthropic SDK
 */
export async function routeToAI(
    message: string,
    context: RouterChatContext,
    previousHistory: ChatMessage[] = []
): Promise<RouterResponse> {
    // Determine plan type
    const planType = getPlanTypeFromSubscription(context.subscription);
    const planConfig = getPlanConfig(planType);

    // Effective billing limit for THIS shop's current period. Prefer the
    // DB-authoritative limit threaded from the billing snapshot
    // (`plans.limits.tokens_per_month`) so the AI enforces exactly what the
    // dashboard shows; fall back to the hardcoded plan config otherwise. This
    // prevents "Pro plan but lower-tier credit" mismatches.
    const subTokensLimit = context.subscription?.tokensLimit;
    const effectiveTokenLimit =
        typeof subTokensLimit === 'number' && subTokensLimit > 0
            ? subTokensLimit
            : planConfig.tokensPerMonth;
    const effectiveCreditsLimit = Math.floor(effectiveTokenLimit / TOKENS_PER_CREDIT);

    // Defense-in-depth: webhook-н gate-аас гадуур AI Router-руу шууд орж ирвэл
    // (cron, internal call гэх мэт) төлбөргүй хэрэглэгчийг хааж байна.
    const subStatus = context.subscription?.status;
    const subPlan = context.subscription?.plan;
    const isAuthorizedStatus =
        subStatus === 'active' ||
        subStatus === 'trial' ||
        subStatus === 'trialing';

    if (!isAuthorizedStatus || !subPlan || subPlan === 'unpaid') {
        logger.warn('No active paid subscription — blocking AI', {
            shopId: context.shopId,
            status: subStatus,
            plan: subPlan,
        });
        return {
            text: '',
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
                creditsLimit: effectiveCreditsLimit,
            },
        };
    }

    // (3 хоногийн trial болиулсан — trial-expiry gate устгасан. Lite одоо үнэгүй
    //  active план тул бүх authorized хэрэглэгч хязгаараа хүртэл AI ашиглана.)

    // Deterministic quick-reply / trigger matching (#7). If the customer's
    // message matches a configured trigger keyword, return that canned response
    // directly — no LLM call, so it's instant and consumes no tokens. FAQ stays
    // AI-driven knowledge; quick replies are exact/keyword canned responses.
    const quickReplyMatch = matchQuickReply(message, context.quickReplies);
    if (quickReplyMatch) {
        logger.info('Quick-reply trigger matched — skipping LLM', {
            shopId: context.shopId,
            exact: !!quickReplyMatch.is_exact_match,
        });
        return {
            text: quickReplyMatch.response,
            usage: {
                plan: planType,
                model: 'quick-reply',
                messagesUsed: context.messageCount || 0,
                tokensUsed: context.tokenUsageTotal || 0,
                creditsLimit: effectiveCreditsLimit,
            },
        };
    }

    // Check token limit (primary billing)
    const currentTokenUsage = context.tokenUsageTotal || 0;
    const tokenLimitCheck = checkTokenLimit(planType, currentTokenUsage, effectiveTokenLimit);

    // Token Usage Warning Logic
    if (tokenLimitCheck.usagePercent >= 80 && context.shopId) {
        const threshold = tokenLimitCheck.usagePercent >= 90 ? 90 : 80;
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const warnKey = `token_warn_${threshold}_${context.shopId}_${currentMonth}`;
        
        try {
            const redis = getRedisClient();
            const alreadyWarned = await redis.get(warnKey);
            
            if (!alreadyWarned) {
                // Persist the warning event so the dashboard / cron job can
                // surface it. Email delivery via Resend is wired up separately
                // by the weekly token report cron (`/api/cron/weekly-token-report`)
                // — sending here too would double-notify.
                logger.info(`🚨 ${threshold}% token usage warning for shop ${context.shopId}`);

                // Track that we warned them to avoid spamming
                await redis.set(warnKey, '1', { ex: 60 * 60 * 24 * 31 }); // 31 days expiry

                // Push notification — owner approaching plan limit.
                try {
                    const enabled = await isNotificationEnabled(context.shopId, 'plan_limit');
                    if (enabled) {
                        await sendPushNotification(context.shopId, {
                            title: threshold >= 90 ? '🚨 Планы хязгаар бараг дүүрлээ' : '⚠️ Планы хязгаарын ойролцоо байна',
                            body: `AI credit ${tokenLimitCheck.usagePercent}%-д хүрсэн. План шинэчилж үргэлжлүүлнэ үү.`,
                            url: '/dashboard/subscription',
                            tag: `plan-limit-${threshold}-${context.shopId}-${currentMonth}`,
                        });
                    }
                } catch (pushErr) {
                    logger.warn('Plan limit push notification failed', {
                        error: pushErr instanceof Error ? pushErr.message : String(pushErr),
                    });
                }
            }
        } catch (err) {
            logger.error('Failed to process token usage warning', { error: err });
        }
    }

    // Per-customer message count — analytics only, not enforced.
    const messageCount = context.messageCount || 0;
    const creditsLimit = effectiveCreditsLimit;
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

        // Notify the shop OWNER that their AI credit is exhausted so they can
        // top up / upgrade. The end customer must NEVER see this billing text —
        // the webhook & cron customer channels stay silent whenever
        // `limitReached` is set (see those guards). The text below is only
        // surfaced to the owner via the dashboard AI preview endpoint.
        if (context.shopId) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const exhaustKey = `credit_exhausted_${context.shopId}_${currentMonth}`;
            try {
                const redis = getRedisClient();
                const alreadyNotified = await redis.get(exhaustKey);
                if (!alreadyNotified) {
                    const enabled = await isNotificationEnabled(context.shopId, 'plan_limit');
                    if (enabled) {
                        await sendPushNotification(context.shopId, {
                            title: '🛑 AI credit дууссан',
                            body: `Энэ сарын AI credit (${creditsUsed.toLocaleString()}/${creditsLimit.toLocaleString()}) дууссан тул AI хариулахаа зогсоосон. План шинэчилж үргэлжлүүлнэ үү.`,
                            url: '/dashboard/subscription',
                            tag: `credit-exhausted-${context.shopId}-${currentMonth}`,
                        });
                    }
                    await redis.set(exhaustKey, '1', { ex: 60 * 60 * 24 * 31 }); // 31 days
                }
            } catch (err) {
                logger.error('Failed to send credit-exhausted owner notification', { error: err });
            }
        }

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
        const modelName = planConfig.model;
        const backendModel = resolveBackendModel(modelName);

        logger.info(`AIRouter: Routing to Claude [${backendModel}]`);

        // Build system prompt
        const productDetailsOnDemand = planConfig.features.toolCalling && needsProductDetails(context.products);
        const systemPrompt = buildSystemPrompt({
            ...context,
            planFeatures: {
                ai_model: modelName,
                sales_intelligence: planConfig.features.salesIntelligence,
                ai_memory: planConfig.features.memory,
                max_tokens: planConfig.maxTokens,
            },
        }, productDetailsOnDemand, message);

        // Resolve admin-editable per-plan tool override (plans.enabled_tools).
        // Returns null when the plan row has no override → falls back to PLAN_CONFIGS.
        const enabledToolsOverride = await loadPlanEnabledToolsOverride(context.subscription?.plan);

        // Resolve agent role + capabilities. Defaults preserve old sales-only
        // behaviour for shops that haven't been migrated yet.
        const agentRole: AgentRole = context.aiAgentRole ?? 'sales';
        const agentCapabilities: AgentCapability[] =
            context.aiAgentCapabilities && context.aiAgentCapabilities.length > 0
                ? context.aiAgentCapabilities
                : ['sales'];

        // Get function tools enabled for this plan + role/capabilities.
        const tools = planConfig.features.toolCalling
            ? getToolsForAgent({
                  plan: planType,
                  role: agentRole,
                  capabilities: agentCapabilities,
                  planOverride: enabledToolsOverride,
              })
            : undefined;

        // Internal context lookup: only exposes descriptions already authorized
        // for this shop, with no writes or additional plan capabilities.
        if (productDetailsOnDemand) tools?.push(PRODUCT_DETAILS_TOOL);

        // Defensive guard: the model occasionally invents a tool name that
        // wasn't in `tools`. We cross-check on each invocation.
        const allowedToolNames = new Set(
            (tools || []).map((t) => t.name as ToolName),
        );

        const messages: Anthropic.MessageParam[] = [
            ...toClaudeHistory(previousHistory),
            { role: 'user', content: message },
        ];

        // Same shop → same prompt prefix (rules + catalog); the cache
        // breakpoint on the system block lets tools + system be reused
        // across that shop's requests.
        const system: Anthropic.TextBlockParam[] = [
            { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        ];

        const anthropic = getAnthropic();
        let apiCall = 0;
        const complete = async (msgs: Anthropic.MessageParam[]): Promise<Anthropic.Message> => {
            const result = await anthropic.messages.create({
                model: backendModel,
                max_tokens: planConfig.maxTokens,
                // Haiku 5.5: sampling params and prefill are rejected;
                // thinking off + low effort keeps replies fast and cheap.
                ...AI_REQUEST_DEFAULTS,
                system,
                messages: msgs,
                ...(tools && tools.length > 0 ? { tools } : {}),
            });
            const usage = result.usage;
            // Production telemetry, unlike development-only logger.info.
            // Never log prompts, customer messages, tool arguments or keys.
            console.info(JSON.stringify({
                event: 'ai_token_usage',
                shopId: context.shopId,
                model: backendModel,
                apiCall: ++apiCall,
                promptTokens: usage?.input_tokens ?? null,
                outputTokens: usage?.output_tokens ?? null,
                cachedTokens: usage?.cache_read_input_tokens ?? null,
                cacheWriteTokens: usage?.cache_creation_input_tokens ?? null,
                totalTokens: totalTokens(usage),
            }));
            return result;
        };

        const getToolUses = (res: Anthropic.Message): Anthropic.ToolUseBlock[] =>
            res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

        // Multi-turn tool-call loop.
        //
        // Model олон шатлалт tool call хийж болно (жишээ нь:
        // search_products → add_to_cart → create_order). Тиймээс нэг сонгон
        // авалтанд хязгаарлахгүй — max iteration-оор аюулгүй болго.
        const MAX_TOOL_ITERATIONS = 5;

        const toolContext: ToolExecutionContext = {
            shopId: context.shopId,
            customerId: context.customerId,
            customerName: context.customerName,
            products: context.products,
            notifySettings: context.notifySettings,
            // Lets shared handlers branch on the shop's archetype instead of
            // assuming commerce (see ToolExecutionContext.capabilities).
            capabilities: agentCapabilities,
            // Per-reply set so the cart handler can ignore model-side
            // duplicate add_to_cart firings within one chat turn.
            addToCartKeys: new Set<string>(),
        };

        const runToolCall = async (fc: Anthropic.ToolUseBlock): Promise<Record<string, unknown>> => {
            const args = toToolArgs(fc.input);

            if (productDetailsOnDemand && fc.name === PRODUCT_DETAILS_TOOL.name) {
                return getProductDetails(context.products, args) as Record<string, unknown>;
            }

            const functionName = fc.name as ToolName;

            if (!isToolEnabledForPlan(functionName, planType, enabledToolsOverride)) {
                logger.warn(`Tool ${functionName} not enabled for ${planType} plan`);
                return {
                    error: `Энэ боломж (${functionName}) одоогийн ${planType} багцад идэвхгүй байна. Pro багц руу шилжвэл захиалга, төлбөр төлөх, дэлгэрэнгүй тайлан зэрэг бүх боломж нээгдэнэ! 🚀`,
                };
            }

            if (allowedToolNames.size > 0 && !allowedToolNames.has(functionName)) {
                logger.warn(`Tool ${functionName} not allowed for agent role ${agentRole}`);
                return {
                    error: `Энэ AI agent (${agentRole}) тус үүргэд "${functionName}" tool ашиглах боломжгүй. AI Settings-ээс үүрэг тохируулна уу.`,
                };
            }

            logger.info(`Executing tool: ${functionName}`, { data: args });

            const toolResult: ToolExecutionResult = await executeTool(functionName, args, toolContext);

            if (toolResult.imageAction) {
                imageAction = toolResult.imageAction;
            }
            if (toolResult.quickReplies && toolResult.quickReplies.length > 0) {
                quickReplies = toolResult.quickReplies;
            }
            if (toolResult.actions && toolResult.actions.length > 0) {
                actions = [...(actions || []), ...toolResult.actions];
            }

            return toolResult.success
                ? { success: true, message: toolResult.message, ...toolResult.data }
                : { error: toolResult.error };
        };

        // Initial turn
        let currentResult = await complete(messages);
        let finalResponseText = extractText(currentResult);

        let totalTokensConsumed = totalTokens(currentResult.usage);
        let lastToolResponses: Array<Record<string, unknown>> = [];
        let iteration = 0;

        // Tool-call loop — continues as long as the model keeps requesting tools
        while (iteration < MAX_TOOL_ITERATIONS) {
            const functionCalls = getToolUses(currentResult);
            if (functionCalls.length === 0) break;
            if (!planConfig.features.toolCalling) break;

            iteration++;
            logger.info(`Claude tool-call iteration ${iteration}:`, {
                count: functionCalls.length,
                names: functionCalls.map(fc => fc.name),
            });

            // Echo the full assistant content (text + tool_use blocks) back
            // unchanged, then answer every tool_use id exactly once — all
            // results in a single user turn.
            messages.push({ role: 'assistant', content: currentResult.content });

            const toolResponses: Array<Record<string, unknown>> = [];
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const fc of functionCalls) {
                const response = await runToolCall(fc);
                toolResponses.push(response);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: fc.id,
                    content: JSON.stringify(response),
                    ...('error' in response ? { is_error: true } : {}),
                });
            }
            messages.push({ role: 'user', content: toolResults });
            lastToolResponses = toolResponses;

            // Send tool results back — the response may be:
            //  a) plain text (loop exits)
            //  b) more tool calls (loop continues)
            currentResult = await complete(messages);
            finalResponseText = extractText(currentResult);
            totalTokensConsumed += totalTokens(currentResult.usage);
        }

        if (iteration === MAX_TOOL_ITERATIONS && getToolUses(currentResult).length > 0) {
            logger.warn('AIRouter hit MAX_TOOL_ITERATIONS — using last partial result', {
                shopId: context.shopId,
                customerId: context.customerId,
            });
        }

        // Empty-text fallback after tool loop
        if (iteration > 0 && !finalResponseText.trim()) {
            logger.warn('Claude returned empty after tool call loop', {
                iterations: iteration,
                stopReason: currentResult.stop_reason,
                refusal: currentResult.stop_reason === 'refusal',
            });

            const lastToolMessage = lastToolResponses
                .map(r => r.message)
                .filter((m): m is string => typeof m === 'string' && m.length > 0)
                .pop();

            if (lastToolMessage) {
                logger.info('Using tool message as fallback');
                finalResponseText = lastToolMessage;
            }
        }

        // No-tool-calls empty-response retry (original behavior)
        if (iteration === 0 && !finalResponseText.trim()) {
            logger.warn('Claude returned empty, retrying once...', {
                stopReason: currentResult.stop_reason,
            });

            const retryResult = await complete([
                ...messages.slice(0, -1),
                { role: 'user', content: message + '\n\n(Хэрэглэгчид заавал хариу бичнэ үү)' },
            ]);
            finalResponseText = extractText(retryResult);
            totalTokensConsumed += totalTokens(retryResult.usage);

            if (!finalResponseText.trim()) {
                logger.warn('Claude still empty after retry', {
                    historyLength: messages.length,
                });
            } else {
                logger.info('Claude retry succeeded');
            }
        }

        if (totalTokensConsumed > 0) {
            logger.info('Token usage (total across all calls):', {
                toolIterations: iteration,
                totalTokens: totalTokensConsumed,
            });
        }

        // Persist token usage to user pool + shop analytics (non-blocking).
        if (context.userId) {
            persistTokenUsage(context.userId, context.shopId, totalTokensConsumed, 'chat_reply', {
                model: backendModel,
            }).catch(() => {});
        } else {
            persistTokenUsage(context.shopId, totalTokensConsumed, 'chat_reply', {
                model: backendModel,
            }).catch(() => {});
        }

        logger.success(`AIRouter response received (${planType}/${backendModel}, ${totalTokensConsumed} tokens)`);

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
 * Uses the Claude model (Haiku 5.5) for vision analysis
 *
 * `shopId` is optional for backward compatibility, but callers should pass it
 * so vision tokens get attributed to the right shop in the breakdown.
 */
export async function analyzeProductImageWithPlan(
    imageUrl: string,
    products: Array<{ id: string; name: string; description?: string; image_url?: string | null; images?: string[] }>,
    planType: PlanType = 'starter',
    shopId?: string
): Promise<{
    matchedProduct: string | null;
    matchedProductId?: string | null;
    confidence: number;
    description: string;
    isReceipt?: boolean;
    receiptAmount?: number;
}> {
    const planConfig = getPlanConfig(planType);

    if (!planConfig.features.vision) {
        return {
            matchedProduct: null,
            matchedProductId: null,
            confidence: 0,
            description: 'Image analysis is not available on your current plan.',
        };
    }

    try {
        const { AnthropicProvider } = await import('./providers/AnthropicProvider');
        const visionModel = resolveBackendModel(planConfig.model);
        const visionProvider = new AnthropicProvider(visionModel);

        if (!visionProvider.isAvailable()) {
            logger.warn('Anthropic not available for vision');
            return { matchedProduct: null, matchedProductId: null, confidence: 0, description: 'Vision API тохируулагдаагүй байна.' };
        }

        logger.info(`Using ${visionModel} for vision analysis...`);
        // analyzeImage image-to-image тааруулалт хийдэг тул бараа бүрийн
        // image_url/images-ийг дамжуулна (байгаа бол). Зураггүй бараа нэрээр
        // танигдана.
        const result = await visionProvider.analyzeImage(imageUrl, products as unknown as import('@/types/ai').AIProduct[]);

        if (shopId && result.tokensUsed && result.tokensUsed > 0) {
            persistTokenUsage(shopId, result.tokensUsed, 'vision', { model: visionModel }).catch(() => {});
        }

        logger.success('Vision analysis complete', {
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
        return { matchedProduct: null, matchedProductId: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

// Re-export types
export type { PlanType, AIModel } from './config/plans';
export {
    getPlanConfig,
    getPlanTypeFromSubscription,
    normalizePlanSlug,
    getEnabledToolsForPlan,
    tokensToCredits,
    creditsToTokens,
    getCreditsPerMonth,
    checkCreditLimit,
    TOKENS_PER_CREDIT,
    PLAN_CONFIGS,
} from './config/plans';
