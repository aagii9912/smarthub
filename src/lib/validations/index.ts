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

export const createOrderSchema = z.object({
    customerId: z.string().uuid('Invalid customer ID'),
    items: z.array(z.object({
        productId: z.string().uuid('Invalid product ID'),
        quantity: z.number().int().positive('Quantity must be positive'),
        unitPrice: z.number().positive('Price must be positive'),
    })).min(1, 'Order must have at least one item'),
    notes: z.string().max(500).optional(),
    deliveryAddress: z.string().max(200).optional(),
});

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const productTypeSchema = z.enum(['physical', 'service', 'appointment']);

export const createProductSchema = z.object({
    name: z.string()
        .min(1, 'Нэр оруулна уу')
        .max(100, 'Нэр хэт урт байна'),
    description: z.string().max(1000).optional().nullable(),
    price: z.number()
        .positive('Үнэ 0-ээс их байх ёстой')
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
    colors: z.array(z.string()).optional().default([]),
    sizes: z.array(z.string()).optional().default([]),
    images: z.array(z.string().url()).optional().default([]),
    isActive: z.boolean().optional().default(true),
    // Appointment-specific fields
    durationMinutes: z.number().int().min(15).max(480).optional().nullable(),
    availableDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional().default([]),
    startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional().nullable(),
    maxBookingsPerDay: z.number().int().min(1).max(100).optional().nullable(),
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

