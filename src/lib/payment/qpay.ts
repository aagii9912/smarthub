/**
 * QPay Quick Pay v2 API Client
 * API: https://quickqr.qpay.mn/v2
 * Documentation: https://documenter.getpostman.com/view/1550773/2s8YekSaaV
 * 
 * Features:
 * - Basic Auth → Bearer Token authentication
 * - Invoice creation with QR codes + bank deeplinks
 * - Payment status checking
 * - Webhook validation
 * - Multi-merchant support (platform + shop-level)
 */

import { logger } from '@/lib/utils/logger';
import { qpayBreaker } from '@/lib/ai/resilience/circuitBreaker';
import crypto from 'crypto';

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

const QPAY_BASE_URL = process.env.QPAY_BASE_URL || 'https://quickqr.qpay.mn';
const QPAY_USERNAME = process.env.QPAY_USERNAME;
const QPAY_PASSWORD = process.env.QPAY_PASSWORD;
const QPAY_TERMINAL_ID = process.env.QPAY_TERMINAL_ID;

// Syncly's own merchant (for subscription payments)
const SYNCLY_MERCHANT_ID = process.env.QPAY_MERCHANT_ID;
const SYNCLY_BANK_CODE = process.env.QPAY_BANK_CODE || '040000';
const SYNCLY_ACCOUNT_NUMBER = process.env.QPAY_ACCOUNT_NUMBER;
const SYNCLY_ACCOUNT_NAME = process.env.QPAY_ACCOUNT_NAME || 'Syncly';
const QPAY_CALLBACK_URL = process.env.QPAY_CALLBACK_URL || 'https://syncly.mn/api/payment/webhook';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface QPayTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
    scope: string;
    session_state: string;
}

interface QPayBankAccount {
    account_bank_code: string;
    account_number: string;
    account_name: string;
    is_default: boolean;
}

// Raw API response (actual field names from Quick Pay v2)
interface QPayInvoiceRaw {
    id: string;
    qr_code: string;
    qr_image: string;
    urls: QPayBankUrl[];
    enable_expiry?: boolean;
    expiry_date?: string;
    invoice_status?: string;
    amount?: string;
}

// Normalized invoice (used throughout the app)
export interface QPayInvoice {
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls: QPayBankUrl[];
    enable_expiry?: boolean;
    expiry_date?: string;
}

export interface QPayBankUrl {
    name: string;
    description: string;
    logo: string;
    link: string;
}

// Raw payment check response (Quick Pay v2)
export interface QPayPaymentCheck {
    id: string;
    invoice_status: string;  // 'OPEN' | 'PAID' | 'CLOSED'
    invoice_status_date?: string;
    // Legacy fields (may or may not be present)
    count?: number;
    paid_amount?: number;
    rows?: Array<{
        payment_id: string;
        payment_status: string;
        payment_amount: number;
        payment_currency: string;
        payment_wallet: string;
        payment_date: string;
    }>;
}

/** Map raw API response to normalized QPayInvoice */
function mapInvoiceResponse(raw: QPayInvoiceRaw): QPayInvoice {
    return {
        invoice_id: raw.id,
        qr_text: raw.qr_code,
        qr_image: raw.qr_image,
        urls: raw.urls || [],
        enable_expiry: raw.enable_expiry,
        expiry_date: raw.expiry_date,
    };
}

export interface CreateInvoiceParams {
    merchantId: string;
    amount: number;
    description: string;
    callbackUrl?: string;
    bankAccounts: QPayBankAccount[];
    currency?: string;
    customerName?: string;
}

// ──────────────────────────────────────────────
// Token Management (in-memory cache)
// ──────────────────────────────────────────────

let cachedToken: { token: string; refreshToken: string; expiresAt: number } | null = null;

/**
 * Get QPay access token via Basic Auth
 * Uses terminal_id in request body
 */
