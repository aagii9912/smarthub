import { hashString, getCachedIntent, cacheIntent } from '@/lib/redis/cache';

export type IntentType =
    | 'PRODUCT_INQUIRY'    // Бараа асуух
    | 'PRICE_CHECK'        // Үнэ асуух
    | 'STOCK_CHECK'        // Үлдэгдэл асуух
    | 'ORDER_CREATE'       // Захиалга өгөх
    | 'ORDER_STATUS'       // Захиалга шалгах
    | 'DELIVERY_CHECK'     // Хүргэлт шалгах
    | 'PAYMENT_CHECK'      // Төлбөр шалгах
    | 'GREETING'           // Мэндчилгээ
    | 'THANK_YOU'          // Баярлалаа
    | 'COMPLAINT'          // Гомдол
    | 'HUMAN_REQUEST'      // Хүн холбох хүсэлт
    | 'GENERAL_CHAT';      // Ерөнхий яриа

export interface IntentResult {
    intent: IntentType;
    confidence: number;
    entities: {
        productName?: string;
        quantity?: number;
        color?: string;
        size?: string;
    };
    cached?: boolean;
}

// Weighted patterns: each pattern has a base confidence score
const INTENT_PATTERNS: Record<IntentType, { pattern: RegExp; weight: number }[]> = {
    GREETING: [
        { pattern: /^сайн байна уу$/i, weight: 0.98 },
        { pattern: /сайн байна уу/i, weight: 0.95 },
        { pattern: /сайн уу/i, weight: 0.95 },
        { pattern: /юу байна/i, weight: 0.80 },
        { pattern: /^hello$/i, weight: 0.95 },
        { pattern: /^hi$/i, weight: 0.90 },
    ],
    PRICE_CHECK: [
        { pattern: /үнэ/i, weight: 0.90 },
        { pattern: /хэд вэ/i, weight: 0.92 },
        { pattern: /хэдээр/i, weight: 0.88 },
        { pattern: /хэдэн төгрөг/i, weight: 0.95 },
        { pattern: /хэчнээн/i, weight: 0.82 },
        { pattern: /ямар үнэтэй/i, weight: 0.93 },
        { pattern: /price/i, weight: 0.85 },
    ],
    STOCK_CHECK: [
        { pattern: /үлдэгдэл/i, weight: 0.95 },
        { pattern: /нөөц/i, weight: 0.90 },
        { pattern: /бий юу/i, weight: 0.80 },
        { pattern: /хэдэн ширхэг/i, weight: 0.92 },
        { pattern: /байна уу/i, weight: 0.88 },
    ],
    ORDER_CREATE: [
        { pattern: /захиалах/i, weight: 0.95 },
        { pattern: /авъя/i, weight: 0.90 },
        { pattern: /авья/i, weight: 0.90 },
        { pattern: /авмаар/i, weight: 0.85 },
        { pattern: /худалдаж ав/i, weight: 0.95 },
        { pattern: /захиалга өг/i, weight: 0.95 },
        { pattern: /order/i, weight: 0.80 },
        { pattern: /авах/i, weight: 0.70 },
    ],
    ORDER_STATUS: [
        { pattern: /захиалга.*хаана/i, weight: 0.95 },
        { pattern: /захиалга.*шалгах/i, weight: 0.93 },
        { pattern: /хаана яваа/i, weight: 0.88 },
        { pattern: /хэзээ ирэх/i, weight: 0.85 },
        { pattern: /order status/i, weight: 0.92 },
    ],
    DELIVERY_CHECK: [
        { pattern: /хүргэлт.*хаана/i, weight: 0.95 },
        { pattern: /хүргэлт.*хэзээ/i, weight: 0.93 },
        { pattern: /хүргэлттэй юу/i, weight: 0.88 },
        { pattern: /хүргэлт/i, weight: 0.78 },
        { pattern: /delivery/i, weight: 0.85 },
    ],
    PAYMENT_CHECK: [
        { pattern: /төлбөр.*шалгах/i, weight: 0.95 },
        { pattern: /төлбөр.*төлсөн/i, weight: 0.93 },
        { pattern: /qpay/i, weight: 0.85 },
        { pattern: /төлсөн/i, weight: 0.80 },
        { pattern: /payment/i, weight: 0.82 },
    ],
    PRODUCT_INQUIRY: [
        { pattern: /ямар.*бараа/i, weight: 0.88 },
        { pattern: /бүтээгдэхүүн/i, weight: 0.85 },
        { pattern: /харуулаач/i, weight: 0.85 },
        { pattern: /зураг/i, weight: 0.80 },
    ],
    THANK_YOU: [
        { pattern: /баярлалаа/i, weight: 0.95 },
        { pattern: /гайгүй/i, weight: 0.75 },
        { pattern: /thanks/i, weight: 0.90 },
        { pattern: /thank you/i, weight: 0.95 },
    ],
    COMPLAINT: [
        { pattern: /гомдол/i, weight: 0.92 },
        { pattern: /асуудал/i, weight: 0.80 },
        { pattern: /буруу/i, weight: 0.75 },
        { pattern: /муу/i, weight: 0.70 },
        { pattern: /сэтгэл дундуур/i, weight: 0.90 },
    ],
    HUMAN_REQUEST: [
        { pattern: /хүн холб/i, weight: 0.95 },
        { pattern: /оператор/i, weight: 0.93 },
        { pattern: /ажилтан/i, weight: 0.88 },
        { pattern: /хүнтэй ярих/i, weight: 0.95 },
        { pattern: /human/i, weight: 0.85 },
    ],
    GENERAL_CHAT: [],
};

