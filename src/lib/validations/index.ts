import { z } from 'zod';

// ============================================
// ORDER SCHEMAS
// ============================================

export const orderStatusSchema = z.enum([
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
]);

export const updateOrderStatusSchema = z.object({
    orderId: z.string().uuid('Invalid order ID format'),
    status: orderStatusSchema,
});

export const paymentMethodSchema = z.enum(['cod', 'qpay', 'bank_transfer', 'cash']);

export const createOrderSchema = z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    items: z.array(z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
        unitPrice: z.number().positive('Price must be positive'),
    })).min(1, 'Order must have at least one item'),
    notes: z.string().max(500).optional(),
    deliveryAddress: z.string().max(200).optional(),
    paymentMethod: paymentMethodSchema.optional(),
});

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const productTypeSchema = z.enum(['physical', 'service', 'appointment']);

export const deliveryTypeSchema = z.enum(['included', 'paid', 'pickup_only']);

/**
 * Structured listing attributes for `business_type = 'realestate_auto'`.
 *
 * Discriminated on `kind` so a property can never be saved with car fields and
 * vice versa — `.strict()` rejects the cross-contamination outright instead of
 * silently storing it. Every attribute itself is optional: a broker posting a
 * half-known listing must still be able to save it.
 *
 * Field list mirrors `LISTING_ATTRIBUTE_FIELDS` in
 * `src/lib/constants/listing-attributes.ts` — keep the two in step.
 */
const realestateAttributesSchema = z
    .object({
        kind: z.literal('realestate'),
        rooms: z.number().int().min(0).max(30).optional().nullable(),
        area_m2: z.number().min(0).max(100000).optional().nullable(),
        district: z.string().max(80).optional().nullable(),
        khoroo: z.string().max(120).optional().nullable(),
        floor: z.number().int().min(-5).max(200).optional().nullable(),
        total_floors: z.number().int().min(0).max(200).optional().nullable(),
        built_year: z.number().int().min(1900).max(2100).optional().nullable(),
        is_furnished: z.boolean().optional().nullable(),
        mortgage_available: z.boolean().optional().nullable(),
    })
    .strict();

const autoAttributesSchema = z
    .object({
        kind: z.literal('auto'),
        make: z.string().max(60).optional().nullable(),
        model: z.string().max(80).optional().nullable(),
        year: z.number().int().min(1900).max(2100).optional().nullable(),
        mileage_km: z.number().int().min(0).max(3000000).optional().nullable(),
        engine_cc: z.number().int().min(0).max(20000).optional().nullable(),
        transmission: z.string().max(40).optional().nullable(),
        fuel: z.string().max(40).optional().nullable(),
        steering: z.string().max(40).optional().nullable(),
        color: z.string().max(40).optional().nullable(),
    })
    .strict();

export const listingAttributesSchema = z.discriminatedUnion('kind', [
    realestateAttributesSchema,
    autoAttributesSchema,
]);

