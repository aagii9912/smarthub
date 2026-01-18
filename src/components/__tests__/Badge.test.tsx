/**
 * Badge Component Tests
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, OrderStatusBadge } from '../ui/Badge';

describe('Badge', () => {
    describe('렌더링', () => {
        it('renders children correctly', () => {
            render(<Badge>Test Badge</Badge>);
            expect(screen.getByText('Test Badge')).toBeInTheDocument();
        });

        it('renders as a span element', () => {
            render(<Badge>Badge</Badge>);
            const badge = screen.getByText('Badge');
            expect(badge.tagName).toBe('SPAN');
        });
    });

    describe('Variants', () => {
        it('applies default variant styling', () => {
            render(<Badge variant="default">Default</Badge>);
            const badge = screen.getByText('Default');
            expect(badge.className).toContain('bg-secondary');
        });

        it('applies success variant styling', () => {
            render(<Badge variant="success">Success</Badge>);
            const badge = screen.getByText('Success');
            expect(badge.className).toContain('bg-emerald-500/10');
            expect(badge.className).toContain('text-emerald-600');
        });

        it('applies warning variant styling', () => {
            render(<Badge variant="warning">Warning</Badge>);
            const badge = screen.getByText('Warning');
            expect(badge.className).toContain('bg-amber-500/10');
            expect(badge.className).toContain('text-amber-600');
        });

        it('applies danger variant styling', () => {
            render(<Badge variant="danger">Danger</Badge>);
            const badge = screen.getByText('Danger');
            expect(badge.className).toContain('bg-destructive/10');
            expect(badge.className).toContain('text-destructive');
        });

        it('applies info variant styling', () => {
            render(<Badge variant="info">Info</Badge>);
            const badge = screen.getByText('Info');
            expect(badge.className).toContain('bg-blue-500/10');
            expect(badge.className).toContain('text-blue-600');
        });

        it('applies vip variant styling', () => {
            render(<Badge variant="vip">VIP</Badge>);
            const badge = screen.getByText('VIP');
            expect(badge.className).toContain('bg-gradient-to-r');
            expect(badge.className).toContain('text-white');
        });
    });

    describe('Sizes', () => {
        it('applies sm size by default', () => {
            render(<Badge>Small</Badge>);
            const badge = screen.getByText('Small');
            expect(badge.className).toContain('px-2');
            expect(badge.className).toContain('text-xs');
        });

        it('applies md size', () => {
            render(<Badge size="md">Medium</Badge>);
            const badge = screen.getByText('Medium');
            expect(badge.className).toContain('px-3');
            expect(badge.className).toContain('text-sm');
        });
    });

    describe('Custom className', () => {
        it('accepts custom className', () => {
            render(<Badge className="custom-class">Custom</Badge>);
            const badge = screen.getByText('Custom');
            expect(badge.className).toContain('custom-class');
        });
    });

    describe('Common styles', () => {
        it('has rounded-full class', () => {
            render(<Badge>Round</Badge>);
            const badge = screen.getByText('Round');
            expect(badge.className).toContain('rounded-full');
        });

        it('has font-medium class', () => {
            render(<Badge>Font</Badge>);
            const badge = screen.getByText('Font');
            expect(badge.className).toContain('font-medium');
        });

        it('has inline-flex class', () => {
            render(<Badge>Flex</Badge>);
            const badge = screen.getByText('Flex');
            expect(badge.className).toContain('inline-flex');
        });
    });
});

describe('OrderStatusBadge', () => {
    describe('Order Status Mapping', () => {
        it('renders pending status correctly', () => {
            render(<OrderStatusBadge status="pending" />);
            expect(screen.getByText('Хүлээгдэж буй')).toBeInTheDocument();
        });

        it('renders confirmed status correctly', () => {
            render(<OrderStatusBadge status="confirmed" />);
            expect(screen.getByText('Баталгаажсан')).toBeInTheDocument();
        });

        it('renders processing status correctly', () => {
            render(<OrderStatusBadge status="processing" />);
            expect(screen.getByText('Бэлтгэж буй')).toBeInTheDocument();
        });

        it('renders shipped status correctly', () => {
            render(<OrderStatusBadge status="shipped" />);
            expect(screen.getByText('Илгээсэн')).toBeInTheDocument();
        });

        it('renders delivered status correctly', () => {
            render(<OrderStatusBadge status="delivered" />);
            expect(screen.getByText('Хүргэгдсэн')).toBeInTheDocument();
        });

        it('renders cancelled status correctly', () => {
            render(<OrderStatusBadge status="cancelled" />);
            expect(screen.getByText('Цуцлагдсан')).toBeInTheDocument();
        });

        it('renders unknown status as-is', () => {
            render(<OrderStatusBadge status="unknown_status" />);
            expect(screen.getByText('unknown_status')).toBeInTheDocument();
        });
    });

    describe('Variant Colors', () => {
        it('uses warning variant for pending', () => {
            render(<OrderStatusBadge status="pending" />);
            const badge = screen.getByText('Хүлээгдэж буй');
            expect(badge.className).toContain('bg-amber-500/10');
        });

        it('uses info variant for confirmed', () => {
            render(<OrderStatusBadge status="confirmed" />);
            const badge = screen.getByText('Баталгаажсан');
            expect(badge.className).toContain('bg-blue-500/10');
        });

        it('uses success variant for delivered', () => {
            render(<OrderStatusBadge status="delivered" />);
            const badge = screen.getByText('Хүргэгдсэн');
            expect(badge.className).toContain('bg-emerald-500/10');
        });

        it('uses danger variant for cancelled', () => {
            render(<OrderStatusBadge status="cancelled" />);
            const badge = screen.getByText('Цуцлагдсан');
            expect(badge.className).toContain('bg-destructive/10');
        });
    });
});
