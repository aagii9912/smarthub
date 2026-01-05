export type IntentType =
    | 'PRODUCT_INQUIRY'    // Бараа асуух
    | 'PRICE_CHECK'        // Үнэ асуух
    | 'STOCK_CHECK'        // Үлдэгдэл асуух
    | 'ORDER_CREATE'       // Захиалга өгөх
    | 'ORDER_STATUS'       // Захиалга шалгах
    | 'GREETING'           // Мэндчилгээ
    | 'THANK_YOU'          // Баярлалаа
    | 'COMPLAINT'          // Гомдол
    | 'GENERAL_CHAT';      // Ерөнхий яриа

interface IntentResult {
    intent: IntentType;
    confidence: number;
    entities: {
        productName?: string;
        quantity?: number;
        color?: string;
        size?: string;
    };
}

const INTENT_PATTERNS: Record<IntentType, RegExp[]> = {
    GREETING: [
        /сайн байна уу/i,
        /сайн уу/i,
        /юу байна/i,
        /hello/i,
        /hi/i,
    ],
    PRICE_CHECK: [
        /үнэ/i,
        /хэд вэ/i,
        /хэдэн төгрөг/i,
        /хэчнээн/i,
        /ямар үнэтэй/i,
    ],
    STOCK_CHECK: [
        /байна уу/i,
        /үлдэгдэл/i,
        /нөөц/i,
        /бий юу/i,
        /хэдэн ширхэг/i,
    ],
    ORDER_CREATE: [
        /захиалах/i,
        /авах/i,
        /авья/i,
        /авмаар/i,
        /худалдаж ав/i,
        /захиалга/i,
        /order/i,
    ],
    ORDER_STATUS: [
        /захиалга хаана/i,
        /хүргэлт/i,
        /хаана яваа/i,
        /хэзээ ирэх/i,
    ],
    PRODUCT_INQUIRY: [
        /ямар.*байна/i,
        /юу.*байна/i,
        /бараа/i,
        /бүтээгдэхүүн/i,
        /харуулаач/i,
    ],
    THANK_YOU: [
        /баярлалаа/i,
        /гайгүй/i,
        /thanks/i,
        /thank you/i,
    ],
    COMPLAINT: [
        /гомдол/i,
        /асуудал/i,
        /буруу/i,
        /муу/i,
        /сэтгэл дундуур/i,
    ],
    GENERAL_CHAT: [],
};

export function detectIntent(message: string): IntentResult {
    const normalizedMessage = message.toLowerCase().trim();

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(normalizedMessage)) {
                return {
                    intent: intent as IntentType,
                    confidence: 0.85,
                    entities: extractEntities(normalizedMessage),
                };
            }
        }
    }

    return {
        intent: 'GENERAL_CHAT',
        confidence: 0.5,
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
