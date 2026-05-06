import { z } from 'zod';
import { ToolDefinition } from './core';

export const AddToCartSchema = z.object({
    product_name: z.string(),
    quantity: z.number().int().min(1).default(1),
    color: z.string().optional(),
    size: z.string().optional()
});
export type AddToCartArgs = z.infer<typeof AddToCartSchema>;

export const ViewCartSchema = z.object({});

export const RemoveFromCartSchema = z.object({
    product_name: z.string()
});
export type RemoveFromCartArgs = z.infer<typeof RemoveFromCartSchema>;

export const CheckoutSchema = z.object({
    notes: z.string().optional()
});
export type CheckoutArgs = z.infer<typeof CheckoutSchema>;

export const CART_TOOLS: ToolDefinition[] = [
    {
        name: 'add_to_cart',
        description: 'Add a product to shopping cart. Use IMMEDIATELY when customer wants to buy. Do NOT ask for confirmation. ALWAYS extract the quantity from the customer message verbatim — Mongolian numerals like "хоёр"=2, "гурван"=3, "5 ширхэг"=5, "хос"=2. Pass quantity=1 only when the customer truly did not specify any number. Existing cart items with the same product+variant accumulate, so do NOT call this tool twice for the same product in one reply — combine into a single call. For changing the quantity of a product the customer already ordered, use update_order instead.',
        parameters: { type: 'object', properties: { product_name: { type: 'string', description: 'Name of the product to add (fuzzy match)' }, quantity: { type: 'number', description: 'Quantity to add — extract from the customer message. Defaults to 1 only if no quantity is mentioned.', default: 1 }, color: { type: 'string', description: 'Color variant (optional)' }, size: { type: 'string', description: 'Size variant (optional)' } }, required: ['product_name', 'quantity'] },
        capabilities: ['sales']
    },
    {
        name: 'view_cart',
        description: 'Show current shopping cart contents and total. Use when customer asks about their cart or wants to see what they have added.',
        parameters: { type: 'object', properties: {}, required: [] },
        capabilities: ['sales']
    },
    {
        name: 'remove_from_cart',
        description: 'Remove an item from cart. Use when customer wants to remove something from their cart.',
        parameters: { type: 'object', properties: { product_name: { type: 'string', description: 'Name of the product to remove' } }, required: ['product_name'] },
        capabilities: ['sales']
    },
    {
        name: 'checkout',
        description: 'Finalize cart and create order with payment link. Call this IMMEDIATELY when customer clicks checkout button, says "төлбөр төлөх", "checkout", or wants to pay. Do NOT ask for reconfirmation — execute directly.',
        parameters: { type: 'object', properties: { notes: { type: 'string', description: 'Any special notes for the order' } }, required: [] },
        capabilities: ['sales']
    }
];
