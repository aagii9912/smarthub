import { SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import type { AIProduct } from '@/types/ai';

// Keep short descriptions inline. Long descriptions remain available verbatim,
// in bounded pages, without resending the entire catalog on every chat turn.
const INLINE_DESCRIPTION_CHARS = 500;
const PREVIEW_CHARS = 160;
const DETAIL_PAGE_CHARS = 4000;

export const PRODUCT_DETAILS_TOOL: FunctionDeclaration = {
    name: 'get_product_details',
    description: 'Read a product description from this shop. Use before answering details absent from the catalog preview. Read every page before advice about ingredients, dosage, safety or contraindications. Never infer omitted facts.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            product_id: { type: SchemaType.STRING, description: 'Exact ID from the catalog preview.' },
            offset: { type: SchemaType.INTEGER, description: 'Character offset; start at 0, then use next_offset.' },
        },
        required: ['product_id'],
    },
};

export function needsProductDetails(products: AIProduct[]): boolean {
    return products.some(p => p.id && p.status !== 'draft' && p.status !== 'discontinued'
        && (p.description?.length || 0) > INLINE_DESCRIPTION_CHARS);
}

export function productDescription(product: AIProduct, onDemand: boolean, message = ''): string {
    const description = product.description || '';
    if (!onDemand || !product.id || description.length <= INLINE_DESCRIPTION_CHARS) return description;
    // A named product can be supplied immediately, avoiding a second API call.
    // Ambiguous references and very long descriptions use the bounded lookup.
    const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const name = normalize(product.name);
    if (name && description.length <= DETAIL_PAGE_CHARS
        && ` ${normalize(message)} `.includes(` ${name} `)) return description;
    return `${description.slice(0, PREVIEW_CHARS)}… [ТОВЧ ТАЙЛБАР; дэлгэрэнгүй: get_product_details(product_id="${product.id}"). Дутуу мэдээллийг бүү таамагла.]`;
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
