/**
 * AI Tool Definitions
 * Defines all available AI function calling tools for OpenAI
 */

import OpenAI from 'openai';

/**
 * All available AI tools for function calling
 */
export const AI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            name: 'create_order',
            description: 'Create a new order when customer explicitly says they want to buy something. Do not use for general inquiries.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to order (fuzzy match)'
                    },
                    quantity: {
                        type: 'number',
                        description: 'Quantity to order',
                        default: 1
                    },
                    color: {
                        type: 'string',
                        description: 'Selected color variant (optional)'
                    },
                    size: {
                        type: 'string',
                        description: 'Selected size variant (optional)'
                    }
                },
                required: ['product_name', 'quantity']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'collect_contact_info',
            description: 'Save customer contact information when they provide phone number or delivery address for an order. Use this when customer shares their phone or address.',
            parameters: {
                type: 'object',
                properties: {
                    phone: {
                        type: 'string',
                        description: 'Customer phone number (8 digits for Mongolia)'
                    },
                    address: {
                        type: 'string',
                        description: 'Delivery address'
                    },
                    name: {
                        type: 'string',
                        description: 'Customer name if provided'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'request_human_support',
            description: 'Call this when customer explicitly asks to speak to a human, operator, administrative staff, or when you cannot help them.',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Reason for requesting human support'
                    }
                },
                required: ['reason']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'cancel_order',
            description: 'Cancel an order when customer explicitly says they want to cancel their order. This will restore the reserved stock.',
            parameters: {
                type: 'object',
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Reason for cancellation'
                    }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'show_product_image',
            description: 'Show product image(s) ONLY when customer asks about a SPECIFIC product by name or description (e.g. "харуулаач", "зураг", "юу шиг харагддаг вэ?"). DO NOT use for generic questions like "ямар бараа байна?" - just answer with text. Use "confirm" mode when 2-5 similar products match to ask which one they want.',
            parameters: {
                type: 'object',
                properties: {
                    product_names: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Names of SPECIFIC products to show (1-5 max). Use EXACT names from product list.'
                    },
                    mode: {
                        type: 'string',
                        enum: ['single', 'confirm'],
                        description: '"single" for 1 product, "confirm" to ask customer to choose between 2-5 similar products'
                    }
                },
                required: ['product_names', 'mode']
            }
        }
    },
    // Cart Tools
    {
        type: 'function',
        function: {
            name: 'add_to_cart',
            description: 'Add a product to shopping cart. Use this FIRST when customer wants to buy something. Ask to confirm checkout after.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to add (fuzzy match)'
                    },
                    quantity: {
                        type: 'number',
                        description: 'Quantity to add',
                        default: 1
                    },
                    color: {
                        type: 'string',
                        description: 'Color variant (optional)'
                    },
                    size: {
                        type: 'string',
                        description: 'Size variant (optional)'
                    }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'view_cart',
            description: 'Show current shopping cart contents and total. Use when customer asks about their cart or wants to see what they have added.',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'remove_from_cart',
            description: 'Remove an item from cart. Use when customer wants to remove something from their cart.',
            parameters: {
                type: 'object',
                properties: {
                    product_name: {
                        type: 'string',
                        description: 'Name of the product to remove'
                    }
                },
                required: ['product_name']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'checkout',
            description: 'Finalize cart and create order. Use when customer confirms they want to complete their purchase and checkout.',
            parameters: {
                type: 'object',
                properties: {
                    notes: {
                        type: 'string',
                        description: 'Any special notes for the order'
                    }
                },
                required: []
            }
        }
    },
    // Memory Tool
    {
        type: 'function',
        function: {
            name: 'remember_preference',
            description: 'Хэрэглэгчийн сонголтыг санах. Размер, өнгө, стиль гэх мэт хэлэхэд ашиглана.',
            parameters: {
                type: 'object',
                properties: {
                    key: {
                        type: 'string',
                        description: 'Сонголтын төрөл (size, color, style, budget)'
                    },
                    value: {
                        type: 'string',
                        description: 'Санах утга'
                    }
                },
                required: ['key', 'value']
            }
        }
    }
];

/**
 * Tool argument types
 */
export interface CreateOrderArgs {
    product_name: string;
    quantity: number;
    color?: string;
    size?: string;
}

export interface CollectContactArgs {
    phone?: string;
    address?: string;
    name?: string;
}

export interface RequestHumanSupportArgs {
    reason: string;
}

export interface CancelOrderArgs {
    reason?: string;
}

export interface ShowProductImageArgs {
    product_names: string[];
    mode: 'single' | 'confirm';
}

export interface AddToCartArgs {
    product_name: string;
    quantity?: number;
    color?: string;
    size?: string;
}

export interface RemoveFromCartArgs {
    product_name: string;
}

export interface CheckoutArgs {
    notes?: string;
}

export interface RememberPreferenceArgs {
    key: string;
    value: string;
}

/**
 * Union type for all tool arguments
 */
export type ToolArgs =
    | CreateOrderArgs
    | CollectContactArgs
    | RequestHumanSupportArgs
    | CancelOrderArgs
    | ShowProductImageArgs
    | AddToCartArgs
    | RemoveFromCartArgs
    | CheckoutArgs
    | RememberPreferenceArgs;

/**
 * Tool names type
 */
export type ToolName =
    | 'create_order'
    | 'collect_contact_info'
    | 'request_human_support'
    | 'cancel_order'
    | 'show_product_image'
    | 'add_to_cart'
    | 'view_cart'
    | 'remove_from_cart'
    | 'checkout'
    | 'remember_preference';

