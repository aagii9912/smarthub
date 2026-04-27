/**
 * Admin Settings API
 * System-wide configuration stored in `system_settings` (single-row JSONB).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';
import { DEFAULT_SETTINGS, type SystemSettings } from '@/lib/admin/settings';

export async function GET() {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();

        const { data, error } = await supabase
            .from('system_settings')
            .select('settings, updated_at')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            logger.error('system_settings read failed', { error: error.message });
        }

        // Merge stored settings on top of defaults so newly added keys still show up
        const stored = (data?.settings as Partial<SystemSettings> | undefined) ?? {};
        const settings: SystemSettings = {
            general: { ...DEFAULT_SETTINGS.general, ...(stored.general ?? {}) },
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(stored.notifications ?? {}) },
            billing: { ...DEFAULT_SETTINGS.billing, ...(stored.billing ?? {}) },
            ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai ?? {}) },
        };

        return NextResponse.json({
            settings,
            admin: { email: admin.email, role: admin.role },
            updated_at: data?.updated_at ?? null,
        });
    } catch (error: unknown) {
        logger.error('Settings fetch error:', { error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin || admin.role !== 'super_admin') {
            return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
        }

        const supabase = supabaseAdmin();

        const { data: existing } = await supabase
            .from('system_settings')
            .select('settings')
            .eq('id', 1)
            .maybeSingle();

        const prev = (existing?.settings as Partial<SystemSettings> | undefined) ?? {};

        // Section-wise merge so a partial PUT doesn't wipe other sections
        const incoming = body as Partial<SystemSettings>;
        const merged: SystemSettings = {
            general: { ...DEFAULT_SETTINGS.general, ...(prev.general ?? {}), ...(incoming.general ?? {}) },
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(prev.notifications ?? {}), ...(incoming.notifications ?? {}) },
            billing: { ...DEFAULT_SETTINGS.billing, ...(prev.billing ?? {}), ...(incoming.billing ?? {}) },
            ai: { ...DEFAULT_SETTINGS.ai, ...(prev.ai ?? {}), ...(incoming.ai ?? {}) },
        };

        // Numeric guards on critical fields
        if (!Number.isFinite(merged.billing.trial_days) || merged.billing.trial_days < 0 || merged.billing.trial_days > 365) {
            return NextResponse.json({ error: 'trial_days must be between 0 and 365' }, { status: 400 });
        }
        if (!Number.isFinite(merged.billing.grace_period_days) || merged.billing.grace_period_days < 0 || merged.billing.grace_period_days > 365) {
            return NextResponse.json({ error: 'grace_period_days must be between 0 and 365' }, { status: 400 });
        }

        const { error } = await supabase
            .from('system_settings')
            .upsert({ id: 1, settings: merged, updated_by: admin.id }, { onConflict: 'id' });

        if (error) throw error;

        logger.success('system_settings updated', { actor: admin.email });

        return NextResponse.json({
            success: true,
            message: 'Settings saved',
            settings: merged,
        });
    } catch (error: unknown) {
        logger.error('Settings update error:', { error });
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
