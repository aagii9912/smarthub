/**
 * QPay merchant validation tests — РД normalize, хувь хүн / байгууллагын
 * схем, утас, банкны нэр → код.
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeRegisterNumber,
    normalizeMongolianPhone,
    isValidPersonRegister,
    isValidCompanyRegister,
    bankCodeFromName,
    qpayPersonMerchantSchema,
    qpayCompanyMerchantSchema,
    qpayMerchantInputSchema,
} from '@/lib/validations/qpay';

describe('normalizeRegisterNumber', () => {
    it('латин lookalike үсгийг кирилл болгож, зай/зураас устгана', () => {
        expect(normalizeRegisterNumber('ya 1234-5678')).toBe('УА12345678');
        expect(normalizeRegisterNumber(' уа12345678 ')).toBe('УА12345678');
        expect(normalizeRegisterNumber('AB12345678')).toBe('АВ12345678');
    });

    it('хоосон/null-д хоосон буцаана', () => {
        expect(normalizeRegisterNumber(null)).toBe('');
        expect(normalizeRegisterNumber(undefined)).toBe('');
    });

    it('зөвхөн эхний 2 тэмдэгтийг хөрвүүлнэ', () => {
        // 3 дахь байрлалд латин үсэг байвал хэвээр үлдэж, regex-д унана
        expect(normalizeRegisterNumber('YAA2345678')).toBe('УАA2345678');
        expect(isValidPersonRegister('YAA2345678')).toBe(false);
    });
});

describe('isValidPersonRegister / isValidCompanyRegister', () => {
    it('хувь хүн: 2 кирилл + 8 тоо', () => {
        expect(isValidPersonRegister('УА12345678')).toBe(true);
        expect(isValidPersonRegister('ӨҮ00000000')).toBe(true);
        expect(isValidPersonRegister('УА1234567')).toBe(false);
        expect(isValidPersonRegister('1234567')).toBe(false);
    });

    it('байгууллага: 7 тоо', () => {
        expect(isValidCompanyRegister('1234567')).toBe(true);
        expect(isValidCompanyRegister('12345678')).toBe(false);
        expect(isValidCompanyRegister('УА12345678')).toBe(false);
    });
});

describe('normalizeMongolianPhone', () => {
    it('улсын код, зай, хаалтыг арилгана', () => {
        expect(normalizeMongolianPhone('+976 9988 7766')).toBe('99887766');
        expect(normalizeMongolianPhone('(+976) 99887766')).toBe('99887766');
        expect(normalizeMongolianPhone('00976 9988-7766')).toBe('99887766');
        expect(normalizeMongolianPhone('9988-7766')).toBe('99887766');
    });
});

describe('bankCodeFromName', () => {
    it('монгол/англи нэрийг кодод буулгана', () => {
        expect(bankCodeFromName('Хаан банк')).toBe('050000');
        expect(bankCodeFromName('Khan Bank')).toBe('050000');
        expect(bankCodeFromName('Худалдаа хөгжлийн банк (TDB)')).toBe('040000');
        expect(bankCodeFromName('М банк')).toBe('390000');
    });

    it('код шууд ирвэл хэвээр, танихгүй бол null', () => {
        expect(bankCodeFromName('150000')).toBe('150000');
        expect(bankCodeFromName('Unknown Bank')).toBeNull();
        expect(bankCodeFromName('')).toBeNull();
    });
});

const validPerson = {
    merchant_type: 'person' as const,
    last_name: 'Батаа',
    first_name: 'Дорж',
    register_number: 'ya12345678',
    bank_code: '050000',
    account_number: '5012 345 678',
    account_name: 'Дорж Батаа',
    phone: '+976 9988 7766',
    email: 'dorj@example.com',
};

describe('qpayPersonMerchantSchema', () => {
    it('зөв өгөгдлийг normalize хийж хүлээн авна', () => {
        const parsed = qpayPersonMerchantSchema.parse(validPerson);
        expect(parsed.register_number).toBe('УА12345678');
        expect(parsed.phone).toBe('99887766');
        expect(parsed.account_number).toBe('5012345678');
    });

    it('буруу РД-г татгалзана', () => {
        const res = qpayPersonMerchantSchema.safeParse({ ...validPerson, register_number: '1234567' });
        expect(res.success).toBe(false);
    });

    it('7 оронтой утсыг татгалзана', () => {
        const res = qpayPersonMerchantSchema.safeParse({ ...validPerson, phone: '9988776' });
        expect(res.success).toBe(false);
    });

    it('банкны буруу кодыг татгалзана', () => {
        const res = qpayPersonMerchantSchema.safeParse({ ...validPerson, bank_code: '999999' });
        expect(res.success).toBe(false);
    });

    it('овог/нэр заавал', () => {
        const res = qpayPersonMerchantSchema.safeParse({ ...validPerson, first_name: '' });
        expect(res.success).toBe(false);
    });
});

describe('qpayCompanyMerchantSchema', () => {
    it('7 оронтой регистртэй байгууллагыг хүлээн авна', () => {
        const res = qpayCompanyMerchantSchema.safeParse({
            merchant_type: 'company',
            company_name: 'Тест ХХК',
            register_number: '1234567',
            bank_code: '040000',
            account_number: '400123456',
            account_name: 'Тест ХХК',
            phone: '99887766',
        });
        expect(res.success).toBe(true);
    });

    it('хувь хүний РД-г байгууллагад татгалзана', () => {
        const res = qpayCompanyMerchantSchema.safeParse({
            merchant_type: 'company',
            company_name: 'Тест ХХК',
            register_number: 'УА12345678',
            bank_code: '040000',
            account_number: '400123456',
            account_name: 'Тест ХХК',
            phone: '99887766',
        });
        expect(res.success).toBe(false);
    });
});

describe('qpayMerchantInputSchema (discriminated union)', () => {
    it('merchant_type-аар салгана', () => {
        const res = qpayMerchantInputSchema.safeParse(validPerson);
        expect(res.success).toBe(true);
        if (res.success) expect(res.data.merchant_type).toBe('person');
    });

    it('merchant_type байхгүй бол унана', () => {
        const { merchant_type: _omit, ...rest } = validPerson;
        void _omit;
        expect(qpayMerchantInputSchema.safeParse(rest).success).toBe(false);
    });
});
