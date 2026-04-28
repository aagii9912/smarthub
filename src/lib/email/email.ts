/**
 * Email Service using Resend
 * Sends transactional emails for order updates
 */

import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'orders@smarthub.mn';

interface EmailParams {
    to: string;
    subject: string;
    html: string;
}

/**
 * Send email via Resend
 */
async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
    // Skip if no API key (development mode)
    if (!resend) {
        logger.warn('Resend not configured, email not sent:', { to, subject });
        return false;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject,
            html,
        });

        if (error) {
            logger.error('Email sending failed:', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }

        logger.success('Email sent successfully:', { to, subject, id: data?.id });
        return true;
    } catch (error: unknown) {
        logger.error('Email error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        return false;
    }
}

/**
 * Order Confirmation Email
 */
export async function sendOrderConfirmationEmail(params: {
    customerEmail: string;
    customerName: string;
    orderId: string;
    orderTotal: number;
    items: Array<{ name: string; quantity: number; price: number }>;
    shopName: string;
}): Promise<boolean> {
    const { customerEmail, customerName, orderId, orderTotal, items, shopName } = params;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .total { font-size: 18px; font-weight: bold; color: #4F46E5; text-align: right; margin-top: 15px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Захиалга баталгаажлаа!</h1>
        </div>
        <div class="content">
            <p>Сайн байна уу <strong>${customerName}</strong>,</p>
            <p>Таны захиалгыг амжилттай хүлээн авлаа. Баярлалаа!</p>
            
            <div class="order-details">
                <h3>Захиалгын дэлгэрэнгүй</strong></h3>
                <p><strong>Захиалгын дугаар:</strong> ${orderId.slice(0, 8)}</p>
                
                <div style="margin-top: 20px;">
                    ${items.map(item => `
                        <div class="item">
                            <span>${item.name} x${item.quantity}</span>
                            <span>${new Intl.NumberFormat('mn-MN').format(item.price * item.quantity)}₮</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="total">
                    Нийт: ${new Intl.NumberFormat('mn-MN').format(orderTotal)}₮
                </div>
            </div>
            
            <p>Бид таны захиалгыг боловсруулж, удахгүй холбогдох болно.</p>
            
            <div class="footer">
                <p>${shopName}</p>
                <p>Энэ имэйл нь Syncly системээс автоматаар илгээгдсэн</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Захиалга баталгаажлаа - ${shopName}`,
        html,
    });
}

/**
 * Payment Confirmation Email
 */
export async function sendPaymentConfirmationEmail(params: {
    customerEmail: string;
    customerName: string;
    orderId: string;
    amount: number;
    paymentMethod: string;
    shopName: string;
    invoiceUrl?: string;
}): Promise<boolean> {
    const { customerEmail, customerName, orderId, amount, paymentMethod, shopName, invoiceUrl } = params;

    const paymentLabels: Record<string, string> = {
        'qpay': 'QPay',
        'cash': 'Бэлэн мөнгө',
        'bank_transfer': 'Шилжүүлэг',
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .payment-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .amount { font-size: 28px; font-weight: bold; color: #10B981; margin: 15px 0; }
        .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Төлбөр баталгаажлаа!</h1>
        </div>
        <div class="content">
            <p>Сайн байна уу <strong>${customerName}</strong>,</p>
            <p>Таны төлбөрийг амжилттай хүлээн авлаа.</p>
            
            <div class="payment-box">
                <p><strong>Захиалгын дугаар:</strong> ${orderId.slice(0, 8)}</p>
                <div class="amount">${new Intl.NumberFormat('mn-MN').format(amount)}₮</div>
                <p>Төлбөрийн хэлбэр: ${paymentLabels[paymentMethod] || paymentMethod}</p>
                
                ${invoiceUrl ? `
                    <a href="${invoiceUrl}" class="button">Нэхэмжлэх харах</a>
                ` : ''}
            </div>
            
            <p>Таны захиалгыг бэлтгэж, хүргэлтэнд гаргах болно.</p>
            
            <div class="footer">
                <p>${shopName}</p>
                <p>Баярлалаа!</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Төлбөр баталгаажлаа - ${shopName}`,
        html,
    });
}

/**
 * Shipping Update Email
 */
export async function sendShippingUpdateEmail(params: {
    customerEmail: string;
    customerName: string;
    orderId: string;
    shopName: string;
    trackingNumber?: string;
}): Promise<boolean> {
    const { customerEmail, customerName, orderId, shopName, trackingNumber } = params;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #F59E0B; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Захиалга илгээгдлээ!</h1>
        </div>
        <div class="content">
            <p>Сайн байна уу <strong>${customerName}</strong>,</p>
            <p>Таны захиалга хүргэлтэнд гарлаа!</p>
            
            <div class="info-box">
                <p><strong>Захиалгын дугаар:</strong> ${orderId.slice(0, 8)}</p>
                ${trackingNumber ? `<p><strong>Tracking №:</strong> ${trackingNumber}</p>` : ''}
                <p>Бид тантай удахгүй холбогдох болно.</p>
            </div>
            
            <div class="footer">
                <p>${shopName}</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Захиалга илгээгдлээ - ${shopName}`,
        html,
    });
}

/**
 * Delivery Confirmation Email
 */
export async function sendDeliveryConfirmationEmail(params: {
    customerEmail: string;
    customerName: string;
    orderId: string;
    shopName: string;
}): Promise<boolean> {
    const { customerEmail, customerName, orderId, shopName } = params;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 15px; }
        .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✓ Захиалга хүргэгдлээ!</h1>
        </div>
        <div class="content">
            <p>Сайн байна уу <strong>${customerName}</strong>,</p>
            
            <div class="success-box">
                <div class="icon">🎉</div>
                <h2>Баярлалаа!</h2>
                <p>Таны захиалга амжилттай хүргэгдлээ.</p>
                <p><strong>Захиалгын дугаар:</strong> ${orderId.slice(0, 8)}</p>
            </div>
            
            <p>Бидэнтэй худалдан авалт хийсэнд баярлалаа. Дахин уулзацгаая!</p>
            
            <div class="footer">
                <p>${shopName}</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to: customerEmail,
        subject: `Захиалга хүргэгдлээ - ${shopName}`,
        html,
    });
}

