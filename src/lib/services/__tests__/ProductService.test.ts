/**
 * ProductService Tests
 * Unit tests for product-related database operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../ProductService';

// Mock supabaseAdmin
vi.mock('@/lib/supabase', () => {
    const createChainMock = () => {
        const mock: any = {
            from: vi.fn(() => mock),
            select: vi.fn(() => mock),
            insert: vi.fn(() => mock),
            update: vi.fn(() => mock),
            delete: vi.fn(() => mock),
            eq: vi.fn(() => mock),
            ilike: vi.fn(() => mock),
            lte: vi.fn(() => mock),
            order: vi.fn(() => mock),
            limit: vi.fn(() => mock),
            range: vi.fn(() => mock),
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        };
        return mock;
    };
    return {
        supabaseAdmin: vi.fn(createChainMock),
    };
});

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('ProductService', () => {
    let service: ProductService;

    beforeEach(() => {
        service = new ProductService();
        vi.clearAllMocks();
    });

    describe('getById', () => {
        it('should be defined', () => {
            expect(service.getById).toBeDefined();
        });
    });

    describe('findByName', () => {
        it('should be defined', () => {
            expect(service.findByName).toBeDefined();
        });
    });

    describe('getByShop', () => {
        it('should be defined', () => {
            expect(service.getByShop).toBeDefined();
        });
    });

    describe('checkStock', () => {
        it('should be defined', () => {
            expect(service.checkStock).toBeDefined();
        });
    });

    describe('updateStock', () => {
        it('should be defined', () => {
            expect(service.updateStock).toBeDefined();
        });
    });

    describe('getLowStock', () => {
        it('should be defined', () => {
            expect(service.getLowStock).toBeDefined();
        });
    });

    describe('calculateDiscountedPrice', () => {
        it('should calculate correct discounted price', () => {
            const result = service.calculateDiscountedPrice(100000, 20);
            expect(result).toBe(80000);
        });

        it('should return original price when no discount', () => {
            expect(service.calculateDiscountedPrice(100000, null)).toBe(100000);
            expect(service.calculateDiscountedPrice(100000, 0)).toBe(100000);
        });

        it('should handle 100% discount', () => {
            expect(service.calculateDiscountedPrice(100000, 100)).toBe(0);
        });

        it('should handle decimal discounts', () => {
            expect(service.calculateDiscountedPrice(100000, 15.5)).toBe(84500);
        });

        it('should handle negative discount as no discount', () => {
            expect(service.calculateDiscountedPrice(100000, -10)).toBe(100000);
        });
    });

    describe('ProductService class', () => {
        it('should be instantiable', () => {
            expect(service).toBeInstanceOf(ProductService);
        });

        it('should have all required methods', () => {
            const methods = [
                'getById',
                'findByName',
                'getByShop',
                'checkStock',
                'updateStock',
                'getLowStock',
                'calculateDiscountedPrice',
            ];
            methods.forEach(method => {
                expect(typeof (service as any)[method]).toBe('function');
            });
        });
    });
});
