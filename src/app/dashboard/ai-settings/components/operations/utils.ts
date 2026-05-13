/**
 * Helpers shared by per-business-type operations panels. All panels accept
 * a generic `Record<string, unknown>` (the raw `business_setup_data` blob)
 * and call `setField` to merge updates back. Centralising the type-safe
 * getter/setter logic keeps the panels short and consistent.
 */

export type Setup = Record<string, unknown>;
export type SetField = (key: string, value: unknown) => void;

export function getString(data: Setup, key: string): string {
    const v = data[key];
    return typeof v === 'string' ? v : '';
}

export function getNumber(data: Setup, key: string): number | undefined {
    const v = data[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

export function getBoolean(data: Setup, key: string): boolean | undefined {
    const v = data[key];
    return typeof v === 'boolean' ? v : undefined;
}

export function getStringArray(data: Setup, key: string): string[] {
    const v = data[key];
    if (Array.isArray(v)) {
        return v.filter((x): x is string => typeof x === 'string');
    }
    return [];
}

export function getObjectArray<T extends object>(data: Setup, key: string): T[] {
    const v = data[key];
    return Array.isArray(v) ? (v as T[]) : [];
}
