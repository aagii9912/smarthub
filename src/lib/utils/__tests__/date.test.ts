import { describe, it, expect } from 'vitest';
import { parseDate, formatDate, getStartOfPeriod } from '../date';

describe('parseDate — cross-browser timestamp parsing', () => {
    // Supabase/PostgREST returns timestamptz with a SPACE separator and a short
    // "+00" offset, which only Safari/WebKit parsed leniently (the macOS-only bug).
    it('parses Postgres "YYYY-MM-DD HH:mm:ss+00" without producing Invalid Date', () => {
        const d = parseDate('2026-06-15 09:30:00+00');
        expect(Number.isNaN(d.getTime())).toBe(false);
        expect(d.toISOString()).toBe('2026-06-15T09:30:00.000Z');
    });

    it('parses microsecond-precision Postgres timestamps', () => {
        const d = parseDate('2026-06-15 09:30:00.123456+00');
        expect(Number.isNaN(d.getTime())).toBe(false);
    });

    it('still accepts strict ISO 8601 strings', () => {
        const d = parseDate('2026-06-15T09:30:00.000Z');
        expect(d.toISOString()).toBe('2026-06-15T09:30:00.000Z');
    });

    it('still accepts date-only strings', () => {
        const d = parseDate('2026-06-15');
        expect(Number.isNaN(d.getTime())).toBe(false);
    });

    it('passes through Date objects unchanged', () => {
        const orig = new Date('2026-06-15T09:30:00.000Z');
        expect(parseDate(orig)).toBe(orig);
    });
});

describe('formatDate — invalid date guard', () => {
    it('returns "—" instead of "Invalid Date" for garbage input', () => {
        expect(formatDate('not-a-date')).toBe('—');
    });

    it('formats a Postgres-style timestamp instead of failing', () => {
        expect(formatDate('2026-06-15 09:30:00+00')).not.toBe('—');
    });
});

describe('getStartOfPeriod — month is a calendar month, not rolling 30 days', () => {
    it('month start is the 1st of the current month at midnight', () => {
        const start = getStartOfPeriod('month');
        const now = new Date();
        expect(start.getDate()).toBe(1);
        expect(start.getMonth()).toBe(now.getMonth());
        expect(start.getFullYear()).toBe(now.getFullYear());
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
    });

    it('today start is midnight today', () => {
        const start = getStartOfPeriod('today');
        const now = new Date();
        expect(start.getDate()).toBe(now.getDate());
        expect(start.getHours()).toBe(0);
    });
});
