/**
 * Memory TTL - Time-based cleanup for customer AI memory
 * Prevents memory bloat and ensures data relevance
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import type { CustomerMemory } from '../tools/memory';

/**
 * Memory configuration
 */
export const MEMORY_CONFIG = {
    MAX_KEYS: 20,           // Maximum number of memory keys per customer
    TTL_DAYS: 90,           // Days before memory expires
    CLEANUP_BATCH_SIZE: 100 // Number of customers to process per cleanup run
};

/**
 * Memory entry with timestamp
 */
interface MemoryEntry {
    value: string | string[] | number;
    created_at: string;
    updated_at: string;
    access_count: number;
}

/**
 * Memory metadata
 */
interface MemoryMeta {
    last_cleanup: string;
    version: number;
}

/**
 * Enhanced memory with TTL tracking
 * Using separate type to avoid index signature conflict
 */
type EnhancedMemory = {
    [key: string]: MemoryEntry | MemoryMeta | undefined;
} & {
    _meta?: MemoryMeta;
};

/**
 * Check if a memory entry has expired
 */
export function isExpired(entry: MemoryEntry, ttlDays: number = MEMORY_CONFIG.TTL_DAYS): boolean {
    const updatedAt = new Date(entry.updated_at);
    const now = new Date();
    const diffDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > ttlDays;
}

/**
 * Save memory with TTL tracking
 */
export async function saveMemoryWithTTL(
    customerId: string,
    key: string,
    value: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = supabaseAdmin();
        const now = new Date().toISOString();

        // Get current memory
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('ai_memory')
            .eq('id', customerId)
            .single();

        if (fetchError) {
            return { success: false, error: 'Customer not found' };
        }

        const currentMemory: EnhancedMemory = customer?.ai_memory || {};

        // Check if key exists
        const existingEntry = currentMemory[key] as MemoryEntry | undefined;

        // Create or update entry
        const newEntry: MemoryEntry = {
            value,
            created_at: existingEntry?.created_at || now,
            updated_at: now,
            access_count: (existingEntry?.access_count || 0) + 1
        };

        // Add to memory
        currentMemory[key] = newEntry;

        // Apply cleanup if too many keys
        const cleanedMemory = cleanupMemory(currentMemory);

        // Add metadata
        cleanedMemory._meta = {
            last_cleanup: now,
            version: (currentMemory._meta?.version || 0) + 1
        };

        // Save
        const { error: updateError } = await supabase
            .from('customers')
            .update({ ai_memory: cleanedMemory })
            .eq('id', customerId);

        if (updateError) {
            return { success: false, error: 'Failed to save memory' };
        }

        return { success: true };
    } catch (error) {
        logger.error('Error saving memory with TTL:', { error });
        return { success: false, error: 'System error' };
    }
}

/**
 * Cleanup expired and excess memory entries
 */
export function cleanupMemory(
    memory: EnhancedMemory,
    config: { maxKeys?: number; ttlDays?: number } = {}
): EnhancedMemory {
    const { maxKeys = MEMORY_CONFIG.MAX_KEYS, ttlDays = MEMORY_CONFIG.TTL_DAYS } = config;

    // Get all entries (excluding metadata)
    const entries = Object.entries(memory)
        .filter(([key]) => key !== '_meta')
        .map(([key, value]) => ({
            key,
            entry: value as MemoryEntry
        }));

    // Filter out expired entries
    const validEntries = entries.filter(({ entry }) => !isExpired(entry, ttlDays));

    // If still too many, keep most recently updated ones
    const sortedEntries = validEntries
        .sort((a, b) => {
            // Sort by update time, then by access count
            const timeCompare = new Date(b.entry.updated_at).getTime() -
                new Date(a.entry.updated_at).getTime();
            if (timeCompare !== 0) return timeCompare;
            return b.entry.access_count - a.entry.access_count;
        })
        .slice(0, maxKeys);

    // Rebuild memory object
    const cleanedMemory: EnhancedMemory = {};
    for (const { key, entry } of sortedEntries) {
        cleanedMemory[key] = entry;
    }

    return cleanedMemory;
}

