/**
 * Excel AI Import API
 * Parses .xlsx files and uses Gemini to auto-map columns to product fields
 * 
 * POST /api/shop/products/import-excel
 * Body: FormData with 'file' field (.xlsx)
 * Returns: { products: AIExtractedProduct[], mapping: object, raw_headers: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getAuthUserShop } from '@/lib/auth/auth';
import { parseProductDataWithAI } from '@/lib/ai/services/ProductParser';
import { logProductImport } from '@/lib/services/importAudit';
import { logger } from '@/lib/utils/logger';
import * as XLSX from 'xlsx';

// ProductParser нь AI prompt-д эхний 15,000 тэмдэгтийг л дамжуулдаг
const AI_CONTENT_LIMIT = 15000;

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

        // Том файлын агуулга AI-д тасарч очдог тул хэрэглэгчид анхааруулна
        const truncated = csvLikeContent.length > AI_CONTENT_LIMIT;
        const warning = truncated
            ? 'Файл том тул зөвхөн эхний хэсэг нь боловсруулагдлаа. Бүх мөрийг оруулахын тулд файлаа хувааж импортлоно уу.'
            : undefined;

        // Use existing AI parser
        const products = await parseProductDataWithAI(csvLikeContent, file.name, shop.id);
        const userId = await getAuthUser();

        if (products.length === 0) {
            // Fallback: try manual extraction without AI
            const fallbackProducts = tryManualExtraction(jsonData, rawHeaders);

            if (fallbackProducts.length > 0) {
                logger.info('Excel import: AI failed, manual extraction succeeded', {
                    count: fallbackProducts.length,
                });

                await logProductImport({
                    shop_id: shop.id,
                    user_id: userId,
                    file_name: file.name,
                    file_size: file.size,
                    action: 'parse',
                    source: 'manual_fallback',
                    total_rows: jsonData.length - 1,
                    imported_count: fallbackProducts.length,
                    skipped_count: (jsonData.length - 1) - fallbackProducts.length,
                    status: 'success',
                });

                return NextResponse.json({
                    products: fallbackProducts,
                    raw_headers: rawHeaders,
                    source: 'manual_fallback',
                    total_rows: jsonData.length - 1,
                    warning,
                });
            }

            await logProductImport({
                shop_id: shop.id,
                user_id: userId,
                file_name: file.name,
                file_size: file.size,
                action: 'parse',
                source: 'ai',
                total_rows: jsonData.length - 1,
                imported_count: 0,
                skipped_count: jsonData.length - 1,
                status: 'failed',
                error_message: 'AI болон гар таних хоёулаа амжилтгүй',
            });

            return NextResponse.json(
                { error: 'AI бараа таних амжилтгүй. Загвар файл татаж аваад баганы нэрсийг тааруулна уу ("Нэр", "Үнэ" багана заавал хэрэгтэй).' },
                { status: 422 }
            );
        }

        logger.success('Excel AI import successful', {
            shop_id: shop.id,
            productCount: products.length,
        });

        await logProductImport({
            shop_id: shop.id,
            user_id: userId,
            file_name: file.name,
            file_size: file.size,
            action: 'parse',
            source: 'ai',
            total_rows: jsonData.length - 1,
            imported_count: products.length,
            skipped_count: Math.max(0, (jsonData.length - 1) - products.length),
            status: 'success',
        });

        return NextResponse.json({
            products,
            raw_headers: rawHeaders,
            source: 'ai',
            total_rows: jsonData.length - 1,
            warning,
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
    const colorPatterns = ['өнгө', 'color', 'colour'];
    const sizePatterns = ['хэмжээ', 'size', 'размер'];
    const unitPatterns = ['нэгж', 'unit'];
    const typePatterns = ['төрөл', 'type', 'ангилал'];

    let nameIdx = -1;
    let priceIdx = -1;
    let stockIdx = -1;
    let descIdx = -1;
    let colorIdx = -1;
    let sizeIdx = -1;
    let unitIdx = -1;
    let typeIdx = -1;

    headers.forEach((h, idx) => {
        const lower = h.toLowerCase().replace(/[^a-zа-яөүё]/g, '');
        if (nameIdx === -1 && namePatterns.some(p => lower.includes(p))) nameIdx = idx;
        if (priceIdx === -1 && pricePatterns.some(p => lower.includes(p))) priceIdx = idx;
        // "Хэмжээ" нь stock pattern "тоо хэмжээ"-тэй давхцахаас сэргийлж size-ийг эхэлж шалгана
        if (sizeIdx === -1 && sizePatterns.some(p => lower.includes(p))) sizeIdx = idx;
        if (stockIdx === -1 && sizeIdx !== idx && stockPatterns.some(p => lower.includes(p))) stockIdx = idx;
        if (descIdx === -1 && descPatterns.some(p => lower.includes(p))) descIdx = idx;
        if (colorIdx === -1 && colorPatterns.some(p => lower.includes(p))) colorIdx = idx;
        if (unitIdx === -1 && unitPatterns.some(p => lower.includes(p))) unitIdx = idx;
        if (typeIdx === -1 && typePatterns.some(p => lower.includes(p))) typeIdx = idx;
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
        const colors = colorIdx >= 0
            ? String(row[colorIdx] ?? '').split(/[,;]/).map(c => c.trim()).filter(Boolean)
            : [];
        const sizes = sizeIdx >= 0
            ? String(row[sizeIdx] ?? '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : [];
        const typeRaw = typeIdx >= 0 ? String(row[typeIdx] ?? '').toLowerCase() : '';
        const type: 'physical' | 'service' =
            typeRaw === 'service' || typeRaw.includes('үйлчилгээ') ? 'service' : 'physical';
        const unit = unitIdx >= 0 && String(row[unitIdx] ?? '').trim()
            ? String(row[unitIdx]).trim()
            : (type === 'service' ? 'захиалга' : 'ширхэг');

        products.push({
            name,
            price,
            stock,
            description,
            type,
            unit,
            colors,
            sizes,
        });
    }

    return products;
}
