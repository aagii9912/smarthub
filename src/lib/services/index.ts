/**
 * Services index - Re-export all service classes
 */

export { CustomerService, customerService } from './CustomerService';
export { OrderService, orderService } from './OrderService';
export { ProductService, productService } from './ProductService';
export { CartService, cartService } from './CartService';
export { ChatHistoryService, chatHistoryService } from './ChatHistoryService';

// Re-export types
export type { CreateCustomerData, UpdateCustomerData } from './CustomerService';
export type { OrderWithItems, OrderFilters } from './OrderService';
export type { ProductWithVariants, ProductFilters } from './ProductService';
export type { AddToCartData, CartWithItems } from './CartService';
export type { SaveChatData, ChatHistoryEntry } from './ChatHistoryService';
