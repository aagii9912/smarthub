/**
 * Худалдааны бизнесийн automation-ууд (commerce archetype):
 * retail, ecommerce, restaurant, other.
 *
 *   payment_reminder      — QPay төлөөгүй захиалгад цуцлагдахаас өмнө сануулга (auto)
 *   abandoned_cart        — сагсандаа бараа орхисон үйлчлүүлэгчид дагалт (approve)
 *   daily_sales_summary   — өглөөний борлуулалтын тойм эзэнд (push)
 *
 * Хугацааны тааруулалт: QPay нэхэмжлэл ~15 минутад дуусч, `pending` захиалгыг
 * cleanup-orders cron 30 минутад цуцалдаг. Тиймээс сануулга 8–14 минутын
 * хооронд явна — линк хүчинтэй, захиалга хараахан цуцлагдаагүй.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { deliver } from '../deliver';
import { ubDayStart } from '../time';
import type { AutomationDef } from '../types';
import { DAY, HOUR, MINUTE, dailyShopSubject, one, outcomeFromDelivery, summaryHourField } from './shared';
import { pushOwnerReport } from './report';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.syncly.mn';

// ── Төлбөрийн сануулга ──────────────────────────────────────────────

export function buildPaymentReminderText(params: { orderRef: string; amount: number; payUrl: string }): string {
    return `⏳ Таны #${params.orderRef} захиалгын ${params.amount.toLocaleString()}₮ төлбөр хүлээгдэж байна.\nТөлөөгүй бол захиалга удахгүй автоматаар цуцлагдана.\n\n💳 Төлөх: ${params.payUrl}`;
}

export const paymentReminder: AutomationDef = {
    key: 'payment_reminder',
    label: 'Төлбөрийн сануулга',
    description: 'QPay-ээр төлөөгүй захиалгад цуцлагдахаас өмнө (≈10 мин) төлбөрийн линкээ дахин илгээнэ.',
    kind: 'customer_message',
    defaultMode: 'auto',
    defaultEnabled: true,
    usesLLM: false,

    async select(ctx) {
        const now = ctx.now.getTime();
        const { data, error } = await supabaseAdmin()
            .from('payments')
            .select('id, order_id')
            .eq('shop_id', ctx.shopId)
            .eq('status', 'pending')
            .eq('payment_method', 'qpay')
            .not('order_id', 'is', null)
            .gte('created_at', new Date(now - 14 * MINUTE).toISOString())
            .lte('created_at', new Date(now - 8 * MINUTE).toISOString())
            .limit(200);
        if (error) throw new Error(error.message);

        return (data ?? []).map((p) => ({
            subjectType: 'order',
            subjectId: p.order_id as string,
            windowKey: p.id as string,
            payload: { payment_id: p.id },
        }));
    },

    async execute(ctx, run) {
        const db = supabaseAdmin();
        const paymentId = String(run.payload.payment_id ?? '');
        const [{ data: order }, { data: payment }] = await Promise.all([
            db
                .from('orders')
                .select('id, status, customer_id')
                .eq('id', run.subject_id ?? '')
                .eq('shop_id', ctx.shopId)
                .maybeSingle(),
            db.from('payments').select('id, status, amount').eq('id', paymentId).eq('shop_id', ctx.shopId).maybeSingle(),
        ]);

        if (!order?.customer_id) return { status: 'skipped', result: { reason: 'no_customer' } };
        if (order.status !== 'pending') return { status: 'skipped', result: { reason: `order_${order.status}` } };
        if (payment?.status !== 'pending') return { status: 'skipped', result: { reason: 'already_paid' } };

        const delivery = await deliver({
            shopId: ctx.shopId,
            customerId: order.customer_id as string,
            operation: run.agent_slug,
            text: buildPaymentReminderText({
                orderRef: String(order.id).substring(0, 8),
                amount: Number(payment.amount ?? 0),
                payUrl: `${SITE_URL}/pay/${payment.id}`,
            }),
        });
        // Богино хугацааны мессеж — хүрэхгүй бол эзэнд даалгавар үүсгэхгүй.
        return outcomeFromDelivery(delivery);
    },
};

// ── Орхигдсон сагс ──────────────────────────────────────────────────

export function buildCartNudgeText(itemNames: string[]): string {
    const shown = itemNames.slice(0, 3).join(', ');
    const more = itemNames.length > 3 ? ` болон өөр ${itemNames.length - 3}` : '';
    return `🛒 Таны сагсанд ${shown}${more} үлдсэн байна. Захиалгаа баталгаажуулах уу? "Тийм" гэж бичээд л болно 🙂`;
}

export const abandonedCart: AutomationDef = {
    key: 'abandoned_cart',
    label: 'Орхигдсон сагсны дагалт',
    description: 'Сагсандаа бараа нэмээд 2–6 цаг захиалаагүй үйлчлүүлэгчид нэг удаа сануулна.',
    kind: 'customer_message',
    defaultMode: 'approve',
    defaultEnabled: false,
    usesLLM: false,

    async select(ctx) {
        const now = ctx.now.getTime();
        const { data, error } = await supabaseAdmin()
            .from('carts')
            .select('id, updated_at, customer_id, cart_items(id)')
            .eq('shop_id', ctx.shopId)
            .eq('status', 'active')
            .not('customer_id', 'is', null)
            .gte('updated_at', new Date(now - 6 * HOUR).toISOString())
            .lte('updated_at', new Date(now - 2 * HOUR).toISOString())
            .limit(100);
        if (error) throw new Error(error.message);

        return (data ?? [])
            .filter((c) => Array.isArray(c.cart_items) && c.cart_items.length > 0)
            .map((c) => ({
                subjectType: 'cart',
                subjectId: c.id as string,
                // Сагс өөрчлөгдвөл (шинэ updated_at) дахин сануулах боломжтой.
                windowKey: new Date(c.updated_at as string).toISOString(),
            }));
    },

    async prepare(ctx, run) {
        const items = await loadCartItemNames(ctx.shopId, run.subject_id ?? '');
        return { draft: items.length > 0 ? buildCartNudgeText(items) : null };
    },

    async execute(ctx, run) {
        const { data: cart } = await supabaseAdmin()
            .from('carts')
            .select('id, status, customer_id')
            .eq('id', run.subject_id ?? '')
            .eq('shop_id', ctx.shopId)
            .maybeSingle();
        if (!cart?.customer_id || cart.status !== 'active') {
            return { status: 'skipped', result: { reason: 'cart_closed' } };
        }

        const draft = typeof run.payload.draft === 'string' ? run.payload.draft : null;
        const items = draft ? [] : await loadCartItemNames(ctx.shopId, cart.id as string);
        const text = draft ?? (items.length > 0 ? buildCartNudgeText(items) : null);
        if (!text) return { status: 'skipped', result: { reason: 'cart_empty' } };

        // Урамшууллын шинжтэй тул Utility template-гүй — зөвхөн 24ц цонх дотор.
        const delivery = await deliver({
            shopId: ctx.shopId,
            customerId: cart.customer_id as string,
            operation: run.agent_slug,
            text,
        });
        return outcomeFromDelivery(delivery);
    },
};

async function loadCartItemNames(shopId: string, cartId: string): Promise<string[]> {
    const { data } = await supabaseAdmin()
        .from('carts')
        .select('cart_items(quantity, products(name))')
        .eq('id', cartId)
        .eq('shop_id', shopId)
        .maybeSingle();
    const items = (data?.cart_items ?? []) as { quantity: number; products: { name: string } | { name: string }[] | null }[];
    return items
        .map((i) => one(i.products)?.name)
        .filter((n): n is string => Boolean(n));
}

// ── Өглөөний борлуулалтын тойм ──────────────────────────────────────

export interface DayOrder {
    status: string;
    payment_status: string | null;
    total_amount: number | string | null;
    created_at: string;
}

export interface SalesSummary {
    yesterdayOrders: number;
    yesterdayRevenue: number;
    yesterdayCancelled: number;
    toFulfil: number;
}

export function summarizeSales(orders: DayOrder[], now: Date): SalesSummary {
    const todayStart = ubDayStart(now).getTime();
    const yesterdayStart = todayStart - DAY;
    const s: SalesSummary = { yesterdayOrders: 0, yesterdayRevenue: 0, yesterdayCancelled: 0, toFulfil: 0 };

    for (const o of orders) {
        const t = new Date(o.created_at).getTime();
        if (t >= yesterdayStart && t < todayStart) {
            if (o.status === 'cancelled') s.yesterdayCancelled++;
            else {
                s.yesterdayOrders++;
                if (o.payment_status === 'paid') s.yesterdayRevenue += Number(o.total_amount ?? 0);
            }
        }
        if (o.status === 'confirmed' || o.status === 'processing' || o.status === 'paid') s.toFulfil++;
    }
    return s;
}

export function formatSalesSummary(s: SalesSummary): { title: string; body: string } | null {
    if (s.yesterdayOrders === 0 && s.toFulfil === 0 && s.yesterdayCancelled === 0) return null;
    const parts: string[] = [];
    const revenue = s.yesterdayRevenue > 0 ? ` (${s.yesterdayRevenue.toLocaleString()}₮ орлого)` : '';
    parts.push(s.yesterdayOrders > 0 ? `Өчигдөр ${s.yesterdayOrders} захиалга${revenue}` : 'Өчигдөр захиалга ороогүй');
    if (s.toFulfil > 0) parts.push(`${s.toFulfil} захиалга бэлдэж/хүргэх`);
    if (s.yesterdayCancelled > 0) parts.push(`${s.yesterdayCancelled} цуцлагдсан`);
    return { title: '☀️ Өнөөдрийн тойм', body: parts.join(' · ') };
}

export const dailySalesSummary: AutomationDef = {
    key: 'daily_sales_summary',
    label: 'Өглөөний борлуулалтын тойм',
    description: 'Өглөө бүр өчигдрийн захиалга, орлого, бэлдэх захиалгын тоог push-ээр илгээнэ.',
    kind: 'owner_report',
    defaultMode: 'auto',
    defaultEnabled: true,
    usesLLM: false,
    configFields: [summaryHourField],

    async select(ctx) {
        return dailyShopSubject(ctx);
    },

    async execute(ctx) {
        const todayStart = ubDayStart(ctx.now).getTime();
        // Бэлдэх захиалгыг тоолохын тулд 14 хоног хүртэл харна (хуучин гацсан захиалга).
        const { data, error } = await supabaseAdmin()
            .from('orders')
            .select('status, payment_status, total_amount, created_at')
            .eq('shop_id', ctx.shopId)
            .gte('created_at', new Date(todayStart - 14 * DAY).toISOString())
            .lt('created_at', new Date(todayStart).toISOString())
            .limit(5000);
        if (error) throw new Error(error.message);

        const summary = summarizeSales((data ?? []) as DayOrder[], ctx.now);
        return pushOwnerReport(ctx, formatSalesSummary(summary), {
            url: '/dashboard/orders',
            tag: 'daily-sales',
            stats: summary,
        });
    },
};
