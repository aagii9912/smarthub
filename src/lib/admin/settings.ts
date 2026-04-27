/**
 * System-wide settings (single-row `system_settings` JSONB).
 *
 * Use `getSystemSettings()` to read the whole blob (or `getBillingSettings()` for
 * the most common case). Both fall back to DEFAULT_SETTINGS when the row is
 * absent or a section is missing — callers can rely on the fields existing.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

export interface SystemSettings {
    general: {
        site_name: string;
        support_email: string;
        default_currency: string;
    };
    notifications: {
        email_enabled: boolean;
        push_enabled: boolean;
        sms_enabled: boolean;
    };
    billing: {
        trial_days: number;
        grace_period_days: number;
        auto_suspend: boolean;
    };
    ai: {
        default_provider: 'gemini';
        default_model: string;
        max_tokens: number;
        temperature: number;
    };
}

export const DEFAULT_SETTINGS: SystemSettings = {
    general: {
        site_name: 'Syncly',
        support_email: 'support@smarthub.mn',
        default_currency: 'MNT',
    },
    notifications: {
        email_enabled: true,
        push_enabled: true,
        sms_enabled: false,
    },
    billing: {
        trial_days: 3,
        grace_period_days: 7,
        auto_suspend: true,
    },
    ai: {
        default_provider: 'gemini',
        default_model: 'gemini-3.1-flash-lite-preview',
        max_tokens: 4096,
        temperature: 0.7,
    },
};

export async function getSystemSettings(): Promise<SystemSettings> {
    try {
        const supabase = supabaseAdmin();
        const { data, error } = await supabase
            .from('system_settings')
            .select('settings')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            logger.warn('system_settings read failed, using defaults', { error: error.message });
            return DEFAULT_SETTINGS;
        }

        const stored = (data?.settings as Partial<SystemSettings> | undefined) ?? {};
        return {
            general: { ...DEFAULT_SETTINGS.general, ...(stored.general ?? {}) },
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) },
            billing: { ...DEFAULT_SETTINGS.billing, ...(stored.billing ?? {}) },
            ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai ?? {}) },
        };
    } catch (err: unknown) {
        logger.warn('system_settings load crashed, using defaults', {
            error: err instanceof Error ? err.message : String(err),
        });
        return DEFAULT_SETTINGS;
    }
}

export async function getBillingSettings(): Promise<SystemSettings['billing']> {
    const all = await getSystemSettings();
    return all.billing;
}