/**
 * Weekly token usage report — per-feature breakdown.
 * Sent to shop owners every Monday so they understand WHAT consumed
 * their tokens (not just chat replies).
 */
export interface TokenReportFeatureRow {
    feature: string;
    label: string;
    tokens: number;
    calls: number;
}

export async function sendTokenUsageReport(params: {
    to: string;
    shopName: string;
    periodStart: string;
    periodEnd: string;
    totalTokens: number;
    totalCalls: number;
    rows: TokenReportFeatureRow[];
    unsubscribeUrl: string;
    dashboardUrl: string;
}): Promise<boolean> {
    const { to, shopName, periodStart, periodEnd, totalTokens, totalCalls, rows, unsubscribeUrl, dashboardUrl } = params;

    const fmt = (n: number) => new Intl.NumberFormat('mn-MN').format(n);
    const tableRows = rows
        .map((r) => {
            const pct = totalTokens > 0 ? ((r.tokens / totalTokens) * 100).toFixed(1) : '0.0';
            return `
                <tr>
                    <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;">${r.label}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;text-align:right;font-variant-numeric:tabular-nums;">${fmt(r.tokens)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;text-align:right;font-variant-numeric:tabular-nums;color:#6b7280;">${fmt(r.calls)}</td>
                    <td style="padding:10px 12px;border-bottom:1px solid #eef0f4;text-align:right;font-variant-numeric:tabular-nums;color:#6b7280;">${pct}%</td>
                </tr>
            `;
        })
        .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.55; color: #1f2937; background: #f3f4f6; margin: 0; padding: 0; }
        .container { max-width: 640px; margin: 0 auto; padding: 24px; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
        .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 28px 24px; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
        .body { padding: 24px; }
        .summary { display: flex; gap: 16px; margin-bottom: 20px; }
        .stat { flex: 1; background: #f9fafb; border-radius: 8px; padding: 14px; }
        .stat-label { font-size: 11px; color: #6b7280; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
        .stat-value { font-size: 22px; font-weight: 600; margin: 0; font-variant-numeric: tabular-nums; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 8px 12px; background: #f9fafb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; border-bottom: 1px solid #e5e7eb; }
        th.right { text-align: right; }
        .cta { display: inline-block; background: #4f46e5; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500; margin-top: 18px; }
        .footer { padding: 18px 24px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; }
        .footer a { color: #6b7280; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>📊 ${shopName} — Долоо хоногийн токен зарцуулалт</h1>
                <p>${periodStart} – ${periodEnd}</p>
            </div>
            <div class="body">
                <p style="margin:0 0 16px;font-size:14px;color:#4b5563;">
                    Та чат хариулахаас гадна доорх AI үйлчилгээнүүдээс <strong>бүгдээс</strong> токен зарцуулдаг. Хаанаас зарцуулагдсаныг харж, төлөвлөхөд тань туслах болно.
                </p>

                <div class="summary">
                    <div class="stat">
                        <p class="stat-label">Нийт токен</p>
                        <p class="stat-value">${fmt(totalTokens)}</p>
                    </div>
                    <div class="stat">
                        <p class="stat-label">AI дуудлага</p>
                        <p class="stat-value">${fmt(totalCalls)}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Үйлчилгээ</th>
                            <th class="right">Токен</th>
                            <th class="right">Дуудлага</th>
                            <th class="right">Хувь</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRows || '<tr><td colspan="4" style="padding:24px;text-align:center;color:#9ca3af;">Энэ долоо хоногт зарцуулалт байхгүй</td></tr>'}
                    </tbody>
                </table>

                <a href="${dashboardUrl}" class="cta">Дашбоарт харах →</a>
            </div>
            <div class="footer">
                Энэ имэйл нь Syncly-ээс автоматаар илгээгдсэн ·
                <a href="${unsubscribeUrl}">Захиалга цуцлах</a>
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail({
        to,
        subject: `${shopName} — Долоо хоногийн токен зарцуулалт (${fmt(totalTokens)} token)`,
        html,
    });
}
