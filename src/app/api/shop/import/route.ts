import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getAuthUserShop, supabaseAdmin } from '@/lib/auth/auth';
import { parseProductFile, GroupedProduct, SkippedRow, variantDisplayName } from '@/lib/utils/file-parser';
import { logProductImport } from '@/lib/services/importAudit';
import { logger } from '@/lib/utils/logger';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv', 'docx'];

/**
 * True when a Supabase/PostgREST error is "column not found" — either the
 * column genuinely doesn't exist yet (staged migration) or PostgREST's schema
 * cache is stale (PGRST204). Lets the import retry without the optional column.
 */
function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
    if (!error) return false;
    if (error.code === 'PGRST204') return true;
    const msg = error.message || '';
    return /column .+ does not exist/i.test(msg) || /could not find the .+ column/i.test(msg);
}

// GET - Сүүлийн импортын түүх (audit)
export async function GET() {
    try {
        const shop = await getAuthUserShop();
        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: logs, error } = await supabaseAdmin()
            .from('product_import_logs')
            .select('id, file_name, action, source, total_rows, imported_count, skipped_count, status, error_message, created_at')
            .eq('shop_id', shop.id)
            .eq('action', 'import')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        return NextResponse.json({ logs: logs || [] });
    } catch (error: unknown) {
        logger.error('Import history error:', { error });
        return NextResponse.json({ error: 'Импортын түүх ачаалахад алдаа гарлаа' }, { status: 500 });
    }
}

