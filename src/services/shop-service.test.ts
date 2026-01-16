import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateCustomer } from '@/services/shop-service';

// Mock dependencies
const mockSupabase = {
    from: vi.fn(),
};

vi.mock('@/lib/supabase', () => ({
    supabaseAdmin: () => mockSupabase,
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Shop Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getOrCreateCustomer', () => {
        it('should return existing customer', async () => {
            const existingCustomer = { id: 'cust-1', name: 'Existing User' };

            // Fix: Mock the chain properly
            const selectMock = {
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: existingCustomer })
                    })
                })
            };

            mockSupabase.from.mockReturnValue({
                select: vi.fn().mockReturnValue(selectMock)
            });

            const result = await getOrCreateCustomer('shop-1', 'fb-123', 'token-123');

            expect(result).toEqual(existingCustomer);
        });

        it('should create new customer if not found', async () => {
            // Mock Not Found Chain
            const selectNotFoundChain = {
                eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null })
                    })
                })
            };

            const insertChain = {
                 select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { id: 'new-cust', name: 'FB User' } })
                })
            };

            mockSupabase.from.mockImplementation((table) => {
                if (table === 'customers') {
                     return {
                        select: vi.fn().mockReturnValue(selectNotFoundChain),
                        insert: vi.fn().mockReturnValue(insertChain)
                     };
                }
                return {};
            });

            // Mock FB Profile API
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ name: 'FB User' })
            });

            const result = await getOrCreateCustomer('shop-1', 'fb-123', 'token-123');

            expect(mockFetch).toHaveBeenCalled();
            expect(result).toEqual(expect.objectContaining({ id: 'new-cust', name: 'FB User' }));
        });
    });
});
