import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { logger } from '@/lib/utils/logger';

export interface ParsedProduct {
    name: string;
    price: number;
    description?: string;
    stock?: number;
    type?: 'physical' | 'service';
    unit?: string;
    colors?: string[];
    sizes?: string[];
    sku?: string;
    image_url?: string;
}

/** Нэг өнгө×хэмжээ хослолын нөөц — product_variants мөр болж орно */
export interface ParsedVariant {
    sku?: string;
    options: { color?: string; size?: string };
    /** Эцэг бүтээгдэхүүний үнээс зөрөх үед л утгатай */
    price?: number;
    stock: number;
}

/** Бүлэглэсний дараах бүтээгдэхүүн — нэр давхардсан мөрүүд variants болж нэгдэнэ */
export interface GroupedProduct extends ParsedProduct {
    variants?: ParsedVariant[];
}

/** Импортод ороогүй мөр + шалтгаан (хэрэглэгчид харуулна) */
export interface SkippedRow {
    row: number;
    name?: string;
    reason: string;
}

export interface ParseResult {
    products: GroupedProduct[];
    skipped: SkippedRow[];
    source: 'ai' | 'rules' | 'docx';
}

/** "Хар / M" маягийн харагдах нэр */
export function variantDisplayName(v: ParsedVariant): string {
    return [v.options.color, v.options.size].filter(Boolean).join(' / ');
}

/**
 * Нэр (ба төрөл) давхардсан мөрүүдийг нэг эцэг бүтээгдэхүүн + хувилбарууд болгож бүлэглэнэ.
 * Shopify CSV-ийн "нэг мөр = нэг хувилбар" загвар: мөр бүр өөрийн өнгө/хэмжээ/тоо/SKU-тэй.
 * Нэр нь нэг л мөрөнд байгаа бол хуучин flat хэлбэрээрээ үлдэнэ — хуваарилалтын
 * мэдээлэл байхгүй тул нөөцийг зохиомлоор тараахгүй.
 */
export function groupProductVariants(rows: ParsedProduct[]): GroupedProduct[] {
    const groups = new Map<string, ParsedProduct[]>();
    for (const row of rows) {
        const key = `${row.type || 'physical'}|${row.name.trim().toLowerCase()}`;
        const group = groups.get(key);
        if (group) group.push(row);
        else groups.set(key, [row]);
    }

    const result: GroupedProduct[] = [];
    for (const group of groups.values()) {
        if (group.length === 1) {
            result.push(group[0]);
            continue;
        }

        const first = group[0];
        const variants: ParsedVariant[] = [];
        const byOptions = new Map<string, ParsedVariant>();

        for (const row of group) {
            const color = (row.colors || []).join(', ') || undefined;
            const size = (row.sizes || []).join(', ') || undefined;
            const optionsKey = `${color ?? ''}|${size ?? ''}`;

            // Яг ижил хослол давхардвал нөөцийг нь нэмнэ
            const existing = byOptions.get(optionsKey);
            if (existing) {
                existing.stock += row.stock ?? 0;
                continue;
            }

            const variant: ParsedVariant = {
                sku: row.sku,
                options: {
                    ...(color ? { color } : {}),
                    ...(size ? { size } : {}),
                },
                price: row.price !== first.price ? row.price : undefined,
                stock: row.stock ?? 0,
            };
            byOptions.set(optionsKey, variant);
            variants.push(variant);
        }

        // Өнгө/хэмжээгүй зүгээр давхардсан нэрс — хувилбар гэх утгагүй, нөөцийг нэгтгээд flat үлдээнэ
        const hasOptions = variants.some(v => v.options.color || v.options.size);
        if (!hasOptions) {
            result.push({
                ...first,
                stock: group.reduce((sum, r) => sum + (r.stock ?? 0), 0),
                description: group.map(r => r.description).find(Boolean),
                image_url: group.map(r => r.image_url).find(Boolean),
            });
            continue;
        }

        // UNIQUE(product_id, sku) зөрчихгүйн тулд давхардсан SKU-г хоослоно
        const seenSkus = new Set<string>();
        for (const v of variants) {
            if (!v.sku) continue;
            if (seenSkus.has(v.sku)) v.sku = undefined;
            else seenSkus.add(v.sku);
        }

        const uniq = (values: string[]) => [...new Set(values)];
        result.push({
            ...first,
            description: group.map(r => r.description).find(Boolean),
            image_url: group.map(r => r.image_url).find(Boolean),
            stock: variants.reduce((sum, v) => sum + v.stock, 0),
            colors: uniq(group.flatMap(r => r.colors || [])),
            sizes: uniq(group.flatMap(r => r.sizes || [])),
            sku: undefined,
            variants,
        });
    }
    return result;
}

function splitList(raw: unknown): string[] {
    return raw
        ? String(raw).split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : [];
}

function normalizeType(raw: unknown): 'physical' | 'service' {
    const value = String(raw || '').toLowerCase().trim();
    return value === 'service' || value.includes('үйлчилгээ') ? 'service' : 'physical';
}

/**
 * Parse Excel file (xlsx, xls, csv) — дүрэмд суурилсан баганын нэр таних
 */
