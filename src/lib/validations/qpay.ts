import { z } from 'zod';
import { BANK_CODES, CITY_CODES, UB_DISTRICT_CODES } from '@/lib/payment/qpay-merchant';
import { normalizeMongolianPhone } from '@/lib/utils/phone';

export { normalizeMongolianPhone };

/**
 * QPay merchant бүртгэлийн validation.
 *
 * Хувь хүний регистр = 2 кирилл үсэг + 8 тоо (жнь: УА12345678).
 * Байгууллагын регистр = 7 тоо.
 * Утас = 8 оронтой дотоодын дугаар (улсын код, зай, зураасгүй).
 */

// ──────────────────────────────────────────────
// Normalizers
// ──────────────────────────────────────────────

/** Латин lookalike үсгийг кирилл рүү хөрвүүлнэ (РД-ийн эхний 2 үсэгт). */
const LATIN_TO_CYRILLIC: Record<string, string> = {
    A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М', O: 'О',
    P: 'Р', T: 'Т', X: 'Х', Y: 'У', U: 'Ү', Q: 'Ө',
};

export function normalizeRegisterNumber(raw: string | null | undefined): string {
    if (!raw) return '';
    const compact = raw.replace(/[\s\-–—.]/g, '').toUpperCase();
    // Эхний хоёр тэмдэгтийг латин → кирилл болгоно; бусдыг хэвээр
    return compact
        .split('')
        .map((ch, i) => (i < 2 ? LATIN_TO_CYRILLIC[ch] ?? ch : ch))
        .join('');
}

/** Хувь хүний РД: 2 кирилл үсэг + 8 тоо. */
export const PERSON_REGISTER_RE = /^[А-ЯӨҮ]{2}\d{8}$/;
/** Байгууллагын регистр: 7 тоо. */
export const COMPANY_REGISTER_RE = /^\d{7}$/;

export function isValidPersonRegister(value: string): boolean {
    return PERSON_REGISTER_RE.test(normalizeRegisterNumber(value));
}

export function isValidCompanyRegister(value: string): boolean {
    return COMPANY_REGISTER_RE.test(normalizeRegisterNumber(value));
}

/**
 * Банкны нэрээс QPay банкны код гаргана. Settings/Setup UI банкны нэрийг
 * хадгалдаг (`shops.bank_name`) тул энэ map хоёр route-д давхардаж байсныг
 * нэг газар төвлөрүүлэв. Танихгүй нэр → null.
 */
const BANK_NAME_TO_CODE: Array<[string, string]> = [
    ['хаан', BANK_CODES.KHAN_BANK], ['khan', BANK_CODES.KHAN_BANK],
    ['голомт', BANK_CODES.GOLOMT], ['golomt', BANK_CODES.GOLOMT],
    ['худалдаа хөгжлийн', BANK_CODES.TDB], ['tdb', BANK_CODES.TDB], ['хxб', BANK_CODES.TDB], ['ххб', BANK_CODES.TDB],
    ['хас', BANK_CODES.XAC_BANK], ['xac', BANK_CODES.XAC_BANK], ['khas', BANK_CODES.XAC_BANK],
    ['капитрон', BANK_CODES.CAPITRON], ['capitron', BANK_CODES.CAPITRON],
    ['төрийн', BANK_CODES.STATE_BANK], ['state', BANK_CODES.STATE_BANK],
    ['богд', BANK_CODES.BOGD_BANK], ['bogd', BANK_CODES.BOGD_BANK],
    ['м банк', BANK_CODES.M_BANK], ['m bank', BANK_CODES.M_BANK], ['mbank', BANK_CODES.M_BANK],
    ['капитал', BANK_CODES.CAPITAL_BANK], ['capital', BANK_CODES.CAPITAL_BANK],
    ['монгол банк', BANK_CODES.MONGOL_BANK],
];

export function bankCodeFromName(bankName: string | null | undefined): string | null {
    if (!bankName) return null;
    const needle = bankName.toLowerCase().trim();
    if (!needle) return null;
    // Код шууд ирсэн бол хэвээр
    const codes = Object.values(BANK_CODES) as string[];
    if (codes.includes(needle)) return needle;
    const hit = BANK_NAME_TO_CODE.find(([key]) => needle.includes(key));
    return hit ? hit[1] : null;
}

// ──────────────────────────────────────────────
// Schemas
// ──────────────────────────────────────────────

const bankCodeSchema = z
    .string()
    .trim()
    .refine((v) => (Object.values(BANK_CODES) as string[]).includes(v), 'Банкны код буруу байна');

const phoneSchema = z
    .string()
    .transform(normalizeMongolianPhone)
    .refine((v) => /^\d{8}$/.test(v), 'Утасны дугаар 8 оронтой байх ёстой');

const emailSchema = z.string().trim().email('Имэйл хаяг буруу байна').max(120);

const accountNumberSchema = z
    .string()
    .transform((v) => v.replace(/[\s\-]/g, ''))
    .refine((v) => /^\d{6,20}$/.test(v), 'Дансны дугаар 6-20 оронтой тоо байх ёстой');

const nameSchema = z.string().trim().min(1, 'Заавал бөглөнө').max(100);

const cityCodeSchema = z.string().trim().regex(/^\d{5}$/, 'Хотын код буруу байна');
const districtCodeSchema = z.string().trim().regex(/^\d{5}$/, 'Дүүргийн код буруу байна');

const baseMerchantFields = {
    bank_code: bankCodeSchema,
    account_number: accountNumberSchema,
    account_name: nameSchema,
    phone: phoneSchema,
    email: emailSchema.optional(),
    city_code: cityCodeSchema.optional(),
    district_code: districtCodeSchema.optional(),
    address: z.string().trim().max(200).optional(),
    mcc_code: z.string().trim().regex(/^\d{4}$/).optional(),
};

export const qpayPersonMerchantSchema = z.object({
    merchant_type: z.literal('person'),
    last_name: nameSchema,
    first_name: nameSchema,
    register_number: z
        .string()
        .transform(normalizeRegisterNumber)
        .refine((v) => PERSON_REGISTER_RE.test(v), 'РД 2 кирилл үсэг + 8 тоо байх ёстой (жнь: УА12345678)'),
    ...baseMerchantFields,
});

export const qpayCompanyMerchantSchema = z.object({
    merchant_type: z.literal('company'),
    company_name: nameSchema,
    register_number: z
        .string()
        .transform(normalizeRegisterNumber)
        .refine((v) => COMPANY_REGISTER_RE.test(v), 'Байгууллагын регистр 7 оронтой тоо байх ёстой'),
    ...baseMerchantFields,
});

export const qpayMerchantInputSchema = z.discriminatedUnion('merchant_type', [
    qpayPersonMerchantSchema,
    qpayCompanyMerchantSchema,
]);

export type QPayPersonMerchantInput = z.infer<typeof qpayPersonMerchantSchema>;
export type QPayCompanyMerchantInput = z.infer<typeof qpayCompanyMerchantSchema>;
export type QPayMerchantInput = z.infer<typeof qpayMerchantInputSchema>;

/** UI-д харуулах default хаяг */
export const DEFAULT_CITY_CODE = CITY_CODES.ULAANBAATAR;
export const DEFAULT_DISTRICT_CODE = UB_DISTRICT_CODES.SUKHBAATAR;
