/**
 * Tests for currency formatting helpers (Mongolian tögrög).
 * These power KPI cards and report rows — wrong abbreviation/rounding
 * shows the shop owner the wrong revenue at a glance.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyFull } from '@/lib/utils/format';

describe('formatCurrency (compact)', () => {
    it('abbreviates values ≥ 1M with one decimal', () => {
        expect(formatCurrency(1_200_000)).toBe('₮1.2M');
        expect(formatCurrency(2_500_000)).toBe('₮2.5M');
    });

    it('abbreviates exactly 1M', () => {
        expect(formatCurrency(1_000_000)).toBe('₮1.0M');
    });

    it('uses thousands separators below 1M', () => {
        // toLocaleString grouping uses commas in the default (C) locale
        expect(formatCurrency(950_000)).toBe(`₮${(950_000).toLocaleString()}`);
    });

    it('rounds fractional tögrög below 1M', () => {
        expect(formatCurrency(1234.6)).toBe(`₮${(1235).toLocaleString()}`);
    });

    it('handles zero', () => {
        expect(formatCurrency(0)).toBe('₮0');
    });
});

describe('formatCurrencyFull (no abbreviation)', () => {
    it('never abbreviates, even for millions', () => {
        expect(formatCurrencyFull(2_500_000)).toBe(`₮${(2_500_000).toLocaleString()}`);
    });

    it('rounds to whole tögrög', () => {
        expect(formatCurrencyFull(99.4)).toBe('₮99');
        expect(formatCurrencyFull(99.5)).toBe('₮100');
    });

    it('handles zero', () => {
        expect(formatCurrencyFull(0)).toBe('₮0');
    });
});
