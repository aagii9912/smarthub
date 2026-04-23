/**
 * Excel AI Import API
 * Parses .xlsx files and uses Gemini to auto-map columns to product fields
 * 
 * POST /api/shop/products/import-excel
 * Body: FormData with 'file' field (.xlsx)
 * Returns: { products: AIExtractedProduct[], mapping: object, raw_headers: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserShop } from '@/lib/auth/auth';
import { parseProductDataWithAI } from '@/lib/ai/services/ProductParser';
import { logger } from '@/lib/utils/logger';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Файл оруулна уу' }, { status: 400 });
        }

        // Validate file type
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
            return NextResponse.json(
                { error: 'Зөвхөн Excel (.xlsx, .xls) файл дэмжигдэнэ' },
                { status: 400 }
            );
        }

        // File size limit (5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'Файлын хэмжээ 5MB-аас хэтэрсэн байна' },
                { status: 400 }
            );
        }

        logger.info('Excel import started', {
            shop_id: shop.id,
            fileName: file.name,
            fileSize: file.size,
        });

        // Read file buffer
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return NextResponse.json(
                { error: 'Excel файл хоосон байна' },
                { status: 400 }
            );
        }

        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON for AI processing
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        if (!jsonData || jsonData.length < 2) {
            return NextResponse.json(
                { error: 'Excel файлд хангалттай мэдээлэл олдсонгүй (хамгийн багадаа header + 1 мөр)' },
                { status: 400 }
            );
        }

        // Extract headers (first row)
        const rawHeaders = (jsonData[0] as (string | number | undefined)[]).map(h => String(h || '').trim());

        // Convert all data to text for Gemini
        const csvLikeContent = jsonData
            .map(row => (row as (string | number | undefined)[]).map(cell => String(cell ?? '')).join('\t'))
            .join('\n');

        logger.info('Excel parsed, sending to Gemini', {
            headers: rawHeaders,
            rowCount: jsonData.length - 1,
            contentLength: csvLikeContent.length,
        });

        // Use existing AI parser
        const products = await parseProductDataWithAI(csvLikeContent, file.name);

        if (products.length === 0) {
            // Fallback: try manual extraction without AI
            const fallbackProducts = tryManualExtraction(jsonData, rawHeaders);

            if (fallbackProducts.length > 0) {
                logger.info('Excel import: AI failed, manual extraction succeeded', {
                    count: fallbackProducts.length,
                });

                return NextResponse.json({
                    products: fallbackProducts,
                    raw_headers: rawHeaders,
                    source: 'manual_fallback',
                    total_rows: jsonData.length - 1,
                });
            }

            return NextResponse.json(
                { error: 'AI бараа таних амжилтгүй. Баганы нэрсийг шалгана уу (нэр, үнэ гэсэн багана байх ёстой).' },
                { status: 422 }
            );
        }

        logger.success('Excel AI import successful', {
            shop_id: shop.id,
            productCount: products.length,
        });

        return NextResponse.json({
            products,
            raw_headers: rawHeaders,
            source: 'ai',
            total_rows: jsonData.length - 1,
        });

    } catch (error: unknown) {
        logger.error('Excel import error:', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { error: 'Excel файл уншихад алдаа гарлаа' },
            { status: 500 }
        );
    }
}

/**
 * Manual fallback extraction when AI is unavailable
 * Tries to detect name/price columns by keyword matching
 */
function tryManualExtraction(
    jsonData: unknown[][],
    headers: string[]
): Array<{ name: string; price: number; stock: number; description: string; type: 'physical' | 'service'; unit: string; colors: string[]; sizes: string[] }> {
    // Common header patterns for Mongolian & English
    const namePatterns = ['нэр', 'name', 'бараа', 'бүтээгдэхүүн', 'product', 'нэрс', 'item'];
    const pricePatterns = ['үнэ', 'price', 'төлбөр', 'дүн', 'amount', 'cost'];
    const stockPatterns = ['тоо', 'stock', 'ширхэг', 'qty', 'quantity', 'үлдэгдэл', 'нөөц'];
    const descPatterns = ['тайлбар', 'desc', 'description', 'мэдээлэл', 'тодорхойлолт'];

    let nameIdx = -1;
    let priceIdx = -1;
    let stockIdx = -1;
    let descIdx = -1;

    headers.forEach((h, idx) => {
        const lower = h.toLowerCase().replace(/[^a-zа-яөүё]/g, '');
        if (nameIdx === -1 && namePatterns.some(p => lower.includes(p))) nameIdx = idx;
        if (priceIdx === -1 && pricePatterns.some(p => lower.includes(p))) priceIdx = idx;
        if (stockIdx === -1 && stockPatterns.some(p => lower.includes(p))) stockIdx = idx;
        if (descIdx === -1 && descPatterns.some(p => lower.includes(p))) descIdx = idx;
    });

    // Must have at least name column
    if (nameIdx === -1) {
        // Try first text-like column as name, first number-like column as price
        for (let i = 0; i < headers.length; i++) {
            const sampleValue = jsonData[1]?.[i];
            if (nameIdx === -1 && typeof sampleValue === 'string' && sampleValue.length > 1) {
                nameIdx = i;
            } else if (priceIdx === -1 && typeof sampleValue === 'number') {
                priceIdx = i;
            }
        }
    }

    if (nameIdx === -1) return [];

    const products: Array<{ name: string; price: number; stock: number; description: string; type: 'physical' | 'service'; unit: string; colors: string[]; sizes: string[] }> = [];

    for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as (string | number | undefined)[];
        const name = String(row[nameIdx] ?? '').trim();
        if (!name) continue;

        const price = priceIdx >= 0 ? Number(row[priceIdx]) || 0 : 0;
        const stock = stockIdx >= 0 ? Number(row[stockIdx]) || 0 : 0;
        const description = descIdx >= 0 ? String(row[descIdx] ?? '') : '';

        products.push({
            name,
            price,
            stock,
            description,
            type: 'physical',
            unit: 'ширхэг',
            colors: [],
            sizes: [],
        });
    }

    return products;
}
