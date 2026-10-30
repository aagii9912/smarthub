/**
 * Улаанбаатарын цаг (Asia/Ulaanbaatar, UTC+8). Монгол 2017 оноос хойш зуны
 * цаг хэрэглэдэггүй тул тогтмол offset. Сервер (Vercel) UTC дээр ажилладаг
 * тул "өнөөдөр", "08:00" зэргийг заавал энэ функцуудаар тооцно.
 */

import { parseDate } from '@/lib/utils/date';

export const UB_TIMEZONE = 'Asia/Ulaanbaatar';
const UB_OFFSET_MS = 8 * 60 * 60 * 1000;

// Offset-гүй ISO огноо/цаг: "2026-10-11T15:00", "2026-10-11 15:00:00.000".
const NAIVE_ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

/**
 * Огноо/цагийн мөрийг Date болгоно. Offset-гүй мөрийг ("2026-10-11T15:00")
 * серверийн (UTC) биш UB-ийн цаг гэж үзнэ. Offset/Z-тэй мөрийг хэвээр нь.
 */
export function parseUbDateTime(input: string): Date {
    const s = input.trim();
    const m = NAIVE_ISO_RE.exec(s);
    if (!m) return parseDate(s);

    const [y, mo, d, h, mi, sec] = m.slice(1, 7).map(v => Number(v ?? 0));
    const ms = Number((m[7] ?? '0').padEnd(3, '0'));
    const date = new Date(Date.UTC(y, mo - 1, d, h, mi, sec, ms) - UB_OFFSET_MS);

    // Date.UTC "2026-02-30"-г 3-р сар руу шилжүүлдэг — ийм огноог хүлээж авахгүй.
    const local = new Date(date.getTime() + UB_OFFSET_MS);
    const valid = local.getUTCFullYear() === y && local.getUTCMonth() === mo - 1
        && local.getUTCDate() === d && local.getUTCHours() === h && local.getUTCMinutes() === mi;
    return valid ? date : new Date(NaN);
}

/** UB-ийн гарагийн индекс (0 = Ням … 6 = Бям). */
export function ubWeekday(date: Date): number {
    return new Date(date.getTime() + UB_OFFSET_MS).getUTCDay();
}

/** UB-ийн хуанлийн өдөр 'YYYY-MM-DD'. */
export function ubDateKey(date: Date): string {
    return new Date(date.getTime() + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/** UB-ийн цаг (0–23). */
export function ubHour(date: Date): number {
    return new Date(date.getTime() + UB_OFFSET_MS).getUTCHours();
}

/** Тухайн агшны UB өдрийн эхлэл (00:00 UB) — UTC Date хэлбэрээр. */
export function ubDayStart(date: Date): Date {
    const local = new Date(date.getTime() + UB_OFFSET_MS);
    local.setUTCHours(0, 0, 0, 0);
    return new Date(local.getTime() - UB_OFFSET_MS);
}

/** Үйлчлүүлэгчид харуулах огноо, цаг: "10-р сарын 11, 15:00". */
export function formatUbDateTime(date: Date): string {
    const local = new Date(date.getTime() + UB_OFFSET_MS);
    const month = local.getUTCMonth() + 1;
    const day = local.getUTCDate();
    const hh = String(local.getUTCHours()).padStart(2, '0');
    const mm = String(local.getUTCMinutes()).padStart(2, '0');
    return `${month}-р сарын ${day}, ${hh}:${mm}`;
}

/** Зөвхөн цаг: "15:00". */
export function formatUbTime(date: Date): string {
    const local = new Date(date.getTime() + UB_OFFSET_MS);
    return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}
