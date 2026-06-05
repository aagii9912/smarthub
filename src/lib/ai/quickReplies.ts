import type { AIQuickReply } from '@/types/ai';

/**
 * Deterministic quick-reply / trigger matching (#7).
 *
 * FAQ entries are fed to the LLM as knowledge (the AI answers in its own words).
 * Quick replies are different: when a customer's message matches a configured
 * trigger keyword, we send the exact canned response WITHOUT calling the LLM —
 * instant and free (no tokens). This module is the matcher; the AIRouter calls
 * it before the LLM and short-circuits on a hit.
 *
 * Matching rules per quick reply:
 *   - is_exact_match: the whole (normalized) customer message must equal one of
 *     the trigger words.
 *   - otherwise: the message must contain one of the trigger words as a
 *     substring.
 * Trigger words shorter than 2 characters are ignored to avoid trivial hits.
 */

function normalize(s: string): string {
    return s.toLowerCase().trim();
}

export function matchQuickReply(
    message: string,
    quickReplies: AIQuickReply[] | undefined | null,
): AIQuickReply | null {
    if (!message || !quickReplies || quickReplies.length === 0) return null;

    const msg = normalize(message);
    if (!msg) return null;

    for (const qr of quickReplies) {
        const words = (qr.trigger_words || [])
            .map(normalize)
            .filter((w) => w.length >= 2);
        if (words.length === 0) continue;

        const hit = qr.is_exact_match
            ? words.some((w) => w === msg)
            : words.some((w) => msg.includes(w));

        if (hit && qr.response?.trim()) return qr;
    }

    return null;
}
