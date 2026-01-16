import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleToolCall } from '@/lib/ai/tools';
import { ChatContext, ChatMessage, ImageAction } from '@/lib/ai/types';

// Mock dependencies
const mockSupabase = {
    from: vi.fn(),
    rpc: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => mockSupabase,
}));

vi.mock('@/lib/notifications', () => ({
    sendOrderNotification: vi.fn(),
    sendPushNotification: vi.fn(),
}));

describe('AI Tools', () => {
    let context: ChatContext;
    let messages: ChatMessage[];
    let setImageAction: any;

    beforeEach(() => {
        vi.clearAllMocks();
        context = {
            shopId: 'shop-123',
            customerId: 'cust-123',
            shopName: 'Test Shop',
            products: [
                {
                    id: 'prod-1',
                    name: 'Test Product',
                    price: 10000,
                    stock: 10,
                    reserved_stock: 2,
                    type: 'product',
                    image_url: 'http://example.com/img.jpg'
                }
            ],
            notifySettings: {
                order: true,
                contact: true,
                support: true,
                cancel: true
            }
        };
        messages = [];
        setImageAction = vi.fn();
    });

    it('should handle request_human_support tool', async () => {
        const toolCall = {
            id: 'call_1',
            function: {
                name: 'request_human_support',
                arguments: JSON.stringify({ reason: 'Need help' })
            }
        };

        await handleToolCall(toolCall, context, messages, setImageAction);

        expect(messages).toHaveLength(1);
        expect(JSON.parse(messages[0].content).success).toBe(true);
    });

    it('should handle collect_contact_info tool', async () => {
        const toolCall = {
            id: 'call_2',
            function: {
                name: 'collect_contact_info',
                arguments: JSON.stringify({ phone: '99112233', name: 'Bat' })
            }
        };

        const updateMock = vi.fn().mockReturnValue({ eq: vi.fn() });
        mockSupabase.from.mockReturnValue({ update: updateMock });

        await handleToolCall(toolCall, context, messages, setImageAction);

        expect(mockSupabase.from).toHaveBeenCalledWith('customers');
        expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ phone: '99112233', name: 'Bat' }));
        expect(messages).toHaveLength(1);
        expect(JSON.parse(messages[0].content).success).toBe(true);
    });

    it('should handle create_order tool - success', async () => {
        const toolCall = {
            id: 'call_3',
            function: {
                name: 'create_order',
                arguments: JSON.stringify({ product_name: 'Test Product', quantity: 2 })
            }
        };

        // Mock product lookup from DB
        const selectProductMock = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { stock: 10, reserved_stock: 2, price: 10000, id: 'prod-1' } })
            })
        });

        // Mock order creation
        const insertOrderMock = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'order-1' }, error: null })
            })
        });

        // Mock order item creation
        const insertItemMock = vi.fn().mockResolvedValue({});

        // Mock stock update
        const updateStockMock = vi.fn().mockReturnValue({
             eq: vi.fn().mockResolvedValue({})
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'products') return { select: selectProductMock, update: updateStockMock };
            if (table === 'orders') return { insert: insertOrderMock };
            if (table === 'order_items') return { insert: insertItemMock };
            return {};
        });

        await handleToolCall(toolCall, context, messages, setImageAction);

        expect(messages).toHaveLength(1);
        const response = JSON.parse(messages[0].content);
        expect(response.success).toBe(true);
        expect(response.message).toContain('Order #order-1 created');
    });

     it('should handle create_order tool - not enough stock', async () => {
        const toolCall = {
            id: 'call_4',
            function: {
                name: 'create_order',
                arguments: JSON.stringify({ product_name: 'Test Product', quantity: 20 })
            }
        };

        // Mock product lookup from DB
        const selectProductMock = vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { stock: 10, reserved_stock: 2, price: 10000, id: 'prod-1' } })
            })
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'products') return { select: selectProductMock };
            return {};
        });

        await handleToolCall(toolCall, context, messages, setImageAction);

        expect(messages).toHaveLength(1);
        const response = JSON.parse(messages[0].content);
        expect(response.error).toContain('Not enough stock');
    });

    it('should handle show_product_image tool', async () => {
         const toolCall = {
            id: 'call_5',
            function: {
                name: 'show_product_image',
                arguments: JSON.stringify({ product_names: ['Test Product'], mode: 'single' })
            }
        };

        await handleToolCall(toolCall, context, messages, setImageAction);

        expect(setImageAction).toHaveBeenCalledWith(expect.objectContaining({
            type: 'single',
            products: expect.arrayContaining([expect.objectContaining({ name: 'Test Product' })])
        }));
    });
});
