import { describe, expect, it } from 'vitest';
import { buildProductsInfo, buildSystemPrompt } from '../services/PromptService';
import { getProductDetails, productDescription, needsProductDetails } from '../services/ProductContext';
import type { AIProduct } from '@/types/ai';

const product: AIProduct = {
    id: 'visible', name: 'Тест бараа', price: 50000, stock: 10, reserved_stock: 2,
    description: 'Тайлбар. '.repeat(1000) + 'Сүүлчийн чухал заавар.',
    delivery_type: 'paid', delivery_fee: 5000, colors: ['улаан'],
    ai_instructions: 'Хүүхдэд бүү санал болго.',
};

describe('on-demand product context', () => {
    it('retains price, availability, options, delivery and owner instructions', () => {
        const prompt = buildSystemPrompt({ shopId: 'shop', shopName: 'Shop', products: [product] }, true);
        for (const fact of ['50,000₮', '8 ширхэг', 'улаан', '5,000₮', product.ai_instructions!]) {
            expect(prompt).toContain(fact);
        }
        expect(prompt).toContain('get_product_details(product_id="visible")');
        expect(prompt).not.toContain(product.description);
        expect(product.description).toContain('Сүүлчийн чухал заавар.');
    });

    it('keeps complete descriptions when the lookup is unavailable', () => {
        expect(buildProductsInfo([product])).toContain(product.description);
        expect(productDescription({ ...product, id: '' }, true)).toBe(product.description);
        expect(productDescription({ ...product, description: 'Богино' }, true)).toBe('Богино');
    });

    it('prefetches an explicitly named product but never a partial name or oversized text', () => {
        const named = { ...product, description: 'Дэлгэрэнгүй. '.repeat(70) };
        expect(productDescription(named, true, 'ТЕСТ БАРАА хэд вэ?')).toBe(named.description);
        expect(productDescription(named, true, 'Тест бараанууд байна уу?')).not.toBe(named.description);
        expect(productDescription(product, true, 'Тест бараа')).not.toBe(product.description);
        expect(needsProductDetails([{ ...product, description: 'Богино' }])).toBe(false);
        expect(needsProductDetails([{ ...product, status: 'draft' }])).toBe(false);
        expect(needsProductDetails([product])).toBe(true);
    });

    it('retrieves every character in bounded pages without losing the tail', () => {
        let offset: number | null = 0;
        let text = '';
        while (offset !== null) {
            const result = getProductDetails([product], { product_id: 'visible', offset });
            expect(result).not.toHaveProperty('error');
            expect(result.description!.length).toBeLessThanOrEqual(4000);
            text += result.description;
            offset = result.next_offset!;
        }
        expect(text).toBe(product.description);
    });

    it('rejects foreign IDs, hidden products and invalid offsets', () => {
        for (const id of ['foreign', 'draft', 'discontinued']) {
            const products = [product, { ...product, id: 'draft', status: 'draft' as const },
                { ...product, id: 'discontinued', status: 'discontinued' as const }];
            expect(getProductDetails(products, { product_id: id })).toHaveProperty('error');
        }
        for (const offset of [-1, 0.5, '0', Infinity, 999999]) {
            expect(getProductDetails([product], { product_id: 'visible', offset })).toHaveProperty('error');
        }
        expect(buildProductsInfo([{ ...product, status: 'draft' }], undefined, true)).not.toContain(product.name);
    });
});
