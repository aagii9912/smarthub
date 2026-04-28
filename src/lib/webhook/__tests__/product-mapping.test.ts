import { describe, it, expect } from 'vitest';
import { mapShopProductsToAI } from '@/lib/webhook/services/shop.service';
import { buildProductsInfo } from '@/lib/ai/services/PromptService';

describe('Lite plan регрессив тест: нэр давхардсан бараа+үйлчилгээ', () => {
    const dbProducts = [
        {
            id: 'p1',
            name: 'Lite plan',
            description: 'Lite ₮89,000/cap 20 бараа 5,000 credit/cap',
            price: 100,
            stock: 10000000,
            reserved_stock: 0,
            type: 'physical',
            unit: 'ширхэг',
            colors: [],
            sizes: [],
            images: [],
            image_url: null,
            discount_percent: null,
            delivery_type: 'included',
            delivery_fee: 0,
            is_active: true,
        },
        {
            id: 'p2',
            name: 'Lite plan',
            description: 'Lite ₮89,000/cap 20 бараа 5,000 credit/cap',
            price: 100,
            stock: null,
            reserved_stock: 0,
            type: 'service',
            unit: 'захиалга',
            colors: [],
            sizes: [],
            images: [],
            image_url: null,
            discount_percent: null,
            delivery_type: 'pickup_only',
            delivery_fee: null,
            is_active: true,
        },
    ];

    it('mapShopProductsToAI нь type талбарыг хадгална', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        expect(mapped).toHaveLength(2);
        expect(mapped[0].type).toBe('product');
        expect(mapped[1].type).toBe('service');
    });

    it('mapShopProductsToAI нь reserved_stock болон unit-ийг дамжуулна', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        expect(mapped[0].reserved_stock).toBe(0);
        expect(mapped[0].unit).toBe('ширхэг');
        expect(mapped[1].unit).toBe('захиалга');
    });

    it('Үйлчилгээ дэх stock=null нь stock=0-д хөрвөнө (хэвийн)', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        expect(mapped[1].stock).toBe(0);
    });

    it('Prompt-д үйлчилгээ нь [ҮЙЛЧИЛГЭЭ] тэмдэглэгээтэй гарна (бараа гэж тооцогдохгүй)', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        const prompt = buildProductsInfo(mapped);

        expect(prompt).toContain('[БАРАА] Lite plan');
        expect(prompt).toContain('[ҮЙЛЧИЛГЭЭ] Lite plan');

        const baraaCount = (prompt.match(/\[БАРАА\]/g) || []).length;
        const serviceCount = (prompt.match(/\[ҮЙЛЧИЛГЭЭ\]/g) || []).length;
        expect(baraaCount).toBe(1);
        expect(serviceCount).toBe(1);
    });

    it('Бараа prompt-д "Дууссан" гэж тэмдэглэгдэхгүй (10M нөөцтэй)', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        const prompt = buildProductsInfo(mapped);

        const baraaLine = prompt.split('\n').find(l => l.includes('[БАРАА]'))!;
        expect(baraaLine).toBeDefined();
        expect(baraaLine).not.toContain('Дууссан');
        expect(baraaLine).toMatch(/10000000|10,000,000/);
    });

    it('Үйлчилгээ prompt-д stock=0 байсан ч "Дууссан" гэж огт гарахгүй (#service-unlimited)', () => {
        const mapped = mapShopProductsToAI(dbProducts);
        const prompt = buildProductsInfo(mapped);

        const serviceLine = prompt.split('\n').find(l => l.includes('[ҮЙЛЧИЛГЭЭ]'))!;
        expect(serviceLine).toBeDefined();
        // Booking cap-гүй үйлчилгээг "Захиалга авах боломжтой" гэж танилцуулна,
        // "Дууссан"/"Захиалга дүүрсэн" гэж буруу хэлэхгүй (stock=0 шууд "хүрэлцэхгүй"
        // утгатай биш — зүгээр л booking limit байхгүй гэсэн утгатай).
        expect(serviceLine).toContain('Захиалга авах боломжтой');
        expect(serviceLine).not.toContain('Дууссан');
        expect(serviceLine).not.toContain('Захиалга дүүрсэн');
    });

    it('REGRESSION ЭСРЭГ ТЕСТ: type-гүй буруу mapping prompt-д хоёр [БАРАА] өгдөг (хуучин алдаа)', () => {
        const wrongMapping = dbProducts.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock ?? 0,
        }));
        const wrongPrompt = buildProductsInfo(wrongMapping);

        const baraaCount = (wrongPrompt.match(/\[БАРАА\]/g) || []).length;
        expect(baraaCount).toBe(2);
        expect(wrongPrompt).toContain('Дууссан');
    });

    it('Зөвхөн appointment type appointment гэж шилжинэ', () => {
        const mapped = mapShopProductsToAI([
            { ...dbProducts[0], type: 'appointment' },
        ]);
        expect(mapped[0].type).toBe('appointment');
    });

    it('Тодорхойгүй type-ыг product гэж тооцно', () => {
        const mapped = mapShopProductsToAI([
            { ...dbProducts[0], type: null },
            { ...dbProducts[0], id: 'x', type: 'product' },
            { ...dbProducts[0], id: 'y', type: 'unknown' },
        ]);
        expect(mapped.every(m => m.type === 'product')).toBe(true);
    });

    it('mapShopProductsToAI нь null/undefined input-ийг тэг массив болгоно', () => {
        expect(mapShopProductsToAI(null)).toEqual([]);
        expect(mapShopProductsToAI(undefined)).toEqual([]);
        expect(mapShopProductsToAI([])).toEqual([]);
    });
});
