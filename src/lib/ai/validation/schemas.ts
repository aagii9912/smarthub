/**
 * AI Tool Validation Schemas - Zod runtime validation
 * Provides type-safe validation for all AI tool arguments
 */

import { z } from 'zod';

/**
 * Create Order Schema
 */
export const CreateOrderSchema = z.object({
    product_name: z.string()
        .min(1, 'Product name is required')
        .max(200, 'Product name too long'),
    quantity: z.number()
        .int('Quantity must be a whole number')
        .positive('Quantity must be positive')
        .max(100, 'Maximum quantity is 100')
        .default(1),
    color: z.string().max(50).optional(),
    size: z.string().max(20).optional()
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

/**
 * Collect Contact Schema
 */
export const CollectContactSchema = z.object({
    phone: z.string()
        .regex(/^\d{8}$/, 'Phone must be 8 digits')
        .optional(),
    address: z.string()
        .min(5, 'Address too short')
        .max(500, 'Address too long')
        .optional(),
    name: z.string()
        .min(2, 'Name too short')
        .max(100, 'Name too long')
        .optional()
}).refine(
    data => data.phone || data.address || data.name,
    'At least one contact field is required'
);

export type CollectContactInput = z.infer<typeof CollectContactSchema>;

/**
 * Request Human Support Schema
 */
export const RequestHumanSupportSchema = z.object({
    reason: z.string()
        .min(1, 'Reason is required')
        .max(500, 'Reason too long')
});

export type RequestHumanSupportInput = z.infer<typeof RequestHumanSupportSchema>;

/**
 * Cancel Order Schema
 */
export const CancelOrderSchema = z.object({
    reason: z.string()
        .max(500, 'Reason too long')
        .optional()
});

export type CancelOrderInput = z.infer<typeof CancelOrderSchema>;

/**
 * Show Product Image Schema
 */
export const ShowProductImageSchema = z.object({
    product_names: z.array(z.string().min(1))
        .min(1, 'At least one product name required')
        .max(5, 'Maximum 5 products'),
    mode: z.enum(['single', 'confirm'])
});

export type ShowProductImageInput = z.infer<typeof ShowProductImageSchema>;

/**
 * Add to Cart Schema
 */
export const AddToCartSchema = z.object({
    product_name: z.string()
        .min(1, 'Product name is required')
        .max(200, 'Product name too long'),
    quantity: z.number()
        .int('Quantity must be a whole number')
        .positive('Quantity must be positive')
        .max(50, 'Maximum quantity is 50')
        .default(1),
    color: z.string().max(50).optional(),
    size: z.string().max(20).optional()
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;

/**
 * Remove from Cart Schema
 */
export const RemoveFromCartSchema = z.object({
    product_name: z.string()
        .min(1, 'Product name is required')
        .max(200, 'Product name too long')
});

export type RemoveFromCartInput = z.infer<typeof RemoveFromCartSchema>;

/**
 * Checkout Schema
 */
export const CheckoutSchema = z.object({
    notes: z.string()
        .max(1000, 'Notes too long')
        .optional()
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;

/**
 * Remember Preference Schema
 */
export const RememberPreferenceSchema = z.object({
    key: z.enum(['size', 'color', 'color_preference', 'style', 'budget', 'interests', 'preferred_brands'])
        .or(z.string().min(1).max(50)),
    value: z.string()
        .min(1, 'Value is required')
        .max(200, 'Value too long')
});

export type RememberPreferenceInput = z.infer<typeof RememberPreferenceSchema>;

/**
 * View Cart Schema (no args required)
 */
export const ViewCartSchema = z.object({});

export type ViewCartInput = z.infer<typeof ViewCartSchema>;

/**
 * Map of tool names to their schemas
 */
export const ToolSchemas = {
    create_order: CreateOrderSchema,
    collect_contact_info: CollectContactSchema,
    request_human_support: RequestHumanSupportSchema,
    cancel_order: CancelOrderSchema,
    show_product_image: ShowProductImageSchema,
    add_to_cart: AddToCartSchema,
    view_cart: ViewCartSchema,
    remove_from_cart: RemoveFromCartSchema,
    checkout: CheckoutSchema,
    remember_preference: RememberPreferenceSchema
} as const;

export type ToolSchemaName = keyof typeof ToolSchemas;

/**
 * Validate tool arguments with detailed error messages
 */
export function validateToolArgs(
    toolName: ToolSchemaName,
    args: unknown
): { success: true; data: unknown } | { success: false; error: string } {
    const schema = ToolSchemas[toolName];

    if (!schema) {
        return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const result = schema.safeParse(args);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Format Zod errors into readable message
    const zodError = result.error;
    const errorMessages = zodError.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');

    return { success: false, error: `Validation failed: ${errorMessages}` };
}

/**
 * Strict validation that throws on error
 */
export function validateToolArgsStrict(
    toolName: ToolSchemaName,
    args: unknown
): unknown {
    const result = validateToolArgs(toolName, args);

    if (!result.success) {
        throw new Error(result.error);
    }

    return result.data;
}
