import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcel } from '../file-parser';

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
