import { describe, it, expect } from 'vitest';
import { matchQuickReply } from '@/lib/ai/quickReplies';
import type { AIQuickReply } from '@/types/ai';

const qr = (over: Partial<AIQuickReply>): AIQuickReply => ({
    trigger_words: [],
    response: 'хариулт',
    ...over,
});

describe('matchQuickReply (#7)', () => {
    it('matches by substring (case-insensitive) by default', () => {
        const replies = [qr({ trigger_words: ['сайн уу'], response: 'Сайн байна уу! 👋' })];
        const m = matchQuickReply('Сайн уу, захиалга өгмөөр байна', replies);
        expect(m?.response).toBe('Сайн байна уу! 👋');
    });

    it('returns null when nothing matches', () => {
        const replies = [qr({ trigger_words: ['хүргэлт'] })];
        expect(matchQuickReply('үнэ хэд вэ', replies)).toBeNull();
    });

    it('honors is_exact_match — whole message must equal a trigger word', () => {
        const replies = [qr({ trigger_words: ['сайн уу'], is_exact_match: true, response: 'ХАРИУ' })];
        expect(matchQuickReply('сайн уу', replies)?.response).toBe('ХАРИУ');
        expect(matchQuickReply('сайн уу, юу байна', replies)).toBeNull();
    });

    it('ignores trigger words shorter than 2 chars', () => {
        const replies = [qr({ trigger_words: ['a'], response: 'no' })];
        expect(matchQuickReply('a quick brown fox', replies)).toBeNull();
    });

    it('skips replies with an empty response', () => {
        const replies = [qr({ trigger_words: ['хүргэлт'], response: '   ' })];
        expect(matchQuickReply('хүргэлт байгаа юу', replies)).toBeNull();
    });

    it('returns the first matching reply when several match', () => {
        const replies = [
            qr({ trigger_words: ['үнэ'], response: 'first' }),
            qr({ trigger_words: ['үнэ'], response: 'second' }),
        ];
        expect(matchQuickReply('үнэ хэд?', replies)?.response).toBe('first');
    });

    it('handles empty / missing inputs safely', () => {
        expect(matchQuickReply('', [qr({ trigger_words: ['x'] })])).toBeNull();
        expect(matchQuickReply('hello', [])).toBeNull();
        expect(matchQuickReply('hello', undefined)).toBeNull();
    });
});
