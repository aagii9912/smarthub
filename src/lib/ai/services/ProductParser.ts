/**
 * AI-powered product data parser using Claude
 * Extracts structured product data from file content (xlsx, docx, csv)
 */

import { logger } from '@/lib/utils/logger';
import { persistTokenUsage } from '../tokenUsage';
import { isAnthropicConfigured, resolveBackendModel, simpleCompletion } from '../anthropicClient';

const PARSE_MODEL = resolveBackendModel();
/** Large catalogs produce long JSON; keep room so the array isn't truncated. */
const PARSE_MAX_OUTPUT_TOKENS = 16384;

export interface AIExtractedProduct {
    name: string;
    price: number;
    stock: number;
    description: string;
    type: 'physical' | 'service';
    unit: string;
    colors: string[];
    sizes: string[];
    sku?: string;
}

/**
 * Parse product data from file content using Claude.
 *
 * `shopId` is optional for backward compatibility; when present, vision/parse
 * tokens get billed against the shop's per-feature usage breakdown.
 */
export async function parseProductDataWithAI(
    fileContent: string,
    fileName: string,
    shopId?: string
): Promise<AIExtractedProduct[]> {
    try {
        if (!isAnthropicConfigured()) {
            logger.error('ANTHROPIC_API_KEY not configured for product parsing');
            return [];
        }

        logger.info('Parsing product data with Claude...', { fileName, contentLength: fileContent.length });

        const prompt = `You are a data extraction assistant. Extract products and services from the provided file content.
Filename: "${fileName}"

RULES:
1. Extract ALL items found.
2. Determine 'type': 'physical' for physical goods (phones, clothes), 'service' for services (repair, editing, consulting).
3. Determine 'unit': e.g., 'ширхэг' for goods, 'захиалга', 'цаг', 'хүн' for services.
4. Extract 'stock': For services, this is the Number of Available Slots/Orders. If not specified, default to 0.
5. Extract 'colors' and 'sizes' as arrays. Column names may be Mongolian: 'Өнгө' = colors, 'Хэмжээ'/'Размер' = sizes (e.g. S/M/L or 38/39/40). Values are usually comma-separated — split them. Careful: 'Тоо' / 'Тоо хэмжээ' / 'Үлдэгдэл' means stock quantity, NOT sizes.
6. IMPORTANT: Output one item PER INPUT ROW. Do NOT merge rows that share the same product name — repeated names are color/size variants, each with its own stock. Preserve each row's own color, size, stock, price and sku.
7. Extract 'sku' if a SKU/Код/Barcode column exists, else omit it.
8. If physical dimensions/specs are present (урт, өргөн, өндөр, жин, багтаамж, cm, kg etc.), append them to 'description' so the info is not lost.
9. Return a JSON object with a "products" array.

Input Content:
${fileContent.slice(0, 15000)}

Response Format (JSON only):
{
  "products": [
    {
      "name": "Product Name",
      "price": 0,
      "stock": 0,
      "description": "Description",
      "type": "physical",
      "unit": "ширхэг",
      "colors": ["red", "blue"],
      "sizes": ["S", "M"],
      "sku": "TS-RED-S"
    }
  ]
}`;

        const { text: content, tokensUsed } = await simpleCompletion({
            prompt,
            model: PARSE_MODEL,
            json: true,
            maxTokens: PARSE_MAX_OUTPUT_TOKENS,
        });

        if (shopId && tokensUsed > 0) {
            persistTokenUsage(shopId, tokensUsed, 'product_parse', { model: PARSE_MODEL }).catch(() => {});
        }

        const parsed = JSON.parse(content);

        if (!Array.isArray(parsed.products)) {
            logger.warn('Claude returned invalid format', { parsed });
            return [];
        }

        interface ParsedProduct {
            name?: string;
            price?: number | string;
            stock?: number | string;
            description?: string;
            type?: 'service' | 'physical';
            unit?: string;
            colors?: string[];
            sizes?: string[];
            sku?: string;
        }

        return (parsed.products as ParsedProduct[]).map((p) => ({
            name: p.name || 'Unnamed',
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
            description: p.description || '',
            type: p.type === 'service' ? 'service' : 'physical',
            unit: p.unit || (p.type === 'service' ? 'захиалга' : 'ширхэг'),
            colors: Array.isArray(p.colors) ? p.colors : [],
            sizes: Array.isArray(p.sizes) ? p.sizes : [],
            sku: p.sku ? String(p.sku).trim() : undefined,
        }));

    } catch (error: unknown) {
        logger.error('Claude Parse Error:', { message: error instanceof Error ? error.message : String(error) });
        return [];
    }
}
