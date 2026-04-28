/**
 * Unit tests for src/lib/ai/tokenFeatures.ts
 *
 * Why: this constants module is the single source of truth for token-usage
 * categories — consumed by `persistTokenUsage`, the DB seed, the dashboard
 * legend, and the weekly email digest. If a key is added/removed/renamed
 * here without corresponding wiring elsewhere, the breakdown becomes
 * inconsistent. These tests freeze the contract.
 */

import { describe, it, expect } from 'vitest';
import {
    TOKEN_FEATURES,
    TOKEN_FEATURE_KEYS,
    getFeatureLabel,
    isKnownFeature,
    type TokenFeature,
} from '@/lib/ai/tokenFeatures';

const EXPECTED_KEYS: TokenFeature[] = [
    'chat_reply',
    'ai_memo',
    'vision',
    'system_prompt_gen',
    'product_parse',
    'lead_qualify',
    'comment_auto',
    'tool_call',
    'unknown_legacy',
];

describe('tokenFeatures — TOKEN_FEATURES table', () => {
    it('contains exactly the 9 expected keys', () => {
        expect(Object.keys(TOKEN_FEATURES).sort()).toEqual([...EXPECTED_KEYS].sort());
    });

    it.each(EXPECTED_KEYS)('"%s" has non-empty mn label, en label, and numeric sort', (key) => {
        const entry = TOKEN_FEATURES[key];
        expect(entry).toBeDefined();
        expect(typeof entry.mn).toBe('string');
        expect(entry.mn.length).toBeGreaterThan(0);
        expect(typeof entry.en).toBe('string');
        expect(entry.en.length).toBeGreaterThan(0);
        expect(typeof entry.sort).toBe('number');
        expect(Number.isFinite(entry.sort)).toBe(true);
    });

    it('all sort orders are unique (legend renders deterministically)', () => {
        const sorts = Object.values(TOKEN_FEATURES).map((f) => f.sort);
        const unique = new Set(sorts);
        expect(unique.size).toBe(sorts.length);
    });

    it('unknown_legacy sorts last (sort >= 99) so it sinks to the bottom of the legend', () => {
        expect(TOKEN_FEATURES.unknown_legacy.sort).toBeGreaterThanOrEqual(99);
        const others = Object.entries(TOKEN_FEATURES)
            .filter(([k]) => k !== 'unknown_legacy')
            .map(([, v]) => v.sort);
        const maxOther = Math.max(...others);
        expect(TOKEN_FEATURES.unknown_legacy.sort).toBeGreaterThan(maxOther);
    });

    it('chat_reply is sort=1 (it is the user-visible default category)', () => {
        expect(TOKEN_FEATURES.chat_reply.sort).toBe(1);
    });

    it('TOKEN_FEATURE_KEYS exposes the same set as TOKEN_FEATURES', () => {
        expect(TOKEN_FEATURE_KEYS.sort()).toEqual([...EXPECTED_KEYS].sort());
    });
});

describe('tokenFeatures — getFeatureLabel', () => {
    it('returns Mongolian label by default', () => {
        expect(getFeatureLabel('chat_reply')).toBe('Чат хариулт');
        expect(getFeatureLabel('ai_memo')).toBe('Хэрэглэгчийн тэмдэглэл');
        expect(getFeatureLabel('vision')).toBe('Зураг шинжилгээ');
    });

    it('returns English label when locale="en"', () => {
        expect(getFeatureLabel('chat_reply', 'en')).toBe('Chat reply');
        expect(getFeatureLabel('vision', 'en')).toBe('Image vision');
        expect(getFeatureLabel('unknown_legacy', 'en')).toBe('Legacy uncategorized');
    });

    it('returns Mongolian when locale explicitly "mn"', () => {
        expect(getFeatureLabel('product_parse', 'mn')).toBe('Бүтээгдэхүүн импорт');
    });
});

describe('tokenFeatures — isKnownFeature type guard', () => {
    it.each(EXPECTED_KEYS)('accepts known key "%s"', (key) => {
        expect(isKnownFeature(key)).toBe(true);
    });

    it('rejects unknown strings', () => {
        expect(isKnownFeature('chatreply')).toBe(false); // no underscore
        expect(isKnownFeature('CHAT_REPLY')).toBe(false); // wrong case
        expect(isKnownFeature('')).toBe(false);
        expect(isKnownFeature('arbitrary')).toBe(false);
    });

    it('narrows the type after the guard (compile-time check)', () => {
        const k: string = 'chat_reply';
        if (isKnownFeature(k)) {
            // After narrowing, this access is type-safe
            const label: string = TOKEN_FEATURES[k].mn;
            expect(label).toBe('Чат хариулт');
        } else {
            throw new Error('type guard should have accepted "chat_reply"');
        }
    });
});
