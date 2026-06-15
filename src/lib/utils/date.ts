/**
 * Date/Time utility functions
 */

/**
 * Robustly parse a date value into a Date object.
 *
 * Supabase / PostgREST serializes `timestamptz` columns as
 * `2026-06-15 09:30:00+00` — a SPACE separator and a short `+00` offset.
 * That format is NOT part of the ECMAScript Date spec, so `new Date(str)`
 * only parses it on Safari/WebKit (macOS) and returns `Invalid Date` on
 * Chrome/Firefox/other OSes. We normalize it to strict ISO 8601 first so
 * dates render correctly on every browser and platform.
 */
export function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;

  let s = String(date).trim();
  // "2026-06-15 09:30:00+00" → "2026-06-15T09:30:00+00"
  s = s.replace(' ', 'T');
  // Expand a short trailing timezone offset: "+00" → "+00:00", "-05" → "-05:00".
  // Only when a time component is present, so a date-only "2026-06-15" isn't
  // mistaken for an offset (its trailing "-15" must stay the day).
  if (s.includes('T')) {
    s = s.replace(/([+-]\d{2})$/, '$1:00');
  }

  return new Date(s);
}

/** True when a parsed Date is usable (not Invalid Date). */
function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/**
 * Format a date string to relative time (e.g., "5 мин өмнө", "2 цаг өмнө")
 * Uses Asia/Ulaanbaatar timezone for Mongolia
 */
export function formatTimeAgo(date: string | Date): string {
  const now = new Date();
  const past = parseDate(date);
  if (!isValidDate(past)) return '—';
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Саяхан';
  if (diffMins < 60) return `${diffMins} мин өмнө`;
  if (diffHours < 24) return `${diffHours} цаг өмнө`;
  return `${diffDays} өдрийн өмнө`;
}

/**
 * Format time for display (HH:MM format) using Mongolian timezone
 */
export function formatTime(date: string | Date): string {
  const d = parseDate(date);
  if (!isValidDate(d)) return '—';
  return d.toLocaleTimeString('mn-MN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ulaanbaatar'
  });
}

/**
 * Format a date string to localized date/time string
 */
export function formatDate(date: string | Date): string {
  const d = parseDate(date);
  if (!isValidDate(d)) return '—';
  return d.toLocaleString('mn-MN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date to short date string (e.g., "2024.01.15")
 */
export function formatShortDate(date: string | Date): string {
  const d = parseDate(date);
  if (!isValidDate(d)) return '—';
  return d.toLocaleDateString('mn-MN');
}

/**
 * Get start of today (midnight)
 */
export function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * Get start of period for filtering.
 *
 * - `today`  → midnight today
 * - `week`   → midnight 7 days ago (rolling week)
 * - `month`  → first day of the CURRENT calendar month (not a rolling
 *              30-day window). A rolling window made the "сар" total drift
 *              every day and never match the month the user expected.
 *
 * @param period - 'today', 'week', or 'month'
 */
export function getStartOfPeriod(period: 'today' | 'week' | 'month'): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      return date;
    case 'week':
      date.setDate(date.getDate() - 7);
      return date;
    case 'month':
      // Start of the current calendar month (e.g. June 1, 00:00).
      date.setDate(1);
      return date;
    default:
      return date;
  }
}