async function getAccessToken(): Promise<string> {
    if (!QPAY_USERNAME || !QPAY_PASSWORD) {
        logger.warn('QPay credentials not configured, using mock mode');
        return 'mock_token';
    }

    // Return cached token if still valid (with 60s buffer)
    if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
        return cachedToken.token;
    }

    try {
        logger.info('Fetching new QPay access token');

        const credentials = Buffer.from(`${QPAY_USERNAME}:${QPAY_PASSWORD}`).toString('base64');

        const response = await fetch(`${QPAY_BASE_URL}/v2/auth/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ terminal_id: QPAY_TERMINAL_ID }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`QPay auth failed: ${response.status} - ${errorText}`);
        }

        const data: QPayTokenResponse = await response.json();

        cachedToken = {
            token: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };

        logger.success('QPay access token obtained');
        return data.access_token;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get QPay access token', { error: msg });
        throw error;
    }
}

/**
 * Refresh QPay token using refresh_token
 */
async function refreshAccessToken(): Promise<string> {
    if (!cachedToken?.refreshToken) {
        return getAccessToken();
    }

    try {
        const response = await fetch(`${QPAY_BASE_URL}/v2/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cachedToken.refreshToken}`,
                'Content-Type': 'application/json',
            },
            body: '{}',
        });

        if (!response.ok) {
            // Fallback to full re-auth
            cachedToken = null;
            return getAccessToken();
        }

        const data: QPayTokenResponse = await response.json();

        cachedToken = {
            token: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
        };

        return data.access_token;
    } catch {
        cachedToken = null;
        return getAccessToken();
    }
}

// ──────────────────────────────────────────────
// Invoice Operations
// ──────────────────────────────────────────────

/**
 * Create QPay invoice (generic — works for both platform and shop merchants)
 */
export async function createQPayInvoice(params: CreateInvoiceParams): Promise<QPayInvoice | null> {
    // Circuit breaker check
    if (!qpayBreaker.isAllowed()) {
        logger.warn('QPay circuit breaker OPEN — skipping invoice creation');
        return null;
    }

    // Mock mode
    if (!QPAY_USERNAME || !QPAY_PASSWORD) {
        logger.warn('QPay in mock mode');
        return {
            invoice_id: `MOCK_INV_${Date.now()}`,
            qr_text: `MOCK_QPAY_${Date.now()}`,
            qr_image: '',
            urls: [],
        };
    }

    try {
        const token = await getAccessToken();

        const body = {
            merchant_id: params.merchantId,
            amount: params.amount,
            currency: params.currency || 'MNT',
            customer_name: params.customerName || '',
            callback_url: params.callbackUrl || QPAY_CALLBACK_URL,
            description: params.description,
            bank_accounts: params.bankAccounts,
        };

        logger.info('Creating QPay invoice:', { merchantId: params.merchantId, amount: params.amount });

        const response = await fetch(`${QPAY_BASE_URL}/v2/invoice`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`QPay invoice creation failed: ${response.status} - ${errorText}`);
        }

        const raw: QPayInvoiceRaw = await response.json();
        const invoice = mapInvoiceResponse(raw);

        qpayBreaker.recordSuccess();
        logger.success('QPay invoice created:', { invoice_id: invoice.invoice_id });
        return invoice;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        qpayBreaker.recordFailure(error instanceof Error ? error : msg);
        logger.error('Failed to create QPay invoice', { error: msg });
        return null;
    }
}

/**
 * Create invoice for Syncly subscription payment
 * Uses Syncly's own merchant account
 */
export async function createSubscriptionInvoice(params: {
    planSlug: string;
    amount: number;
    userId: string;
    description?: string;
    callbackUrl?: string;
}): Promise<QPayInvoice | null> {
    if (!SYNCLY_MERCHANT_ID || !SYNCLY_ACCOUNT_NUMBER) {
        logger.error('Syncly QPay merchant not configured');
        return null;
    }

    return createQPayInvoice({
        merchantId: SYNCLY_MERCHANT_ID,
        amount: params.amount,
        description: params.description || `Syncly ${params.planSlug} plan`,
        callbackUrl: params.callbackUrl || `${QPAY_CALLBACK_URL}?type=subscription&user=${params.userId}&plan=${params.planSlug}`,
        customerName: 'Syncly',
        bankAccounts: [{
            account_bank_code: SYNCLY_BANK_CODE,
            account_number: SYNCLY_ACCOUNT_NUMBER,
            account_name: SYNCLY_ACCOUNT_NAME,
            is_default: true,
        }],
    });
}

/**
 * Create invoice for a shop's order payment
 * Uses the shop's own QPay merchant account
 */
export async function createShopOrderInvoice(params: {
    shopMerchantId: string;
    shopBankCode: string;
    shopAccountNumber: string;
    shopAccountName: string;
    orderId: string;
    amount: number;
    shopName: string;
    callbackUrl?: string;
}): Promise<QPayInvoice | null> {
    return createQPayInvoice({
        merchantId: params.shopMerchantId,
        amount: params.amount,
        description: `${params.shopName} - Order ${params.orderId.slice(0, 8)}`,
        callbackUrl: params.callbackUrl || `${QPAY_CALLBACK_URL}?type=order&order=${params.orderId}`,
        customerName: params.shopName,
        bankAccounts: [{
            account_bank_code: params.shopBankCode,
            account_number: params.shopAccountNumber,
            account_name: params.shopAccountName,
            is_default: true,
        }],
    });
}

/**
 * Get invoice details
 */
export async function getInvoice(invoiceId: string): Promise<QPayInvoice | null> {
    try {
        const token = await getAccessToken();

        const response = await fetch(`${QPAY_BASE_URL}/v2/invoice/${invoiceId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

/**
 * Cancel an invoice
 */
export async function cancelInvoice(invoiceId: string): Promise<boolean> {
    try {
        const token = await getAccessToken();

        const response = await fetch(`${QPAY_BASE_URL}/v2/invoice/${invoiceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        return response.ok;
    } catch {
        return false;
    }
}

// ──────────────────────────────────────────────
// Payment Operations
// ──────────────────────────────────────────────

/**
 * Check payment status for an invoice
 */
export async function checkPaymentStatus(invoiceId: string): Promise<QPayPaymentCheck> {
    // Circuit breaker check
    if (!qpayBreaker.isAllowed()) {
        logger.warn('QPay circuit breaker OPEN — skipping payment check');
        throw new Error('QPay түр ажиллахгүй байна');
    }

    // Mock mode
    if (!QPAY_USERNAME || !QPAY_PASSWORD) {
        return { id: 'mock', invoice_status: 'OPEN' };
    }

    try {
        const token = await getAccessToken();

        const response = await fetch(`${QPAY_BASE_URL}/v2/payment/check`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ invoice_id: invoiceId }),
        });

        if (!response.ok) {
            throw new Error(`QPay check failed: ${response.status}`);
        }

        const result: QPayPaymentCheck = await response.json();

        qpayBreaker.recordSuccess();
        logger.info('QPay payment check:', { invoiceId, status: result.invoice_status });

        return result;
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        qpayBreaker.recordFailure(error instanceof Error ? error : msg);
        logger.error('Failed to check QPay payment', { error: msg });
        throw error;
    }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/**
 * Validate QPay webhook signature (HMAC-SHA256) using constant-time comparison.
 */
export function validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
): boolean {
    try {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length) return false;
        return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
        return false;
    }
}

/** Check if payment is completed (Quick Pay v2: uses invoice_status) */
export function isPaymentCompleted(checkResult: QPayPaymentCheck): boolean {
    // Quick Pay v2 returns invoice_status: 'PAID'
    if (checkResult.invoice_status === 'PAID') return true;
    // Legacy fallback
    if (checkResult.count && checkResult.count > 0 && checkResult.paid_amount && checkResult.paid_amount > 0) return true;
    return false;
}

/** Get transaction ID from payment check result */
export function getTransactionId(checkResult: QPayPaymentCheck): string | null {
    // Quick Pay v2: the id itself is the transaction reference
    if (checkResult.invoice_status === 'PAID') return checkResult.id;
    // Legacy fallback
    return checkResult.rows?.[0]?.payment_id ?? null;
}

/** Force clear cached token (useful for testing) */
export function clearTokenCache(): void {
    cachedToken = null;
}

/** Export for use by qpay-merchant.ts */
export { getAccessToken, QPAY_BASE_URL };
