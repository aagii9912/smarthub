import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcel, groupProductVariants, variantDisplayName } from '../file-parser';

function buildXlsx(rows: (string | number)[][]): Buffer {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseExcel', () => {
    it('extracts colors, sizes, unit, type and image from Mongolian template columns', async () => {
        const buffer = buildXlsx([
            ['Нэр', 'Төрөл', 'Үнэ', 'Тоо', 'Нэгж', 'Өнгө', 'Хэмжээ', 'Тайлбар', 'Зургийн URL'],
            ['Хөвөн цамц', 'бараа', 45000, 20, 'ширхэг', 'Хар, Цагаан', 'S, M, L', 'Зөөлөн цамц', 'https://example.com/a.jpg'],
            ['Гэрэл зураг', 'үйлчилгээ', 250000, 10, 'захиалга', '', '', '1 цагийн зураг авалт', ''],
        ]);

        const { products, skipped } = await parseExcel(buffer);

        expect(skipped).toHaveLength(0);
        expect(products).toHaveLength(2);

        expect(products[0]).toMatchObject({
            name: 'Хөвөн цамц',
            price: 45000,
            stock: 20,
            unit: 'ширхэг',
            type: 'physical',
            colors: ['Хар', 'Цагаан'],
            sizes: ['S', 'M', 'L'],
            image_url: 'https://example.com/a.jpg',
        });

        expect(products[1]).toMatchObject({
            name: 'Гэрэл зураг',
            type: 'service',
            unit: 'захиалга',
        });
        expect(products[1].colors).toBeUndefined();
    });

    it('supports English column names', async () => {
        const buffer = buildXlsx([
            ['Name', 'Price', 'Stock', 'Colors', 'Sizes'],
            ['Shoes', 99000, 5, 'Black; White', '40, 41'],
        ]);

        const { products } = await parseExcel(buffer);

        expect(products).toHaveLength(1);
        expect(products[0].colors).toEqual(['Black', 'White']);
        expect(products[0].sizes).toEqual(['40', '41']);
    });

    it('reports skipped rows with row numbers and reasons', async () => {
        const buffer = buildXlsx([
            ['Нэр', 'Үнэ'],
            ['Зөв бараа', 10000],
            ['Үнэгүй бараа', 0],
            ['', 5000],
        ]);

        const { products, skipped } = await parseExcel(buffer);

        expect(products).toHaveLength(1);
        expect(skipped).toHaveLength(2);
        // Excel дээрх бодит мөрийн дугаар (header = 1-р мөр)
        expect(skipped[0]).toMatchObject({ row: 3, name: 'Үнэгүй бараа', reason: 'Үнэ хоосон эсвэл буруу байна' });
        expect(skipped[1]).toMatchObject({ row: 4, reason: 'Нэр хоосон байна' });
    });
});

describe('groupProductVariants', () => {
    it('groups repeated names into one product with per-combination variants', () => {
        const grouped = groupProductVariants([
            { name: 'Цамц', price: 45000, stock: 5, colors: ['Хар'], sizes: ['S'], sku: 'TS-BLK-S' },
            { name: 'Цамц', price: 45000, stock: 12, colors: ['Хар'], sizes: ['M'], sku: 'TS-BLK-M' },
            { name: 'Цамц', price: 47000, stock: 8, colors: ['Цагаан'], sizes: ['L'] },
            { name: 'Малгай', price: 15000, stock: 7 },
        ]);

        expect(grouped).toHaveLength(2);

        const shirt = grouped[0];
        expect(shirt.variants).toHaveLength(3);
        // Нийт нөөц = хувилбаруудын нийлбэр
        expect(shirt.stock).toBe(25);
        // Эцэг дээр нэгтгэсэн өнгө/хэмжээний жагсаалт
        expect(shirt.colors).toEqual(['Хар', 'Цагаан']);
        expect(shirt.sizes).toEqual(['S', 'M', 'L']);
        // Эцгийн үнээс зөрсөн хувилбар л price override-тай
        expect(shirt.variants![0]).toMatchObject({ sku: 'TS-BLK-S', options: { color: 'Хар', size: 'S' }, stock: 5, price: undefined });
        expect(shirt.variants![2]).toMatchObject({ options: { color: 'Цагаан', size: 'L' }, stock: 8, price: 47000 });
        expect(variantDisplayName(shirt.variants![1])).toBe('Хар / M');

        // Нэг мөртэй бараа flat хэвээрээ
        expect(grouped[1].variants).toBeUndefined();
    });

    it('merges duplicate combinations by summing stock and drops duplicate SKUs', () => {
        const grouped = groupProductVariants([
            { name: 'Пүүз', price: 99000, stock: 3, colors: ['Хар'], sizes: ['40'], sku: 'SH-40' },
            { name: 'Пүүз', price: 99000, stock: 2, colors: ['Хар'], sizes: ['40'], sku: 'SH-40' },
            { name: 'Пүүз', price: 99000, stock: 4, colors: ['Хар'], sizes: ['41'], sku: 'SH-40' },
        ]);

        expect(grouped).toHaveLength(1);
        expect(grouped[0].variants).toHaveLength(2);
        expect(grouped[0].variants![0].stock).toBe(5);
        // Давхардсан SKU UNIQUE(product_id, sku)-г зөрчихгүйн тулд хоослогдоно
        expect(grouped[0].variants![1].sku).toBeUndefined();
    });

    it('merges name-only duplicates into a flat product without variants', () => {
        const grouped = groupProductVariants([
            { name: 'Аяга', price: 12000, stock: 10 },
            { name: 'Аяга', price: 12000, stock: 5 },
        ]);

        expect(grouped).toHaveLength(1);
        expect(grouped[0].variants).toBeUndefined();
        expect(grouped[0].stock).toBe(15);
    });
});
