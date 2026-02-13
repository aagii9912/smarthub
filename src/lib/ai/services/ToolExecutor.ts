/**
 * ToolExecutor - Routes AI tool calls to domain-specific handlers
 * 
 * Handler files:
 *   - OrderHandlers:    create_order, cancel_order, update_order, check_order_status, checkout
 *   - CartHandlers:     add_to_cart, view_cart, remove_from_cart
 *   - CustomerHandlers: collect_contact_info, request_human_support, remember_preference
 *   - ProductHandlers:  show_product_image, suggest_related_products, check_payment_status, log_complaint
 */

import { logger } from '@/lib/utils/logger';
import type { ChatContext, ImageAction } from '@/types/ai';
import type {
    CreateOrderArgs,
    CollectContactArgs,
    RequestHumanSupportArgs,
    CancelOrderArgs,
    ShowProductImageArgs,
    AddToCartArgs,
    RemoveFromCartArgs,
    CheckoutArgs,
    RememberPreferenceArgs,
    CheckPaymentArgs,
    CheckOrderStatusArgs,
    LogComplaintArgs,
    SuggestRelatedProductsArgs,
    UpdateOrderArgs,
    ToolName,
} from '../tools/definitions';

// Handler imports — re-exported for backward compatibility
export { executeCreateOrder, executeCancelOrder, executeUpdateOrder, executeCheckOrderStatus, executeCheckout } from '../tools/handlers/OrderHandlers';
export { executeAddToCart, executeViewCart, executeRemoveFromCart } from '../tools/handlers/CartHandlers';
export { executeCollectContact, executeRequestSupport, executeRememberPreference } from '../tools/handlers/CustomerHandlers';
export { executeShowProductImage, executeSuggestRelatedProducts, executeCheckPaymentStatus, executeLogComplaint } from '../tools/handlers/ProductHandlers';

// Also import for local use in executeTool router
import { executeCreateOrder, executeCancelOrder, executeUpdateOrder, executeCheckOrderStatus, executeCheckout } from '../tools/handlers/OrderHandlers';
import { executeAddToCart, executeViewCart, executeRemoveFromCart } from '../tools/handlers/CartHandlers';
import { executeCollectContact, executeRequestSupport, executeRememberPreference } from '../tools/handlers/CustomerHandlers';
import { executeShowProductImage, executeSuggestRelatedProducts, executeCheckPaymentStatus, executeLogComplaint } from '../tools/handlers/ProductHandlers';

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
    success: boolean;
    message?: string;
    error?: string;
    data?: Record<string, unknown>;
    imageAction?: ImageAction;
    quickReplies?: Array<{ title: string; payload: string }>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
    shopId: string;
    customerId?: string;
    customerName?: string;
    products: ChatContext['products'];
    notifySettings?: ChatContext['notifySettings'];
}

/**
 * Main tool executor - routes to appropriate handler
 */
export async function executeTool(
    toolName: ToolName,
    args: unknown,
    context: ToolExecutionContext
): Promise<ToolExecutionResult> {
    try {
        switch (toolName) {
            // Order handlers
            case 'create_order':
                return await executeCreateOrder(args as CreateOrderArgs, context);
            case 'cancel_order':
                return await executeCancelOrder(args as CancelOrderArgs, context);
            case 'check_order_status':
                return await executeCheckOrderStatus(args as CheckOrderStatusArgs, context);
            case 'checkout':
                return await executeCheckout(args as CheckoutArgs, context);
            case 'update_order':
                return await executeUpdateOrder(args as UpdateOrderArgs, context);

            // Cart handlers
            case 'add_to_cart':
                return await executeAddToCart(args as AddToCartArgs, context);
            case 'view_cart':
                return await executeViewCart(context);
            case 'remove_from_cart':
                return await executeRemoveFromCart(args as RemoveFromCartArgs, context);

            // Customer handlers
            case 'collect_contact_info':
                return await executeCollectContact(args as CollectContactArgs, context);
            case 'request_human_support':
                return await executeRequestSupport(args as RequestHumanSupportArgs, context);
            case 'remember_preference':
                return await executeRememberPreference(args as RememberPreferenceArgs, context);

            // Product & analytics handlers
            case 'show_product_image':
                return executeShowProductImage(args as ShowProductImageArgs, context);
            case 'suggest_related_products':
                return await executeSuggestRelatedProducts(args as SuggestRelatedProductsArgs, context);
            case 'check_payment_status':
                return await executeCheckPaymentStatus(args as CheckPaymentArgs, context);
            case 'log_complaint':
                return await executeLogComplaint(args as LogComplaintArgs, context);

            default:
                return { success: false, error: `Unknown tool: ${toolName}` };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Tool execution error (${toolName}):`, { error: errorMessage });
        return { success: false, error: errorMessage };
    }
}
