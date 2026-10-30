/**
 * Shared Anthropic client + helpers.
 *
 * Claude Haiku 5.5 (Messages API) constraints:
 * - `temperature` / `top_p` / `top_k` are rejected → never send them.
 * - Assistant prefill is rejected → `messages` must end with a user turn.
 * - Thinking is on by default and counts toward `max_tokens`. Replies are
 *   short and latency-sensitive, so we turn it off (allowed at effort ≤ high)
 *   and run at `low` effort everywhere.
 */

import Anthropic from '@anthropic-ai/sdk';

/** Default chat model. Override per-environment with ANTHROPIC_MODEL. */
export const DEFAULT_AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

/** Request settings shared by every call site (see header comment). */
export const AI_REQUEST_DEFAULTS = {
    thinking: { type: 'disabled' as const },
    output_config: { effort: 'low' as const },
};

/**
 * Legacy model ids (stored in DB rows / admin settings from the OpenAI and
 * Gemini eras) are mapped onto the current Claude model so old config keeps
 * working.
 */
export function resolveBackendModel(model?: string | null): string {
    if (model && /^claude-/i.test(model)) return model;
    return DEFAULT_AI_MODEL;
}

let client: Anthropic | null = null;

/**
 * Lazily constructed so a missing key doesn't crash module load — e.g.
 * during `next build`.
 */
export function getAnthropic(): Anthropic {
    if (!client) {
        client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    }
    return client;
}

export function isAnthropicConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
}

/** Total billable tokens for one response (input incl. cache reads/writes + output). */
export function totalTokens(usage: Anthropic.Usage | undefined): number {
    if (!usage) return 0;
    return (usage.input_tokens ?? 0)
        + (usage.cache_creation_input_tokens ?? 0)
        + (usage.cache_read_input_tokens ?? 0)
        + (usage.output_tokens ?? 0);
}

/** Concatenate the text blocks of a response (skips thinking / tool_use). */
export function extractText(message: Anthropic.Message): string {
    return message.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('');
}

export interface CompletionResult {
    text: string;
    tokensUsed: number;
}

/**
 * Single-shot completion for simple prompt → text/JSON call sites
 * (summaries, parsers, instruction generators).
 */
export async function simpleCompletion(opts: {
    prompt: string;
    system?: string;
    maxTokens?: number;
    json?: boolean;
    model?: string;
}): Promise<CompletionResult> {
    const system = [
        opts.system,
        opts.json ? 'Respond with a single valid JSON object only — no code fences, no prose.' : undefined,
    ].filter(Boolean).join('\n\n');

    const res = await getAnthropic().messages.create({
        model: resolveBackendModel(opts.model),
        max_tokens: opts.maxTokens ?? 1024,
        ...AI_REQUEST_DEFAULTS,
        ...(system ? { system } : {}),
        messages: [{ role: 'user', content: opts.prompt }],
    });

    let text = extractText(res);
    if (opts.json) {
        // Tolerate a stray ```json fence so callers' JSON.parse keeps working.
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
    }

    return { text, tokensUsed: totalTokens(res.usage) };
}
