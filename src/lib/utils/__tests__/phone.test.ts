import { describe, it, expect } from 'vitest';
import { extractMongolianPhone, phoneMatchKey, phoneLookupVariants } from '@/lib/utils/phone';

describe('extractMongolianPhone', () => {
    it('extracts a bare 8-digit number', () => {
        expect(extractMongolianPhone('99112233')).toBe('99112233');
    });

    it('extracts a number embedded in the "авна" pattern', () => {
        expect(extractMongolianPhone('авна 99112233')).toBe('99112233');
        expect(extractMongolianPhone('Авна, дугаар 88001122 хаягаа авна уу')).toBe('88001122');
    });

    it('handles spaces, dashes and dots between digits', () => {
        expect(extractMongolianPhone('9911 2233')).toBe('99112233');
        expect(extractMongolianPhone('99-11-22-33')).toBe('99112233');
        expect(extractMongolianPhone('8800.11.22')).toBe('88001122');
    });

    it('strips an optional +976 / 976 country code', () => {
        expect(extractMongolianPhone('+976 99112233')).toBe('99112233');
        expect(extractMongolianPhone('+97699112233')).toBe('99112233');
        expect(extractMongolianPhone('976-8800-1122')).toBe('88001122');
    });

    it('accepts mobile/landline ranges 6-9 as the first digit', () => {
        expect(extractMongolianPhone('70113322 руу залгаарай')).toBe('70113322');
        expect(extractMongolianPhone('60001234')).toBe('60001234');
    });

    it('ignores prices and short numbers', () => {
        expect(extractMongolianPhone('Үнэ 50000₮')).toBeNull();
        expect(extractMongolianPhone('12000000')).toBeNull(); // starts with 1, not a phone
        expect(extractMongolianPhone('2 ширхэг авна')).toBeNull();
    });

    // Үл хөдлөхийн зар дор үнэ 60-99 сая гэж бичигдэх нь энгийн зүйл. Эдгээр нь
    // 8 оронтой, 6-9-өөр эхэлдэг тул хуучин regex утас гэж уншиж, брокерт
    // залгадаггүй дугаар өгдөг байсан.
    it('does not mistake Mongolian apartment prices for phone numbers', () => {
        expect(extractMongolianPhone('3 өрөө байр 85 000 000 төгрөг')).toBeNull();
        expect(extractMongolianPhone('Үнэ 85.000.000₮')).toBeNull();
        expect(extractMongolianPhone('зээлээр авна 65 000 000 хүртэл')).toBeNull();
        expect(extractMongolianPhone('2 өрөө 78000000')).toBeNull();
        expect(extractMongolianPhone('Үнэ 78000000')).toBeNull();
        expect(extractMongolianPhone('78000000 төгрөг')).toBeNull();
    });

    it('still finds the phone when a price is mentioned in the same comment', () => {
        expect(extractMongolianPhone('85 000 000 үнэтэй юу? авна 99112233')).toBe('99112233');
        expect(extractMongolianPhone('Үнэ хэд вэ 88112233')).toBe('88112233');
    });

    it('does not slice 8 digits out of a longer adjacent digit run', () => {
        expect(extractMongolianPhone('order991122334455')).toBeNull();
    });

    it('returns the first valid number when several are present', () => {
        expect(extractMongolianPhone('99112233 эсвэл 88445566')).toBe('99112233');
    });

    it('returns null for empty / missing input', () => {
        expect(extractMongolianPhone('')).toBeNull();
        expect(extractMongolianPhone(null)).toBeNull();
        expect(extractMongolianPhone(undefined)).toBeNull();
        expect(extractMongolianPhone('энд дугаар алга')).toBeNull();
    });
});

describe('phoneMatchKey', () => {
    it('reduces any format to the last 8 digits', () => {
        expect(phoneMatchKey('99112233')).toBe('99112233');
        expect(phoneMatchKey('+976 99112233')).toBe('99112233');
        expect(phoneMatchKey('976-9911-2233')).toBe('99112233');
    });

    it('returns null when fewer than 8 digits', () => {
        expect(phoneMatchKey('1234')).toBeNull();
        expect(phoneMatchKey(null)).toBeNull();
        expect(phoneMatchKey('')).toBeNull();
    });

    it('matches an extracted comment phone against a stored +976 order phone', () => {
        const fromComment = extractMongolianPhone('авна 99112233');
        expect(phoneMatchKey(fromComment)).toBe(phoneMatchKey('+976 9911 2233'));
    });
});

describe('phoneLookupVariants', () => {
    it('includes the bare digits and the common country-code shapes', () => {
        const v = phoneLookupVariants('99112233');
        expect(v).toContain('99112233');
        expect(v).toContain('+97699112233');
        expect(v).toContain('976-99112233');
        expect(v).toContain('9911 2233');
        expect(v).toContain('9911-2233');
    });

    it('normalises input that already carries a country code or separators', () => {
        expect(phoneLookupVariants('+976 9911-2233')).toContain('99112233');
        expect(phoneLookupVariants('9911 2233')).toContain('99112233');
    });

    it('returns nothing when there are not 8 digits to work with', () => {
        expect(phoneLookupVariants('1234')).toEqual([]);
        expect(phoneLookupVariants('')).toEqual([]);
    });
});
