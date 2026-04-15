/**
 * QPay Merchant Manager
 * Handles automatic registration of Syncly shops as QPay merchants
 * 
 * Each shop gets its own QPay merchant_id so their customers
 * pay directly to the shop's bank account.
 */

import { getAccessToken, QPAY_BASE_URL } from './qpay';
import { logger } from '@/lib/utils/logger';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MerchantRegistration {
    register_number: string;     // Company register number
    company_name: string;        // Company name
    name: string;                // Display name
    mcc_code: string;            // Merchant Category Code
    city: string;                // City code (e.g. '11000' = UB)
    district: string;            // District code (e.g. '14000' = Sukhbaatar)
    address: string;
    phone: string;
    email: string;
    bank_accounts?: BankAccount[];
}

export interface BankAccount {
    account_bank_code: string;
    account_number: string;
    account_name: string;
    is_default: boolean;
}

export interface QPayMerchant {
    id: string;                   // merchant UUID
    vendor_id: string;
    type: string;
    register_number: string;
    name: string;
    company_name: string;
    mcc_code: string;
    city: string;
    district: string;
    address: string;
    phone: string;
    email: string;
    p2p_terminal_id: string;
    card_terminal_id: string;
}

// Well-known city codes
export const CITY_CODES = {
    ULAANBAATAR: '11000',
    DARKHAN: '45000',
    ERDENET: '61000',
} as const;

// Well-known district codes (Ulaanbaatar)
export const UB_DISTRICT_CODES = {
    BAGANUUR: '12000',
    BAGAKHANGAI: '12300',
    NALAIKH: '12600',
    BAYANZURKH: '13000',
    SUKHBAATAR: '14000',
    CHINGELTEI: '15000',
    BAYANGOL: '16000',
    KHAN_UUL: '17000',
    SONGINO_KHAIRKHAN: '18000',
} as const;

// Well-known bank codes
export const BANK_CODES = {
    MONGOL_BANK: '010000',
    CAPITAL_BANK: '020000',
    TDB: '040000',
    KHAN_BANK: '050000',
    GOLOMT: '150000',
    CAPITRON: '300000',
    XAC_BANK: '320000',
    STATE_BANK: '340000',
    BOGD_BANK: '380000',
    M_BANK: '390000',
} as const;

// Default MCC code for SaaS/software services
const DEFAULT_MCC_CODE = '7372';

// ──────────────────────────────────────────────
// Merchant Registration
// ──────────────────────────────────────────────

/**
 * Register a shop as a QPay merchant (company or person)
 * Returns the QPay merchant_id
 */
export async function registerShopAsMerchant(params: {
    shopName: string;
    merchantType?: 'company' | 'person';
    registerNumber?: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    phone?: string;
    email?: string;
    mccCode?: string;
    city?: string;
    district?: string;
    address?: string;
}): Promise<QPayMerchant> {
    const token = await getAccessToken();
    const isCompany = params.merchantType === 'company';
    const endpoint = isCompany ? '/v2/merchant/company' : '/v2/merchant/person';

    const body: Record<string, unknown> = {
        name: params.shopName,
        mcc_code: params.mccCode || DEFAULT_MCC_CODE,
        city: params.city || CITY_CODES.ULAANBAATAR,
        district: params.district || UB_DISTRICT_CODES.SUKHBAATAR,
        address: params.address || 'Ulaanbaatar',
        phone: params.phone || '',
        email: params.email || '',
        bank_accounts: [{
            account_bank_code: params.bankCode,
            account_number: params.accountNumber,
            account_name: params.accountName,
            is_default: true,
        }],
    };

    if (isCompany) {
        body.company_name = params.shopName;
        if (params.registerNumber) {
            body.register_number = params.registerNumber;
        }
    } else {
        // Person merchant: use accountName as last/first name
        body.business_name = params.shopName;
        const nameParts = params.accountName.split(' ');
        body.last_name = nameParts[0] || params.accountName;
        body.first_name = nameParts[1] || params.accountName;
        if (params.registerNumber) {
            body.register_number = params.registerNumber;
        }
    }

    logger.info(`Registering shop as QPay merchant (${params.merchantType || 'person'}):`, { shopName: params.shopName });

    const response = await fetch(`${QPAY_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorText = await response.text();
        logger.error('QPay merchant registration failed:', { error: errorText });
        throw new Error(`QPay merchant registration failed: ${response.status} - ${errorText}`);
    }

    const merchant: QPayMerchant = await response.json();
    logger.success('QPay merchant registered:', { merchant_id: merchant.id, name: merchant.name });

    return merchant;
}

/**
 * Update an existing QPay merchant
 */
export async function updateMerchant(
    merchantId: string,
    updates: Partial<MerchantRegistration>
): Promise<QPayMerchant> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/merchant/company/${merchantId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`QPay merchant update failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Get merchant details
 */
export async function getMerchant(merchantId: string): Promise<QPayMerchant | null> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/merchant/${merchantId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) return null;
    return await response.json();
}

/**
 * Remove a QPay merchant
 */
export async function removeMerchant(merchantId: string): Promise<boolean> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/merchant/${merchantId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    return response.ok;
}

/**
 * List all registered merchants
 */
export async function listMerchants(page = 1, limit = 50): Promise<{ count: number; rows: QPayMerchant[] }> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/merchant/list`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            offset: { page_number: page, page_limit: limit },
        }),
    });

    if (!response.ok) {
        throw new Error(`QPay merchant list failed: ${response.status}`);
    }

    return await response.json();
}

/**
 * Get city/province codes from QPay
 */
export async function getCityCodes(): Promise<Array<{ code: string; name: string }>> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/aimaghot`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) return [];
    return await response.json();
}

/**
 * Get district codes for a city
 */
export async function getDistrictCodes(cityCode: string): Promise<Array<{ code: string; name: string }>> {
    const token = await getAccessToken();

    const response = await fetch(`${QPAY_BASE_URL}/v2/sumduureg/${cityCode}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) return [];
    return await response.json();
}