// Variant rows sent by the product form (FormVariant). Persisted to the
// product_variants table by the products API route (#6).
export const productVariantInputSchema = z.object({
    name: z.string().min(1, 'Хувилбарын нэр оруулна уу').max(200),
    options: z.record(z.string(), z.string()).optional().default({}),
    price: z.number().min(0).max(999999999).optional().nullable(),
    stock: z.number().int().min(0).optional().default(0),
    is_active: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
    name: z.string()
        .min(1, 'Нэр оруулна уу')
        .max(100, 'Нэр хэт урт байна'),
    description: z.string().max(10000, 'Тайлбар 10000 тэмдэгтээс хэтрэхгүй').optional().nullable(),
    // 0 = "Үнэ тохиролцоно". Үл хөдлөх / авто зарын багагүй хэсэг нь ил үнэгүй
    // тавигддаг; `.positive()` байхад брокер ийм зарыг огт хадгалж чаддаггүй
    // байсан (client талд нь оруулахыг зөвшөөрдөг мөртлөө сервер 400 буцаадаг).
    // buildProductsInfo 0-г "Үнэ тохиролцоно" гэж уншина.
    price: z.number()
        .min(0, 'Үнэ сөрөг байж болохгүй')
        .max(999999999, 'Үнэ хэт их байна'),
    stock: z.number()
        .int('Тоо ширхэг бүхэл тоо байх ёстой')
        .min(0, 'Үлдэгдэл сөрөг байж болохгүй')
        .optional()
        .nullable(),
    discountPercent: z.number()
        .min(0, 'Хямдрал 0-ээс их байх ёстой')
        .max(100, 'Хямдрал 100%-аас их байж болохгүй')
        .optional()
        .default(0),
    type: productTypeSchema.default('physical'),
    // Үйлчилгээ/барааны төрөл (ангилал) — дашбордын бүлэглэлд хэрэглэнэ.
    category: z.string().max(80).optional().nullable(),
    colors: z.array(z.string()).optional().default([]),
    sizes: z.array(z.string()).optional().default([]),
    images: z.array(z.string().url()).optional().default([]),
    isActive: z.boolean().optional().default(true),
    // Lifecycle status (#8/#9/#10): draft / active / pre_order / coming_soon / discontinued.
    status: z.enum(['draft', 'active', 'pre_order', 'coming_soon', 'discontinued']).optional(),
    availableFrom: z.string().datetime().optional().nullable(),
    preOrderEta: z.string().datetime().optional().nullable(),
    // Per-product AI training note (#2)
    aiInstructions: z.string().max(500).optional().nullable(),
    // Structured listing attributes (realestate_auto only). `null` clears them.
    // The DB only checks `kind`; the real shape is enforced here so adding a
    // field never needs a migration. See lib/constants/listing-attributes.ts.
    attributes: listingAttributesSchema.optional().nullable(),
    // Delivery configuration
    deliveryType: deliveryTypeSchema.optional().default('included'),
    deliveryFee: z.number().min(0).optional().default(0),
    // Per-product delivery timing note (заавал биш). Shop-level бодлогоос дээгүүр
    // тухайн бараанд онцлох хүргэлтийн хугацааны тайлбар.
    deliveryNote: z.string().max(500).optional().nullable(),
    // Appointment-specific fields
    durationMinutes: z.number().int().min(15).max(480).optional().nullable(),
    // Mongolian short weekday labels — the values ProductForm's checkboxes submit
    // and that the booking handler (bookAppointment.ts WEEKDAYS_MN) matches against.
    // Stored as-is in products.available_days.
    availableDays: z.array(z.enum(['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням'])).optional().default([]),
    startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    maxBookingsPerDay: z.number().int().min(1).max(100).optional().nullable(),
    // Variant support (#6). Sent by ProductForm in snake_case; persisted to the
    // product_variants table by the route. No `.default()` so the route can tell
    // "not provided" (undefined → leave variants untouched on PATCH) apart from
    // "explicitly cleared" (empty array → remove all variants).
    has_variants: z.boolean().optional(),
    variants: z.array(productVariantInputSchema).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
    id: z.string().uuid('Invalid product ID'),
});

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const createCustomerSchema = z.object({
    name: z.string().min(1).max(100).optional().nullable(),
    phone: z.string()
        .regex(/^[0-9]{8}$/, 'Утасны дугаар 8 оронтой байх ёстой')
        .optional()
        .nullable(),
    address: z.string().max(200).optional().nullable(),
    facebookId: z.string().optional().nullable(),
});

// ============================================
// API REQUEST VALIDATION HELPERS
// ============================================

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type ProductType = z.infer<typeof productTypeSchema>;

// Safe parse helper that returns formatted error messages
export function parseWithErrors<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Zod v4 uses `issues` instead of `errors`
    const errors = result.error.issues.map((issue: z.ZodIssue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
    });

    return { success: false, errors };
}

