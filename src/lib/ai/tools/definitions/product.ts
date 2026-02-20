import { z } from 'zod';
import { ToolDefinition } from './core';

export const ShowProductImageSchema = z.object({
    product_names: z.array(z.string()),
    mode: z.enum(['single', 'confirm'])
});
export type ShowProductImageArgs = z.infer<typeof ShowProductImageSchema>;

export const SuggestRelatedProductsSchema = z.object({
    current_product_name: z.string(),
    suggestion_type: z.enum(['complementary', 'similar', 'bundle']).optional()
});
export type SuggestRelatedProductsArgs = z.infer<typeof SuggestRelatedProductsSchema>;

export const CheckPaymentStatusSchema = z.object({
    order_id: z.string().optional()
});
export type CheckPaymentArgs = z.infer<typeof CheckPaymentStatusSchema>;

export const LogComplaintSchema = z.object({
    complaint_type: z.enum(['product_quality', 'delivery', 'service', 'price', 'other']),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']).optional()
});
export type LogComplaintArgs = z.infer<typeof LogComplaintSchema>;

export const PRODUCT_TOOLS: ToolDefinition[] = [
    {
        name: 'show_product_image',
        description: 'Show product image(s) ONLY when customer asks about a SPECIFIC product by name or description (e.g. "харуулаач", "зураг", "юу шиг харагддаг вэ?"). DO NOT use for generic questions like "ямар бараа байна?" - just answer with text. Use "confirm" mode when 2-5 similar products match to ask which one they want.',
        parameters: { type: 'object', properties: { product_names: { type: 'array', items: { type: 'string' }, description: 'Names of SPECIFIC products to show (1-5 max). Use EXACT names from product list.' }, mode: { type: 'string', enum: ['single', 'confirm'], description: '"single" for 1 product, "confirm" to ask customer to choose between 2-5 similar products' } }, required: ['product_names', 'mode'] }
    },
    {
        name: 'check_payment_status',
        description: 'Check payment status manually. Use when customer says they paid ("Tulluu", "Shiljuullee") but AI didn\'t confirm yet.',
        parameters: { type: 'object', properties: { order_id: { type: 'string', description: 'Order ID to check (optional, if known)' } }, required: [] }
    },
    {
        name: 'log_complaint',
        description: 'Log customer complaint or negative feedback. Use when customer expresses dissatisfaction, says "муу", "асуудал", "гомдол", "сэтгэл дундуур".',
        parameters: { type: 'object', properties: { complaint_type: { type: 'string', enum: ['product_quality', 'delivery', 'service', 'price', 'other'], description: 'Type of complaint' }, description: { type: 'string', description: 'Brief description of the complaint' }, severity: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Severity level based on customer tone' } }, required: ['complaint_type', 'description'] }
    },
    {
        name: 'suggest_related_products',
        description: 'Suggest related products for cross-selling. Use AFTER customer shows interest in a product or adds to cart. Naturally suggest: "Энэтэй хамт авах уу?"',
        parameters: { type: 'object', properties: { current_product_name: { type: 'string', description: 'Name of the product customer is interested in' }, suggestion_type: { type: 'string', enum: ['complementary', 'similar', 'bundle'], description: 'Type of suggestion: complementary (goes with), similar (alternative), bundle (discount together)' } }, required: ['current_product_name'] }
    }
];
