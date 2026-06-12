import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { SkippedRow } from '@/lib/utils/file-parser';

export interface ImportAuditEntry {
    shop_id: string;
    user_id?: string | null;
    file_name?: string | null;
    file_size?: number | null;
    action: 'parse' | 'import';
    source: string;
    total_rows: number;
    imported_count: number;
    skipped_count: number;
    skipped_rows?: SkippedRow[];
    status: 'success' | 'partial' | 'failed';
    error_message?: string | null;
}

/**
 * Импортын үйлдлийг product_import_logs хүснэгтэд бүртгэнэ.
 * Audit бичилт амжилтгүй болсон ч импортын урсгалыг зогсоохгүй.
 */
export async function logProductImport(entry: ImportAuditEntry): Promise<void> {
    try {
        const { error } = await supabaseAdmin()
            .from('product_import_logs')
            .insert({
                ...entry,
                skipped_rows: entry.skipped_rows ?? [],
            });
        if (error) throw error;
    } catch (error) {
        logger.error('Import audit log failed:', { error });
    }
}
