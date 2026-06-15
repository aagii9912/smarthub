/**
 * Currency / number formatting helpers (Mongolian tögrög).
 */

/**
 * Compact currency for KPI cards — abbreviates millions (e.g. "₮1.2M").
 */
export function formatCurrency(value: number): string {
    if (value >= 1_000_000) {
        return `₮${(value / 1_000_000).toFixed(1)}M`;
    }
    return `₮${Math.round(value).toLocaleString()}`;
}

/**
 * Full currency with thousands separators, no abbreviation —
 * for breakdown rows and tooltips where the exact figure matters.
 */
export function formatCurrencyFull(value: number): string {
    return `₮${Math.round(value).toLocaleString()}`;
}
