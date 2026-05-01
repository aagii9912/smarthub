/**
 * AI хэрэглэх эрхийг шалгах нэгдсэн функц.
 *
 * Идэвхтэй төлсөн plan эсвэл хүчинтэй trial хугацаа байгаа бол true.
 * Хуурмаг default 'active' статусын улмаас төлбөргүй хэрэглэгчид AI ашиглах
 * боломжтой болсон асуудлыг хаахын тулд webhook-аас өмнө дуудна.
 */

import type { UserBillingSnapshot } from './getUserBilling';

interface ShopBillingFallback {
    subscription_plan?: string | null;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
}

export function isAiAuthorized(
    billing: UserBillingSnapshot | null,
    shop: ShopBillingFallback
): boolean {
    const now = Date.now();

    if (billing) {
        if (billing.status === 'active' && billing.plan && billing.plan !== 'unpaid') {
            return true;
        }
        if (billing.status === 'trialing' || billing.status === 'trial') {
            const trialEnd = billing.trialEndsAt ? new Date(billing.trialEndsAt).getTime() : 0;
            return trialEnd > now;
        }
        return false;
    }

    if (shop.subscription_status === 'active' && shop.subscription_plan) {
        return true;
    }
    if (shop.subscription_status === 'trial' || shop.subscription_status === 'trialing') {
        const trialEnd = shop.trial_ends_at ? new Date(shop.trial_ends_at).getTime() : 0;
        return trialEnd > now;
    }
    return false;
}