/**
 * Get memory with access tracking
 */
export async function getMemoryWithTracking(
    customerId: string
): Promise<Record<string, string | string[] | number> | null> {
    try {
        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('customers')
            .select('ai_memory')
            .eq('id', customerId)
            .single();

        if (error || !data?.ai_memory) {
            return null;
        }

        const memory = data.ai_memory as EnhancedMemory;

        // Convert enhanced memory to simple format, filtering expired
        const result: Record<string, string | string[] | number> = {};

        for (const [key, value] of Object.entries(memory)) {
            if (key === '_meta') continue;

            const entry = value as MemoryEntry;
            if (!isExpired(entry)) {
                result[key] = entry.value;
            }
        }

        return Object.keys(result).length > 0 ? result : null;
    } catch (error) {
        logger.error('Error getting memory:', { error });
        return null;
    }
}

/**
 * Batch cleanup job - run periodically (e.g., daily cron)
 */
export async function runBatchCleanup(): Promise<{
    processed: number;
    cleaned: number;
    errors: number;
}> {
    const supabase = supabaseAdmin();
    let processed = 0;
    let cleaned = 0;
    let errors = 0;

    try {
        // Get customers with ai_memory
        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, ai_memory')
            .not('ai_memory', 'is', null)
            .limit(MEMORY_CONFIG.CLEANUP_BATCH_SIZE);

        if (error || !customers) {
            logger.error('Failed to fetch customers for cleanup:', { error });
            return { processed: 0, cleaned: 0, errors: 1 };
        }

        for (const customer of customers) {
            processed++;

            try {
                const memory = customer.ai_memory as EnhancedMemory;
                const originalKeyCount = Object.keys(memory).filter(k => k !== '_meta').length;

                const cleanedMemory = cleanupMemory(memory);
                const newKeyCount = Object.keys(cleanedMemory).filter(k => k !== '_meta').length;

                // Only update if something was cleaned
                if (newKeyCount < originalKeyCount) {
                    cleanedMemory._meta = {
                        last_cleanup: new Date().toISOString(),
                        version: (memory._meta?.version || 0) + 1
                    };

                    await supabase
                        .from('customers')
                        .update({ ai_memory: cleanedMemory })
                        .eq('id', customer.id);

                    cleaned++;
                    logger.debug('Cleaned memory for customer:', {
                        customerId: customer.id,
                        removed: originalKeyCount - newKeyCount
                    });
                }
            } catch (err) {
                errors++;
                logger.error('Error cleaning customer memory:', {
                    customerId: customer.id,
                    error: String(err)
                });
            }
        }

        logger.info('Batch cleanup completed:', { processed, cleaned, errors });
        return { processed, cleaned, errors };
    } catch (error) {
        logger.error('Batch cleanup failed:', { error });
        return { processed, cleaned, errors: errors + 1 };
    }
}

/**
 * Delete specific memory key
 */
export async function deleteMemoryKey(
    customerId: string,
    key: string
): Promise<boolean> {
    try {
        const supabase = supabaseAdmin();

        const { data } = await supabase
            .from('customers')
            .select('ai_memory')
            .eq('id', customerId)
            .single();

        if (!data?.ai_memory) return true;

        const memory = { ...data.ai_memory };
        delete memory[key];

        await supabase
            .from('customers')
            .update({ ai_memory: memory })
            .eq('id', customerId);

        return true;
    } catch (error) {
        logger.error('Error deleting memory key:', { error });
        return false;
    }
}

/**
 * Clear all memory for a customer
 */
export async function clearAllMemory(customerId: string): Promise<boolean> {
    try {
        const supabase = supabaseAdmin();

        await supabase
            .from('customers')
            .update({ ai_memory: null })
            .eq('id', customerId);

        return true;
    } catch (error) {
        logger.error('Error clearing memory:', { error });
        return false;
    }
}
