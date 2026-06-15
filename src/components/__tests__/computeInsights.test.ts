import { describe, it, expect } from 'vitest';
import { computeInsights, type InsightInput } from '../dashboard/SmartInsights';

function base(overrides: Partial<InsightInput['revenue']> = {}): InsightInput {
    return {
        bestSellers: [],
        chartData: [],
        period: 'month',
        revenue: {
            total: 1_000_000,
            growth: 0,
            orderCount: 10,
            avgOrderValue: 100_000,
            prevPeriodTotal: 1_000_000,
            unpaidTotal: 0,
            ...overrides,
        },
    };
}

describe('computeInsights', () => {
    it('returns insights sorted by priority (highest first)', () => {
        const out = computeInsights(base({ growth: 30 }));
        for (let i = 1; i < out.length; i++) {
            expect(out[i - 1].priority).toBeGreaterThanOrEqual(out[i].priority);
        }
    });

    it('flags strong growth as success', () => {
        const out = computeInsights(base({ growth: 30, prevPeriodTotal: 700_000 }));
        expect(out.some((i) => i.type === 'success')).toBe(true);
    });

    it('flags a decline as warning', () => {
        const out = computeInsights(base({ growth: -25, prevPeriodTotal: 1_300_000 }));
        expect(out.some((i) => i.type === 'warning')).toBe(true);
    });

    it('warns when unpaid exposure exceeds 15% of paid revenue', () => {
        const out = computeInsights(base({ total: 1_000_000, unpaidTotal: 400_000 }));
        const unpaid = out.find((i) => i.message.includes('Төлбөр хүлээгдэж буй'));
        expect(unpaid).toBeDefined();
        expect(unpaid?.type).toBe('warning');
    });

    it('does NOT emit a period-over-period delta when prevPeriodTotal is 0', () => {
        const out = computeInsights(base({ prevPeriodTotal: 0, total: 500_000 }));
        expect(out.some((i) => i.message.includes('Өмнөх үетэй харьцуулахад'))).toBe(false);
    });

    it('surfaces a top-product concentration insight above 40%', () => {
        const out = computeInsights({
            ...base(),
            bestSellers: [{ name: 'Гутал', quantity: 50, revenue: 600_000, percent: 60 }],
        });
        expect(out.some((i) => i.message.includes('Гутал'))).toBe(true);
    });

    it('always returns at least one insight (fallback)', () => {
        const out = computeInsights(base());
        expect(out.length).toBeGreaterThan(0);
    });
});
