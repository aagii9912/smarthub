/**
 * `business_setup_data`-аас утга аюулгүй уншиж prompt-ын мөр гаргах
 * туслахууд. Pack-уудын `prompt.renderSetup` ашиглана; утга байхгүй эсвэл
 * буруу төрөлтэй бол чимээгүй алгасна.
 */

import type { SetupData } from './types';

export function pickString(data: SetupData, key: string): string | null {
    const v = data[key];
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function pickNumber(data: SetupData, key: string): number | null {
    const v = data[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    }
    return null;
}

export function pickBoolean(data: SetupData, key: string): boolean | null {
    const v = data[key];
    if (typeof v === 'boolean') return v;
    return null;
}

export function pickArray(data: SetupData, key: string): string[] {
    const v = data[key];
    if (Array.isArray(v)) {
        return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    }
    if (typeof v === 'string' && v.trim().length > 0) {
        return v.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }
    return [];
}

/** `[{ name, duration, price }]` жагсаалтыг "Нэр (30мин, 25,000₮)" болгоно. */
export function formatServiceItems(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
        .map(s => {
            const name = typeof s.name === 'string' ? s.name : '';
            const dur = typeof s.duration === 'number' ? `${s.duration}мин` : '';
            const price = typeof s.price === 'number' ? `${s.price.toLocaleString()}₮` : '';
            return `${name} (${[dur, price].filter(Boolean).join(', ')})`;
        })
        .filter(Boolean);
}
