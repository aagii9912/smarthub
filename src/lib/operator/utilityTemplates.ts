/**
 * Messenger Utility Message template-уудын кодын тодорхойлолт.
 *
 * Meta 2026-04-27-оос CONFIRMED_EVENT_UPDATE / POST_PURCHASE_UPDATE /
 * ACCOUNT_UPDATE tag-ийг хассан тул 24 цагийн цонхны гадна захиалга, төлбөр,
 * цагийн сануулга илгээх зам нь Page-ийн өөрийн UTILITY template юм.
 *
 * Энд template-ийн нэр, текст, named параметрүүдийг тодорхойлно. Тухайн Page
 * дээр үүсгэсэн template-ийн төлөв `shop_message_templates`-д хадгалагдана.
 * Template-д маркетинг/урамшууллын агуулга оруулахыг Meta хориглодог.
 */

export type UtilityPurpose = 'payment_confirmed' | 'order_status' | 'appointment_reminder';

export interface UtilityTemplateDef {
    /** Page дээр үүсгэх template-ийн нэр (Meta: жижиг үсэг, доогуур зураас). */
    name: string;
    /** BODY компонентын текст; `{{param}}` нь NAMED параметр. */
    body: string;
    /** Body-д байгаа параметрүүд — илгээхэд бүгд заавал байна. */
    params: readonly string[];
}

export const UTILITY_TEMPLATES: Record<UtilityPurpose, UtilityTemplateDef> = {
    payment_confirmed: {
        name: 'syncly_payment_confirmed',
        body: 'Таны {{amount}}₮ төлбөр баталгаажлаа. Захиалга #{{order_ref}} бэлтгэгдэж эхэллээ.',
        params: ['amount', 'order_ref'],
    },
    order_status: {
        name: 'syncly_order_status',
        body: 'Таны #{{order_ref}} захиалгын төлөв шинэчлэгдлээ: {{status}}.',
        params: ['order_ref', 'status'],
    },
    appointment_reminder: {
        name: 'syncly_appointment_reminder',
        body: 'Сануулга: {{shop}}-д {{when}}-д {{service}} цаг захиалгатай байна. Өөрчлөх бол бидэнд бичээрэй.',
        params: ['shop', 'when', 'service'],
    },
};

/** Template-ийн бүх параметр өгөгдсөн эсэх (хоосон утга зөвшөөрөхгүй). */
export function hasAllTemplateParams(
    purpose: UtilityPurpose,
    params: Record<string, string>,
): boolean {
    return UTILITY_TEMPLATES[purpose].params.every((p) => Boolean(params[p]?.trim()));
}