/**
 * Detect intent with weighted confidence scoring and Redis cache.
 * Returns the highest-confidence match.
 */
export async function detectIntentAsync(message: string): Promise<IntentResult> {
    const normalizedMessage = message.toLowerCase().trim();
    const msgHash = hashString(normalizedMessage);

    // 1. Check cache first
    const cached = await getCachedIntent(msgHash);
    if (cached) {
        return {
            intent: cached.intent as IntentType,
            confidence: cached.confidence,
            entities: extractEntities(normalizedMessage),
            cached: true,
        };
    }

    // 2. Run detection
    const result = detectIntent(normalizedMessage);

    // 3. Cache result (5 min)
    if (result.confidence >= 0.7) {
        await cacheIntent(msgHash, result.intent, result.confidence, 300);
    }

    return result;
}

/**
 * Synchronous intent detection (backward compatible).
 * Finds the highest-confidence pattern match.
 */
export function detectIntent(message: string): IntentResult {
    const normalizedMessage = typeof message === 'string' ? message.toLowerCase().trim() : '';

    let bestIntent: IntentType = 'GENERAL_CHAT';
    let bestConfidence = 0;

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        for (const { pattern, weight } of patterns) {
            if (pattern.test(normalizedMessage)) {
                // Boost confidence based on message length match
                const matchLength = normalizedMessage.match(pattern)?.[0]?.length || 0;
                const lengthRatio = normalizedMessage.length > 0 ? matchLength / normalizedMessage.length : 0;
                const adjustedConfidence = weight * (0.7 + 0.3 * lengthRatio);

                if (adjustedConfidence > bestConfidence) {
                    bestConfidence = adjustedConfidence;
                    bestIntent = intent as IntentType;
                }
            }
        }
    }

    // Fallback
    if (bestConfidence === 0) {
        bestConfidence = 0.3;
    }

    return {
        intent: bestIntent,
        confidence: Math.round(bestConfidence * 100) / 100,
        entities: extractEntities(normalizedMessage),
    };
}

function extractEntities(message: string): IntentResult['entities'] {
    const entities: IntentResult['entities'] = {};

    // Extract quantity
    const quantityMatch = message.match(/(\d+)\s*(ш|ширхэг|ширхэ|ширх|ширэг|ширэ|ширхэг)/i);
    if (quantityMatch) {
        entities.quantity = parseInt(quantityMatch[1]);
    }

    // Extract color
    const colors = ['улаан', 'хар', 'цагаан', 'хөх', 'ногоон', 'шар', 'саарал', 'ягаан', 'бор'];
    for (const color of colors) {
        if (message.includes(color)) {
            entities.color = color;
            break;
        }
    }

    // Extract size
    const sizes = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'жижиг', 'дунд', 'том'];
    for (const size of sizes) {
        if (message.toLowerCase().includes(size)) {
            entities.size = size.toUpperCase();
            break;
        }
    }

    return entities;
}
