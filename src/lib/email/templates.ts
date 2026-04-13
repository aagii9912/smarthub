/**
 * Email Templates - Specialized templates for various notifications
 * Uses the core email service from @/lib/email/email.ts
 */

import { Resend } from 'resend';
import { logger } from '@/lib/utils/logger';

const resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

const FROM_EMAIL = process.env.EMAIL_FROM || 'alerts@smarthub.mn';

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!resend) {
        logger.warn('Resend not configured, email skipped:', { to, subject });
        return false;
    }

    try {
        const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [to],
            subject,
            html,
        });
        if (error) {
            logger.error('Email send error:', { error });
            return false;
        }
        return true;
    } catch (err) {
        logger.error('Email error:', { error: err instanceof Error ? err.message : String(err) });
        return false;
    }
}

/**
 * Send support request email to shop owner
 */
export async function sendSupportRequestEmail(params: {
    to: string;
    shopName: string;
    customerName: string;
    reason: string;
    dashboardUrl: string;
}): Promise<boolean> {
    const { to, shopName, customerName, reason, dashboardUrl } = params;

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4f5f7; }
        .container { max-width: 560px; margin: 30px auto; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 24px 28px; }
        .header h1 { margin: 0; font-size: 18px; font-weight: 600; }
        .header p { margin: 6px 0 0; opacity: 0.9; font-size: 13px; }
        .content { padding: 28px; }
        .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .info-label { color: #6b7280; font-size: 13px; width: 120px; flex-shrink: 0; }
        .info-value { font-size: 14px; font-weight: 500; }
        .reason-box { background: #FEF2F2; border-left: 3px solid #EF4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 18px 0; }
        .reason-box p { margin: 0; font-size: 14px; color: #991B1B; }
        .button { display: inline-block; background: #4F46E5; color: white !important; padding: 11px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-top: 8px; }
        .footer { text-align: center; padding: 16px 28px; color: #9ca3af; font-size: 11px; border-top: 1px solid #f0f0f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>🔴 Хүн холбогдох хүсэлт!</h1>
                <p>${shopName} — ${new Date().toLocaleString('mn-MN')}</p>
            </div>
            <div class="content">
                <div class="info-row">
                    <span class="info-label">Хэрэглэгч:</span>
                    <span class="info-value">${customerName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Цаг:</span>
                    <span class="info-value">${new Date().toLocaleString('mn-MN')}</span>
                </div>
                
                <div class="reason-box">
                    <p><strong>Шалтгаан:</strong> ${reason}</p>
                </div>
                
                <p style="color: #4b5563; font-size: 14px;">Хэрэглэгч AI-тай ярилцаад хүн холбогдох хүсэлт илгээлээ. Аль болох хурдан хариулна уу.</p>
                
                <a href="${dashboardUrl}" class="button">Dashboard-д харах →</a>
            </div>
            <div class="footer">
                Энэ мэдэгдэл Syncly AI системээс автоматаар илгээгдсэн
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail(to, `🔴 Хүн холбогдох хүсэлт — ${shopName}`, html);
}

/**
 * Send low stock alert email to shop owner
 */
export async function sendLowStockEmail(params: {
    to: string;
    shopName: string;
    products: Array<{ name: string; stock: number }>;
}): Promise<boolean> {
    const { to, shopName, products } = params;

    const productRows = products.map(p => `
        <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f0f0f0; font-size: 14px;">${p.name}</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #f0f0f0; font-size: 14px; text-align: center;">
                <span style="background: ${p.stock === 0 ? '#FEE2E2' : '#FEF3C7'}; color: ${p.stock === 0 ? '#991B1B' : '#92400E'}; padding: 3px 10px; border-radius: 12px; font-weight: 600; font-size: 12px;">
                    ${p.stock === 0 ? 'Дууссан' : `${p.stock} ширхэг`}
                </span>
            </td>
        </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; background: #f4f5f7; }
        .container { max-width: 560px; margin: 30px auto; }
        .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .header { background: linear-gradient(135deg, #F59E0B, #D97706); color: white; padding: 24px 28px; }
        .header h1 { margin: 0; font-size: 18px; font-weight: 600; }
        .content { padding: 28px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 10px 14px; color: #6b7280; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
        .footer { text-align: center; padding: 16px 28px; color: #9ca3af; font-size: 11px; border-top: 1px solid #f0f0f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <h1>⚠️ Нөөц бага байна</h1>
            </div>
            <div class="content">
                <p style="color: #4b5563; font-size: 14px;">${shopName} — дараах бараанууд нөөц бага буюу дууссан байна:</p>
                <table>
                    <thead>
                        <tr>
                            <th>Бараа</th>
                            <th style="text-align: center;">Үлдэгдэл</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows}
                    </tbody>
                </table>
            </div>
            <div class="footer">
                Syncly AI — Нөөц шалгалт
            </div>
        </div>
    </div>
</body>
</html>
    `;

    return sendEmail(to, `⚠️ ${products.length} бараа нөөц бага — ${shopName}`, html);
}
