export * from './definitions/core';
export * from './definitions/order';
export * from './definitions/cart';
export * from './definitions/customer';
export * from './definitions/product';

import { ORDER_TOOLS } from './definitions/order';
import { CART_TOOLS } from './definitions/cart';
import { CUSTOMER_TOOLS } from './definitions/customer';
import { PRODUCT_TOOLS } from './definitions/product';

export const TOOL_DEFINITIONS = [
    ...ORDER_TOOLS,
    ...CART_TOOLS,
    ...CUSTOMER_TOOLS,
    ...PRODUCT_TOOLS
];

export const AI_TOOLS = TOOL_DEFINITIONS;

export type ToolName =
    | 'create_order'
    | 'cancel_order'
    | 'check_order_status'
    | 'update_order'
    | 'add_to_cart'
    | 'view_cart'
    | 'remove_from_cart'
    | 'checkout'
    | 'collect_contact_info'
    | 'request_human_support'
    | 'remember_preference'
    | 'show_product_image'
    | 'suggest_related_products'
    | 'check_payment_status'
    | 'log_complaint';