export async function parseExcel(buffer: Buffer): Promise<ParseResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    const products: ParsedProduct[] = [];
    const skipped: SkippedRow[] = [];

    data.forEach((row, index) => {
        // Excel дээрх бодит мөрийн дугаар (header = 1-р мөр)
        const rowNumber = index + 2;

        const name = row['Нэр'] || row['name'] || row['Name'] || row['Бүтээгдэхүүн'] || row['Product'] || '';
        const price = parseFloat(row['Үнэ'] || row['price'] || row['Price'] || row['Үнэ (₮)'] || 0);
        const description = row['Тайлбар'] || row['description'] || row['Description'] || row['Дэлгэрэнгүй'] || '';
        const stock = parseInt(row['Тоо'] || row['stock'] || row['Stock'] || row['Үлдэгдэл'] || row['Qty'] || 0);
        const type = normalizeType(row['Төрөл'] || row['type'] || row['Type']);
        const unit = String(row['Нэгж'] || row['unit'] || row['Unit'] || '').trim();
        const sku = String(row['SKU'] || row['sku'] || row['Sku'] || row['Код'] || row['Баркод'] || row['Barcode'] || '').trim();
        const imageUrl = String(row['Зургийн URL'] || row['Зураг'] || row['image_url'] || row['Image'] || '').trim();

        const colors = splitList(row['Өнгө'] || row['colors'] || row['Colors'] || row['Color']);
        const sizes = splitList(row['Хэмжээ'] || row['sizes'] || row['Sizes'] || row['Size'] || row['Размер']);

        if (!name) {
            // Бүх нүд нь хоосон мөрийг чимээгүй алгасна, хагас бөглөсөн мөрийг мэдэгдэнэ
            const hasAnyValue = Object.values(row).some(v => String(v ?? '').trim());
            if (hasAnyValue) {
                skipped.push({ row: rowNumber, reason: 'Нэр хоосон байна' });
            }
            return;
        }
        if (!price || price <= 0) {
            skipped.push({ row: rowNumber, name: String(name).trim(), reason: 'Үнэ хоосон эсвэл буруу байна' });
            return;
        }

        products.push({
            name: String(name).trim(),
            price,
            description: String(description).trim() || undefined,
            stock: isNaN(stock) ? 0 : stock,
            type,
            unit: unit || undefined,
            colors: colors.length > 0 ? colors : undefined,
            sizes: sizes.length > 0 ? sizes : undefined,
            sku: sku || undefined,
            image_url: imageUrl.startsWith('http') ? imageUrl : undefined,
        });
    });

    return { products, skipped, source: 'rules' };
}

/**
 * Parse DOCX file
 * Expected format:
 * - Each product on a new line
 * - Format: "Нэр - Үнэ₮ - Тайлбар"
 * - Or table format
 */
export async function parseDocx(buffer: Buffer): Promise<ParseResult> {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    const products: ParsedProduct[] = [];
    const skipped: SkippedRow[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    lines.forEach((line, index) => {
        // Try to parse "Name - Price - Description" format
        const parts = line.split(/[-–—]/).map(p => p.trim());

        if (parts.length >= 2) {
            const name = parts[0];
            // Extract price from second part (remove ₮, etc)
            const priceMatch = parts[1].match(/[\d,]+/);
            const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, '')) : 0;
            const description = parts.slice(2).join(' - ').trim() || undefined;

            if (name && price > 0) {
                products.push({
                    name,
                    price,
                    description,
                    stock: 0,
                    type: 'physical',
                });
            } else {
                skipped.push({ row: index + 1, name: name || undefined, reason: 'Үнэ танигдсангүй ("Нэр - Үнэ - Тайлбар" формат)' });
            }
        }
    });

    return { products, skipped, source: 'docx' };
}

/**
 * Get file content as text for AI processing
 */
async function getFileContent(buffer: Buffer, extension: string): Promise<string> {
    if (['xlsx', 'xls', 'csv'].includes(extension)) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        // Use CSV format for better token efficiency with LLMs
        return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    } else if (extension === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }
    throw new Error(`Unsupported file format: ${extension}`);
}

/**
 * Parse file using AI to extract products and services.
 * Falls back to rule-based parsing when AI fails or returns nothing.
 */
export async function parseProductFile(buffer: Buffer, fileName: string, shopId?: string): Promise<ParseResult> {
    const extension = fileName.toLowerCase().split('.').pop() || '';

    try {
        // 1. Get text content
        const content = await getFileContent(buffer, extension);

        // 2. Process with AI
        // We import dynamically to avoid circular dependencies if any
        const { parseProductDataWithAI } = await import('@/lib/ai/services/ProductParser');
        const products = await parseProductDataWithAI(content, fileName, shopId);

        if (products.length === 0) {
            throw new Error('AI returned no products');
        }

        // 3. Map to ParsedProduct interface, нэр давхардсан мөрүүдийг хувилбар болгоно
        return {
            products: groupProductVariants(products.map(p => ({
                name: p.name,
                price: p.price,
                description: p.description,
                stock: p.stock,
                type: p.type,
                unit: p.unit,
                colors: p.colors,
                sizes: p.sizes,
                sku: p.sku,
            }))),
            skipped: [],
            source: 'ai',
        };
    } catch (error: unknown) {
        logger.error('AI Parsing failed, falling back to rule-based:', { error });
        // Fallback to old methods if AI fails
        if (['xlsx', 'xls', 'csv'].includes(extension)) {
            const result = await parseExcel(buffer);
            return { ...result, products: groupProductVariants(result.products) };
        } else if (extension === 'docx') {
            const result = await parseDocx(buffer);
            return { ...result, products: groupProductVariants(result.products) };
        }
        throw error;
    }
}
