/**
 * Delivery helpers — keep address-classification logic in one place so
 * checkout, AI prompt, and dashboard all agree on what counts as
 * "Ulaanbaatar" vs "outside UB".
 */

export type DeliveryRegion = 'ub' | 'province';

export interface DeliveryPolicy {
    free_delivery_threshold?: number | null;
    ub_delivery_fee?: number | null;
    province_delivery_fee?: number | null;
    province_delivery_note?: string | null;
    /** Хүргэлт гарах хугацааны тайлбар (бүх захиалгад үйлчилнэ). */
    delivery_schedule_note?: string | null;
}

const PROVINCE_KEYWORDS = [
    'аймаг', 'aimag',
    'сум', 'sum',
    'дархан', 'darkhan',
    'эрдэнэт', 'erdenet',
    'чойбалсан', 'choibalsan',
    'мөрөн', 'moron',
    'улаангом', 'ulaangom',
    'ховд', 'khovd', 'hovd',
    'баян-өлгий', 'bayan-olgii', 'олгий',
    'арвайхээр', 'arvaikheer',
    'налайх', // technically UB district but commonly noted separately for delivery
    'чойр', 'choir',
    'улиастай', 'uliastai',
    'алтай', 'altai',
    'багануур',
    'багахангай',
    'хэнтий', 'khentii',
    'дорнод', 'dornod',
    'сүхбаатар', 'sukhbaatar',
    'дундговь', 'dundgovi',
    'өмнөговь', 'umnugovi', 'umnugobi',
    'дорноговь', 'dornogovi',
    'төв аймаг', 'tov aimag',
    'сэлэнгэ', 'selenge',
    'булган', 'bulgan',
    'орхон', 'orkhon',
    'архангай', 'arkhangai',
    'өвөрхангай', 'uvurkhangai', 'overhangai',
    'баянхонгор', 'bayanhongor',
    'говь-алтай', 'govi-altai',
    'завхан', 'zavkhan',
    'хөвсгөл', 'khuvsgul', 'huvsgul',
];

const UB_KEYWORDS = [
    'улаанбаатар', 'ulaanbaatar', 'ub',
    'хороо', 'khoroo',
    'бзд', 'сбд', 'худ', 'бгд', 'схд', 'чд', 'бнд', 'нд', 'бз',
    'baganuur', 'багануур',
];

/**
 * Classify a free-text Mongolian delivery address as inside or outside
 * Ulaanbaatar. The check is keyword-based and biased toward "ub" when
 * ambiguous (so the cheaper fee is the default for unknown addresses).
 */
export function classifyDeliveryAddress(address: string | null | undefined): DeliveryRegion {
    if (!address) return 'ub';
    const a = address.toLowerCase();

    for (const kw of PROVINCE_KEYWORDS) {
        if (a.includes(kw)) return 'province';
    }
    for (const kw of UB_KEYWORDS) {
        if (a.includes(kw)) return 'ub';
    }
    return 'ub';
}

export interface ResolvedDeliveryFee {
    fee: number;
    region: DeliveryRegion;
    free: boolean;
    note: string | null;
}

/**
 * Apply a shop's delivery_policy to a single order:
 *   1. Region (UB vs province) is detected from `address`.
 *   2. Base fee comes from policy.ub_delivery_fee / province_delivery_fee.
 *   3. If `free_delivery_threshold` is set and `cartSubtotal` ≥ that
 *      threshold, the fee is waived to 0 and `free=true`.
 *
 * `cartSubtotal` is the order total *before* delivery is added.
 */
export function resolveDeliveryFee(
    policy: DeliveryPolicy | null | undefined,
    address: string | null | undefined,
    cartSubtotal: number,
): ResolvedDeliveryFee {
    const region = classifyDeliveryAddress(address);
    const baseFee =
        region === 'province'
            ? Number(policy?.province_delivery_fee ?? 0) || 0
            : Number(policy?.ub_delivery_fee ?? 0) || 0;
    const threshold = policy?.free_delivery_threshold;
    const thresholdNum = threshold == null ? null : Number(threshold);
    const free = thresholdNum !== null && Number.isFinite(thresholdNum) && cartSubtotal >= thresholdNum;

    return {
        fee: free ? 0 : baseFee,
        region,
        free,
        note: region === 'province' ? policy?.province_delivery_note ?? null : null,
    };
}
