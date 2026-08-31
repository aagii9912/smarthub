/**
 * Mongolian phone-number helpers.
 *
 * Shoppers on FB/IG comments leave their number inline ("авна 9911 2233",
 * "99112233 хаягаа явуул", "+976 8800-1122"). Comment automations need to pull
 * that number out of free text to build the lead report, so this extractor is
 * deliberately tolerant of separators and an optional +976 country code while
 * still avoiding false hits on prices/IDs.
 */

// Mongolian subscriber numbers are 8 digits. Mobile/most-quoted ranges start
// 6-9, which also keeps us from matching 8-digit prices like "12000000".
// Allows an optional +976 / 976 prefix and spaces/dots/dashes between digits.
// Lookbehind/lookahead `(?<!\d)`/`(?!\d)` stop us slicing 8 digits out of a
// longer run (order ids, concatenated numbers).
//
// Separators are only accepted in the groupings people actually write phone
// numbers in — 8 bare digits, 4+4, 4+2+2 or 2+2+2+2. This is what keeps a
// Mongolian apartment price out of the lead report: "85 000 000" / "85.000.000"
// is a 2+3+3 grouping, which no phone alternative matches. A permissive
// "separator between any two digits" rule turned every price comment under a
// үл хөдлөх post into a fake lead.
const MN_PHONE_RE =
    /(?<!\d)(?:\+?976[\s.\-]?)?([6-9]\d{7}|[6-9]\d{3}[\s.\-]\d{4}|[6-9]\d{3}(?:[\s.\-]\d{2}){2}|[6-9]\d(?:[\s.\-]\d{2}){3})(?!\d)/g;

// A bare 8-digit run is ambiguous: "78000000" is both a valid-looking number and
// "78 сая". These two guards resolve it in favour of "price".
/** Price marker sitting immediately in front of the number ("Үнэ 78000000"). */
const MONEY_BEFORE_RE = /(?:үн[эийг]+|төсөв|зээл)\s*[:\-]?\s*$/i;
/** Currency marker sitting immediately after it ("78000000₮", "78000000 сая"). */
const MONEY_AFTER_RE = /^\s*(?:₮|төгрөг|төг\b|сая|мянга)/i;

/**
 * Extract the first plausible 8-digit Mongolian phone number from free text.
 * Returns the bare 8 digits (e.g. "99112233") to match how `customers.phone`
 * is stored elsewhere, or `null` when no number is present.
 */
export function extractMongolianPhone(text: string | null | undefined): string | null {
    if (!text) return null;

    for (const match of text.matchAll(MN_PHONE_RE)) {
        const digits = match[1].replace(/\D/g, '');
        if (digits.length !== 8) continue;

        const start = match.index ?? 0;
        const before = text.slice(Math.max(0, start - 24), start);
        const after = text.slice(start + match[0].length, start + match[0].length + 12);

        // "Үнэ 78000000" / "78000000₮" — a price, not a number to call.
        if (MONEY_BEFORE_RE.test(before) || MONEY_AFTER_RE.test(after)) continue;

        // Round millions ("78000000", "85000000") are prices. A real subscriber
        // number ending in five zeros is a vanity number and vanishingly rare —
        // we trade that edge case for not handing brokers numbers that don't ring.
        if (/0{5,}$/.test(digits)) continue;

        return digits;
    }

    return null;
}

/**
 * The literal strings an 8-digit Mongolian number is plausibly stored as, for an
 * indexable equality lookup (`.in('phone', ...)`).
 *
 * Matching a stored phone with `LIKE '%99112233'` cannot use an index — the
 * leading wildcard forces a sequential scan — and it is also *wrong*: a number
 * saved as "976-9911-2233" does not end in the bare digits. This covers the
 * shapes the app actually writes (`extractMongolianPhone` and
 * `collect_contact_info` both store bare digits) plus the usual country-code
 * variants, and stays index-friendly on `(shop_id, phone)`.
 *
 * Deliberately NOT exhaustive: a miss creates a second lead row rather than
 * silently merging two different people, which is the safer failure.
 */
export function phoneLookupVariants(phone8: string): string[] {
    const d = phone8.replace(/\D/g, '').slice(-8);
    if (d.length !== 8) return [];
    const grouped = `${d.slice(0, 4)} ${d.slice(4)}`;
    const dashed = `${d.slice(0, 4)}-${d.slice(4)}`;
    return [
        d,
        grouped,
        dashed,
        `+976${d}`,
        `+976 ${d}`,
        `976${d}`,
        `976-${d}`,
        `+976 ${grouped}`,
        `+976-${dashed}`,
    ];
}

/**
 * Normalise any stored phone to its last 8 digits for comparison. Lets us match
 * a comment's extracted number against an order/customer phone regardless of
 * whether it was saved bare, with +976, or with separators. Returns `null` when
 * fewer than 8 digits are present.
 */
export function phoneMatchKey(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    return digits.slice(-8);
}
