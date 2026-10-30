/**
 * Industry Pack parity — салбарын бүх үүсвэр утгыг snapshot болгоно.
 *
 * Snapshot-ийг Industry Pack refactor-оос ӨМНӨ хуучин хатуу кодоор үүсгэсэн.
 * Refactor (салбарыг pack-аас үүсвэрлэх) зан төлөвийг огт өөрчлөөгүйг энэ
 * тест баталгаажуулна. Шинэ pack нэмэхэд snapshot-ийг `vitest -u`-ээр
 * шинэчилж, diff-д зөвхөн шинэ pack нэмэгдсэнийг шалгана.
 */

import { describe, it, expect } from 'vitest';
import {
    BUSINESS_TYPES,
    BUSINESS_TYPE_VALUES,
    OPERATIONS_CONFIG,
} from '@/lib/constants/business-types';
import { BUSINESS_TYPE_ARCHETYPE, dashboardBlocks, itemNoun, resolveArchetype } from '@/lib/dashboard/archetypes';
import { BUSINESS_ROLE_RECOMMENDATIONS } from '@/lib/ai/agents/registry';
import { buildBusinessTypeSection, buildProductsInfo } from '@/lib/ai/services/PromptService';
import { operationsSchema } from '@/lib/validations/ai-settings';
import type { AIProduct } from '@/types/ai';

/** Бүх renderer-ийн уншдаг түлхүүрүүдийг агуулсан баялаг fixture. */
const FULL_SETUP: Record<string, unknown> = {
    inventory_method: 'barcode',
    warehouse_address: 'СБД 1-р хороо',
    tax_registered: true,
    product_categories: ['Хувцас', 'Гутал'],
    brand_origin: 'imported',
    warranty_policy: '30 хоног',
    loyalty_program: 'Оноо цуглуулах',
    table_count: 20,
    delivery_enabled: true,
    delivery_zones: 'СБД, ЧД',
    avg_prep_minutes: 15,
    menu_categories: ['Үндсэн', 'Уух'],
    dietary_options: ['Веган'],
    peak_hours: '12:00-14:00',
    reservation_policy: '2 цагийн өмнө',
    min_order_value: 20000,
    service_fee_percent: 10,
    staff_count: 4,
    default_duration_minutes: 45,
    booking_method: 'calendar',
    business_hours: 'Да-Ба 09:00-18:00',
    service_catalog: [{ name: 'Засвар', duration: 60, price: 50000 }],
    cancellation_policy: '24 цагийн өмнө',
    advance_booking_days: 14,
    requires_deposit: true,
    home_visit_enabled: true,
    shipping_zones: 'УБ, орон нутаг',
    payment_methods: ['qpay', 'cod'],
    inventory_tracking: true,
    dispatch_sla_hours: 24,
    return_window_days: 7,
    size_chart_url: 'https://example.mn/size',
    brand_story: 'Монгол брэнд',
    pre_order_policy: '50% урьдчилгаа',
    salon_address: 'ХУД 11-р хороо',
    services_at_home: true,
    service_menu: [{ name: 'Үс засах', duration: 30, price: 25000 }],
    specialist_list: [{ name: 'Сараа', specialty: 'Үсчин' }],
    walk_in_accepted: false,
    aftercare_instructions: 'Усанд 24 цаг бүү ор',
    doctor_count: 5,
    specialties: 'Шүд, хүүхэд',
    insurance_accepted: ['ЭМД'],
    appointment_required: true,
    emergency_handling: '103 руу залга',
    triage_disclaimer: 'Онош тавихгүй',
    course_types: 'Англи хэл, Програмчлал',
    student_capacity: 25,
    levels_offered: ['Анхан', 'Дунд'],
    class_format: ['Танхим', 'Онлайн'],
    intake_dates: 'Сар бүрийн 1',
    certification_offered: true,
    trial_class_available: true,
    category: 'both',
    agent_count: 3,
    service_areas: 'УБ, Дархан',
    listing_types: ['Орон сууц', 'Машин'],
    financing_partners: 'Хаан банк',
    inspection_policy: 'Ажлын өдөр',
    lead_qualification_questions: ['Төсөв хэд вэ?', 'Хэзээ авах вэ?'],
};

const product: AIProduct = {
    id: 'p1',
    name: 'Тест зүйл',
    price: 150000,
    stock: 0,
    delivery_type: 'included',
    delivery_fee: 0,
};

describe('industry pack parity', () => {
    it('business type list and order', () => {
        expect(BUSINESS_TYPE_VALUES).toMatchSnapshot();
    });

    it('business type meta (icon by name)', () => {
        const meta = Object.fromEntries(
            BUSINESS_TYPE_VALUES.map((t) => {
                const { icon, ...rest } = BUSINESS_TYPES[t];
                return [t, { ...rest, icon: icon.displayName ?? (icon as { name?: string }).name }];
            }),
        );
        expect(meta).toMatchSnapshot();
    });

    it('operations (setup wizard) config', () => {
        expect(OPERATIONS_CONFIG).toMatchSnapshot();
    });

    it('dashboard archetype, blocks and noun per type', () => {
        const out = Object.fromEntries(
            BUSINESS_TYPE_VALUES.map((t) => [
                t,
                {
                    archetype: BUSINESS_TYPE_ARCHETYPE[t],
                    resolved: resolveArchetype(t, []),
                    blocks: dashboardBlocks(t, []),
                    noun: itemNoun(t),
                },
            ]),
        );
        expect(out).toMatchSnapshot();
    });

    it('AI role recommendation per type', () => {
        expect(BUSINESS_ROLE_RECOMMENDATIONS).toMatchSnapshot();
    });

    it('prompt business section per type', () => {
        const out = Object.fromEntries(
            BUSINESS_TYPE_VALUES.map((t) => [t, buildBusinessTypeSection(t, FULL_SETUP)]),
        );
        expect(out).toMatchSnapshot();
    });

    it('catalog rendering (stock vs listing) per type', () => {
        const out = Object.fromEntries(
            BUSINESS_TYPE_VALUES.map((t) => [t, buildProductsInfo([product], t)]),
        );
        expect(out).toMatchSnapshot();
    });

    it('operations Zod union covers exactly the types with a setup step', () => {
        const unionTypes = operationsSchema.options
            .map((o) => o.shape.business_type.value as string)
            .sort();
        const withOperations = BUSINESS_TYPE_VALUES.filter((t) => OPERATIONS_CONFIG[t] !== null).sort();
        expect(unionTypes).toEqual(withOperations);
    });
});
