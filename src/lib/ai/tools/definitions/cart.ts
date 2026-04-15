import { z } from 'zod';
import { ToolDefinition } from './core';

export const AddToCartSchema = z.object({
    product_name: z.string(),
    quantity: z.number().default(1).optional(),
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
        description: 'Add a product to shopping cart. Use this IMMEDIATELY when customer wants to buy something. Do NOT ask for confirmation before adding — just add it directly.',
        parameters: { type: 'object', properties: { product_name: { type: 'string', description: 'Name of the product to add (fuzzy match)' }, quantity: { type: 'number', description: 'Quantity to add', default: 1 }, color: { type: 'string', description: 'Color variant (optional)' }, size: { type: 'string', description: 'Size variant (optional)' } }, required: ['product_name'] }
    },
    {
        name: 'view_cart',
        description: 'Show current shopping cart contents and total. Use when customer asks about their cart or wants to see what they have added.',
        parameters: { type: 'object', properties: {}, required: [] }
    },
    {
        name: 'remove_from_cart',
        description: 'Remove an item from cart. Use when customer wants to remove something from their cart.',
        parameters: { type: 'object', properties: { product_name: { type: 'string', description: 'Name of the product to remove' } }, required: ['product_name'] }
    },
    {
        name: 'checkout',
        description: 'Finalize cart and create order with payment link. Call this IMMEDIATELY when customer clicks checkout button, says "төлбөр төлөх", "checkout", or wants to pay. Do NOT ask for reconfirmation — execute directly.',
        parameters: { type: 'object', properties: { notes: { type: 'string', description: 'Any special notes for the order' } }, required: [] }
    }
];