// POST - Import products from Excel/DOCX file
// Хоёр горим:
//   1. FormData + file        → файл уншиж parse хийнэ (preview=true бол DB бичихгүй)
//   2. JSON { products: [] }  → preview-ээс баталгаажуулсан өгөгдлийг шууд хадгална (AI дахин дуудахгүй)
export async function POST(request: NextRequest) {
    let shopId: string | undefined;
    let userId: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;

    try {
        const shop = await getAuthUserShop();

        if (!shop) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        shopId = shop.id;
        userId = await getAuthUser();

        let products: GroupedProduct[] = [];
        let skipped: SkippedRow[] = [];
        let source = 'ai';
        let preview = false;

        const contentType = request.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            // Горим 2: preview-ээр баталгаажсан өгөгдлийг шууд хадгална
            const body = await request.json();
            products = Array.isArray(body.products) ? body.products : [];
            fileName = body.file_name || null;
            fileSize = body.file_size || null;
            source = 'preview_confirm';

            if (products.length === 0) {
                return NextResponse.json({ error: 'Импортлох бүтээгдэхүүн олдсонгүй' }, { status: 400 });
            }
        } else {
            // Горим 1: файл уншиж parse хийнэ
            const formData = await request.formData();
            const file = formData.get('file') as File;
            preview = formData.get('preview') === 'true';

            if (!file) {
                return NextResponse.json({ error: 'Файл оруулна уу' }, { status: 400 });
            }

            fileName = file.name;
            fileSize = file.size;

            const extension = file.name.toLowerCase().split('.').pop() || '';
            if (!ALLOWED_EXTENSIONS.includes(extension)) {
                return NextResponse.json(
                    { error: 'Зөвхөн Excel (.xlsx, .xls), CSV, Word (.docx) файл дэмжигдэнэ' },
                    { status: 400 }
                );
            }

            if (file.size > MAX_FILE_SIZE) {
                return NextResponse.json(
                    { error: 'Файлын хэмжээ 5MB-аас хэтэрсэн байна' },
                    { status: 400 }
                );
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const result = await parseProductFile(buffer, file.name, shop.id);
            products = result.products;
            skipped = result.skipped;
            source = result.source;
        }

        if (products.length === 0) {
            return NextResponse.json({
                error: 'Файлаас бүтээгдэхүүн олдсонгүй. Загвар файл ашиглан форматаа шалгана уу.',
                hint: 'Excel: "Нэр", "Үнэ" багана заавал байх ёстой. DOCX: "Нэр - Үнэ" формат',
                skipped
            }, { status: 400 });
        }

        // If preview mode, just return parsed products
        if (preview) {
            return NextResponse.json({
                preview: true,
                products,
                skipped,
                source,
                count: products.length
            });
        }

        const supabase = supabaseAdmin();

        // Base columns present in every shop's products table.
        const productsToInsert = products.map((p: GroupedProduct) => ({
            shop_id: shop.id,
            name: p.name,
            price: p.price,
            description: p.description || null,
            stock: p.stock ?? 0,
            type: p.type || 'physical',
            colors: p.colors || [],
            sizes: p.sizes || [],
            images: p.image_url ? [p.image_url] : [],
            has_variants: (p.variants?.length ?? 0) > 0,
            is_active: true
        }));

        // `unit` lives behind a staged migration (20260612120000_fix_products_unit_drift)
        // that some live DBs may not have applied yet. Insert it when available, but
        // retry without it on a missing-column / stale-schema-cache error so import
        // never hard-fails at the confirm step.
        const productsWithUnit = productsToInsert.map((row, i) => ({
            ...row,
            unit: products[i].unit || (products[i].type === 'service' ? 'захиалга' : 'ширхэг'),
        }));

        let { data: insertedProducts, error } = await supabase
            .from('products')
            .insert(productsWithUnit)
            .select();

        if (error && isMissingColumnError(error)) {
            logger.warn('Import: products insert retrying without "unit" (column missing / schema cache stale)', {
                error: error.message,
            });
            const retry = await supabase.from('products').insert(productsToInsert).select();
            insertedProducts = retry.data;
            error = retry.error;
        }

        if (error) throw error;
        if (!insertedProducts) throw new Error('Бүтээгдэхүүн хадгалагдсангүй');

        // Хувилбаруудыг бичнэ — нөөцийн нийлбэрийг trigger эцэг рүү автоматаар нэгтгэнэ
        // (PostgREST inserted мөрүүдийг оруулсан дарааллаар нь буцаадаг тул индексээр тааруулна)
        const variantsToInsert = insertedProducts.flatMap((inserted, i) =>
            (products[i].variants || []).map(v => ({
                product_id: inserted.id,
                sku: v.sku || null,
                name: variantDisplayName(v),
                options: v.options,
                price: v.price ?? null,
                stock: v.stock,
                is_active: true,
            }))
        );

        let variantCount = 0;
        if (variantsToInsert.length > 0) {
            const { error: variantError } = await supabase
                .from('product_variants')
                .insert(variantsToInsert);
            if (variantError) throw variantError;
            variantCount = variantsToInsert.length;
        }

        await logProductImport({
            shop_id: shop.id,
            user_id: userId,
            file_name: fileName,
            file_size: fileSize,
            action: 'import',
            source,
            total_rows: products.length + skipped.length,
            imported_count: insertedProducts.length,
            skipped_count: skipped.length,
            skipped_rows: skipped,
            status: skipped.length > 0 ? 'partial' : 'success',
        });

        return NextResponse.json({
            success: true,
            products: insertedProducts,
            count: insertedProducts.length,
            variant_count: variantCount,
            skipped,
            message: variantCount > 0
                ? `${insertedProducts.length} бүтээгдэхүүн (${variantCount} хувилбартай) амжилттай импорт хийгдлээ!`
                : `${insertedProducts.length} бүтээгдэхүүн амжилттай импорт хийгдлээ!`
        });

    } catch (error: unknown) {
        logger.error('Import error:', { error: error });

        if (shopId) {
            await logProductImport({
                shop_id: shopId,
                user_id: userId,
                file_name: fileName,
                file_size: fileSize,
                action: 'import',
                source: 'ai',
                total_rows: 0,
                imported_count: 0,
                skipped_count: 0,
                status: 'failed',
                error_message: error instanceof Error ? error.message : String(error),
            });
        }

        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Import failed',
        }, { status: 500 });
    }
}
