import type Anthropic from '@anthropic-ai/sdk';
import type { AIProduct } from '@/types/ai';

// Keep short descriptions inline. Long descriptions remain available verbatim,
// in bounded pages, without resending the entire catalog on every chat turn.
const INLINE_DESCRIPTION_CHARS = 500;
const PREVIEW_CHARS = 160;
const DETAIL_PAGE_CHARS = 4000;

export const PRODUCT_DETAILS_TOOL: Anthropic.Tool = {
    name: 'get_product_details',
    description: 'Read a product description from this shop. Use before answering details absent from the catalog preview. Read every page before advice about ingredients, dosage, safety or contraindications. Never infer omitted facts.',
    input_schema: {
        type: 'object',
        properties: {
            product_id: { type: 'string', description: 'Exact ID from the catalog preview.' },
            offset: { type: 'integer', description: 'Character offset; start at 0, then use next_offset.' },
        },
        required: ['product_id'],
    },
};

export function needsProductDetails(products: AIProduct[]): boolean {
    return products.some(p => p.id && p.status !== 'draft' && p.status !== 'discontinued'
        && (p.description?.length || 0) > INLINE_DESCRIPTION_CHARS);
}

/**
 * Catalog text for one product. Must not depend on the customer's message:
 * the catalog sits in the cached prompt prefix shared by every customer of
 * the shop, so per-message text here would invalidate it on every turn.
 */
export function productDescription(product: AIProduct, onDemand: boolean): string {
    const description = product.description || '';
    if (!onDemand || !product.id || description.length <= INLINE_DESCRIPTION_CHARS) return description;
    return `${description.slice(0, PREVIEW_CHARS)}… [ТОВЧ ТАЙЛБАР; дэлгэрэнгүй: get_product_details(product_id="${product.id}"). Дутуу мэдээллийг бүү таамагла.]`;
}

const normalizeForMatch = (text: string) =>
    text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Full descriptions of products the customer named explicitly, so the reply
 * needs no second API call. Ambiguous references and very long descriptions
 * still use the bounded lookup. Goes in the per-conversation prompt tail,
 * never in the catalog (see productDescription).
 */
export function buildMentionedProductDetails(products: AIProduct[], onDemand: boolean, message: string): string {
    if (!onDemand || !message) return '';
    const text = ` ${normalizeForMatch(message)} `;
    const named = products.filter(p => {
        const description = p.description || '';
        const name = normalizeForMatch(p.name);
        return p.id && p.status !== 'draft' && p.status !== 'discontinued'
            && description.length > INLINE_DESCRIPTION_CHARS && description.length <= DETAIL_PAGE_CHARS
            && name && text.includes(` ${name} `);
    });
    if (named.length === 0) return '';
    const details = named.map(p => `- ${p.name} (product_id="${p.id}"):\n${p.description}`).join('\n');
    return `\nХЭРЭГЛЭГЧИЙН ДУРДСАН БАРААНЫ БҮТЭН ТАЙЛБАР (get_product_details дуудах шаардлагагүй):\n${details}\n`;
}

/** Read only the already-authorized shop context; never query by model-supplied ID. */
export function getProductDetails(products: AIProduct[], args: Record<string, unknown>) {
    const offset = args.offset ?? 0;
    if (typeof args.product_id !== 'string' || typeof offset !== 'number'
        || !Number.isSafeInteger(offset) || offset < 0) {
        return { error: 'product_id and a non-negative integer offset are required.' };
    }
    const product = products.find(p => p.id === args.product_id
        && p.status !== 'draft' && p.status !== 'discontinued');
    if (!product) return { error: 'Product not found in this shop.' };
    const description = product.description || '';
    if (offset > description.length) return { error: 'Offset exceeds description length.' };
    const end = offset + DETAIL_PAGE_CHARS;
    return {
        product_id: product.id,
        name: product.name,
        description: description.slice(offset, end),
        next_offset: end < description.length ? end : null,
    };
}
