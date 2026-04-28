/**
 * Token feature categories — single source of truth.
 *
 * Used by: persistTokenUsage callers, DB seed, /api/dashboard/ai-stats breakdown,
 * UI legend on /dashboard/reports, weekly email digest.
 */

export const TOKEN_FEATURES = {
    chat_reply:        { mn: 'Чат хариулт',                 en: 'Chat reply',           sort: 1 },
    ai_memo:           { mn: 'Хэрэглэгчийн тэмдэглэл',      en: 'Customer memo',        sort: 2 },
    vision:            { mn: 'Зураг шинжилгээ',             en: 'Image vision',         sort: 3 },
    system_prompt_gen: { mn: 'Систем зааварчилга үүсгэх',  en: 'System prompt gen',    sort: 4 },
    product_parse:     { mn: 'Бүтээгдэхүүн импорт',         en: 'Product import',       sort: 5 },
    lead_qualify:      { mn: 'Lead шалгалт',                en: 'Lead qualify',         sort: 6 },
    comment_auto:      { mn: 'Comment автомат хариулт',    en: 'Comment automation',   sort: 7 },
    tool_call:         { mn: 'Function call',               en: 'Tool call',            sort: 8 },
    unknown_legacy:    { mn: 'Өмнөх (задлаагүй)',           en: 'Legacy uncategorized', sort: 99 },
} as const;

export type TokenFeature = keyof typeof TOKEN_FEATURES;

export const TOKEN_FEATURE_KEYS = Object.keys(TOKEN_FEATURES) as TokenFeature[];

export function getFeatureLabel(key: TokenFeature, locale: 'mn' | 'en' = 'mn'): string {
    return TOKEN_FEATURES[key][locale];
}

export function isKnownFeature(key: string): key is TokenFeature {
    return key in TOKEN_FEATURES;
}
