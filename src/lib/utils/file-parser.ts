import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { logger } from '@/lib/utils/logger';

export interface ParsedProduct {
    name: string;
    price: number;
    description?: string;
    stock?: number;
    type?: 'physical' | 'service';
    colors?: string[];
    sizes?: string[];
}

/**
 * Parse Excel file (xlsx, xls, csv)
 */
export async function parseExcel(buffer: Buffer): Promise<ParsedProduct[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

    // Try to detect column names
    const products: ParsedProduct[] = [];

    for (const row of data) {
        // Try different column name variations
        const name = row['Нэр'] || row['name'] || row['Name'] || row['Бүтээгдэхүүн'] || row['Product'] || '';
        const price = parseFloat(row['Үнэ'] || row['price'] || row['Price'] || row['Үнэ (₮)'] || 0);
        const description = row['Тайлбар'] || row['description'] || row['Description'] || row['Дэлгэрэнгүй'] || '';
        const stock = parseInt(row['Тоо'] || row['stock'] || row['Stock'] || row['Үлдэгдэл'] || row['Qty'] || 0);
        const type = row['Төрөл'] || row['type'] || row['Type'] || 'physical';

        // Parse colors and sizes if they exist
        const colorsRaw = row['Өнгө'] || row['colors'] || row['Colors'] || '';
        const sizesRaw = row['Хэмжээ'] || row['sizes'] || row['Sizes'] || '';

        const colors = colorsRaw ? String(colorsRaw).split(',').map((c: string) => c.trim()).filter(Boolean) : [];
        const sizes = sizesRaw ? String(sizesRaw).split(',').map((s: string) => s.trim()).filter(Boolean) : [];

        if (name && price > 0) {
            products.push({
                name: String(name).trim(),
                price,
                description: String(description).trim() || undefined,
                stock: isNaN(stock) ? 0 : stock,
                type: type === 'service' ? 'service' : 'physical',
                colors: colors.length > 0 ? colors : undefined,
                sizes: sizes.length > 0 ? sizes : undefined,
            });
        }
    }

    return products;
}

/**
 * Parse DOCX file
 * Expected format: 
 * - Each product on a new line
 * - Format: "Нэр - Үнэ₮ - Тайлбар"
 * - Or table format
 */
export async function parseDocx(buffer: Buffer): Promise<ParsedProduct[]> {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;

    const products: ParsedProduct[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines) {
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
            }
        }
    }

    return products;
}

/**
 * Detect file type and parse accordingly
 */
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
 * Parse file using AI (GPT) to extract products and services
 */
export async function parseProductFile(buffer: Buffer, fileName: string): Promise<ParsedProduct[]> {
    const extension = fileName.toLowerCase().split('.').pop() || '';

    try {
        // 1. Get text content
        const content = await getFileContent(buffer, extension);

        // 2. Process with AI
        // We import dynamically to avoid circular dependencies if any
        const { parseProductDataWithAI } = await import('@/lib/ai/openai');
        const products = await parseProductDataWithAI(content, fileName);

        // 3. Map to ParsedProduct interface
        return products.map(p => ({
            name: p.name,
            price: p.price,
            description: p.description,
            stock: p.stock,
            type: p.type,
            colors: p.colors,
            sizes: p.sizes
        }));
    } catch (error) {
        logger.error('AI Parsing failed, falling back to rule-based:', { error });
        // Fallback to old methods if AI fails
        if (['xlsx', 'xls', 'csv'].includes(extension)) {
            return parseExcel(buffer);
        } else if (extension === 'docx') {
            return parseDocx(buffer);
        }
        throw error;
    }
}
