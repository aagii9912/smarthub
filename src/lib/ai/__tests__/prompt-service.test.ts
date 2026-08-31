import { describe, it, expect } from 'vitest';
import {
    buildProductsInfo,
    buildCustomInstructions,
    buildDynamicKnowledge,
    buildPoliciesInfo,
    buildCartContext,
    buildFAQSection,
    buildSloganSection,
    buildSystemPrompt,
    buildResponseStyleSection,
} from '../services/PromptService';
import { getRoleTitle, getRoleGoalLine } from '../agents/registry';
import type { ChatContext } from '@/types/ai';

describe('PromptService', () => {
    describe('buildProductsInfo', () => {
        it('returns empty message for no products', () => {
            const result = buildProductsInfo([]);
            expect(result).toContain('бүртгэгдээгүй');
        });

        it('formats physical product correctly', () => {
            const products = [{
                id: '1',
                name: 'Test Product',
                price: 50000,
                stock: 10,
                type: 'product' as const,
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('[БАРАА]');
            expect(result).toContain('Test Product');
            expect(result).toContain('50,000₮');
            expect(result).toContain('10');
        });

        it('formats service correctly', () => {
            const products = [{
                id: '1',
                name: 'Haircut',
                price: 20000,
                stock: 5,
                type: 'service' as const,
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('[ҮЙЛЧИЛГЭЭ]');
            expect(result).toContain('Haircut');
        });

        it('shows discount price correctly', () => {
            const products = [{
                id: '1',
                name: 'Sale Item',
                price: 100000,
                stock: 5,
                discount_percent: 20,
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('🔥');
            expect(result).toContain('80,000₮');
            expect(result).toContain('-20%');
            expect(result).toContain('ХЯМДРАЛ');
        });

        it('shows out of stock status', () => {
            const products = [{
                id: '1',
                name: 'Empty Item',
                price: 50000,
                stock: 0,
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('Дууссан');
        });

        it('calculates available stock with reserved', () => {
            const products = [{
                id: '1',
                name: 'Reserved Item',
                price: 50000,
                stock: 10,
                reserved_stock: 7,
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('3'); // 10 - 7 = 3 available
        });

        it('includes variants info', () => {
            const products = [{
                id: '1',
                name: 'Shirt',
                price: 50000,
                stock: 10,
                variants: [
                    { color: 'Хар', size: 'M', stock: 5 },
                    { color: 'Цагаан', size: 'L', stock: 3 },
                ],
            }];
            const result = buildProductsInfo(products);
            expect(result).toContain('Хувилбарууд');
            expect(result).toContain('Хар');
            expect(result).toContain('Цагаан');
        });

        // Үл хөдлөх / авто зарт нөөц гэж байхгүй. stock=null → availableStock 0
        // болж, AI байр бүрийг "Дууссан" гэж танилцуулдаг байсан.
        describe('listing catalog (realestate_auto)', () => {
            const listing = [{
                id: '1',
                name: 'ХУД 2 өрөө байр',
                price: 250000000,
                stock: null as unknown as number,
            }];

            it('never calls a listing sold out', () => {
                const result = buildProductsInfo(listing, 'realestate_auto');
                expect(result).toContain('[ЗАР]');
                expect(result).toContain('ХУД 2 өрөө байр');
                expect(result).toContain('250,000,000₮');
                expect(result).not.toContain('Дууссан');
                expect(result).not.toContain('ширхэг');
            });

            it('does not promise delivery on a property', () => {
                const result = buildProductsInfo(listing, 'realestate_auto');
                expect(result).not.toContain('Хүргэлт');
            });

            it('renders a 0 price as negotiable rather than free', () => {
                const result = buildProductsInfo(
                    [{ id: '2', name: 'Гэр хороолол байшин', price: 0, stock: null as unknown as number }],
                    'realestate_auto',
                );
                expect(result).toContain('Үнэ тохиролцоно');
                expect(result).not.toContain('0₮');
            });

            it('gives the AI the structured facts a buyer asks about', () => {
                const result = buildProductsInfo(
                    [{
                        id: '3',
                        name: 'Зайсан 2 өрөө',
                        price: 250000000,
                        stock: null as unknown as number,
                        attributes: {
                            kind: 'realestate',
                            rooms: 2,
                            area_m2: 78,
                            district: 'ХУД',
                            floor: 5,
                            total_floors: 12,
                        },
                    }],
                    'realestate_auto',
                );
                expect(result).toContain('Өрөөний тоо: 2');
                expect(result).toContain('Талбай: 78 м²');
                expect(result).toContain('Дүүрэг / хот: ХУД');
                expect(result).toContain('Давхар: 5 / 12');
            });

            it('renders a listing with no attributes as a plain line', () => {
                const result = buildProductsInfo(
                    [{ id: '4', name: 'Гараж', price: 30000000, stock: null as unknown as number, attributes: {} }],
                    'realestate_auto',
                );
                expect(result).toContain('[ЗАР] Гараж');
                expect(result).not.toContain('Өрөөний тоо');
            });

            it('leaves the commerce rendering untouched without a business type', () => {
                const result = buildProductsInfo([{ id: '1', name: 'Цүнх', price: 50000, stock: 0 }]);
                expect(result).toContain('[БАРАА]');
                expect(result).toContain('Дууссан');
                expect(result).toContain('Хүргэлт');
            });
        });
    });

    describe('buildCustomInstructions', () => {
        it('returns empty for no instructions', () => {
            expect(buildCustomInstructions()).toBe('');
            expect(buildCustomInstructions('')).toBe('');
        });

        it('formats instructions correctly', () => {
            const result = buildCustomInstructions('Be very friendly');
            expect(result).toContain('ДЭЛГҮҮРИЙН ЭЗНИЙ');
            expect(result).toContain('ЗААВАР');
            expect(result).toContain('Be very friendly');
        });
    });

    describe('buildDynamicKnowledge', () => {
        it('returns empty for no knowledge', () => {
            expect(buildDynamicKnowledge()).toBe('');
            expect(buildDynamicKnowledge({})).toBe('');
        });

        it('formats knowledge correctly', () => {
            const knowledge = {
                'Ажлын цаг': '09:00-18:00',
                'Утас': '99001122',
            };
            const result = buildDynamicKnowledge(knowledge);
            expect(result).toContain('ТУСГАЙ МЭДЭЭЛЭЛ');
            expect(result).toContain('Ажлын цаг');
            expect(result).toContain('09:00-18:00');
        });
    });

    describe('buildPoliciesInfo', () => {
        it('returns empty for no policies', () => {
            expect(buildPoliciesInfo()).toBe('');
        });

        it('formats policies correctly', () => {
            const policies = {
                shipping_threshold: 50000,
                payment_methods: ['Cash', 'QPay'],
                delivery_areas: ['UB', 'Darkhan'],
            };
            const result = buildPoliciesInfo(policies);
            expect(result).toContain('БОДЛОГО');
            expect(result).toContain('50,000');
            expect(result).toContain('Cash, QPay');
            expect(result).toContain('UB, Darkhan');
        });
    });

    describe('buildCartContext', () => {
        it('shows empty cart message', () => {
            const result = buildCartContext();
            expect(result).toContain('Хоосон');
        });

        it('formats cart items correctly', () => {
            const cart = {
                id: 'cart1',
                items: [
                    { id: '1', product_id: 'p1', name: 'Product A', variant_specs: {}, quantity: 2, unit_price: 10000 },
                ],
                total_amount: 20000,
            };
            const result = buildCartContext(cart, 50000);
            expect(result).toContain('Product A');
            expect(result).toContain('x2');
            expect(result).toContain('20,000₮');
        });

        it('shows free shipping eligibility', () => {
            const cart = {
                id: 'cart1',
                items: [{ id: '1', product_id: 'p1', name: 'Expensive', variant_specs: {}, quantity: 1, unit_price: 100000 }],
                total_amount: 100000,
            };
            const result = buildCartContext(cart, 50000);
            expect(result).toContain('✅');
            expect(result).toContain('үнэгүй');
        });
    });

    describe('buildFAQSection', () => {
        it('returns empty for no FAQs', () => {
            expect(buildFAQSection()).toBe('');
            expect(buildFAQSection([])).toBe('');
        });

        it('formats FAQs correctly', () => {
            const faqs = [
                { question: 'How to order?', answer: 'Just message us' },
            ];
            const result = buildFAQSection(faqs);
            expect(result).toContain('FAQ');
            expect(result).toContain('Q: How to order?');
            expect(result).toContain('A: Just message us');
        });
    });

    describe('buildSloganSection', () => {
        it('returns empty for no slogans', () => {
            expect(buildSloganSection()).toBe('');
            expect(buildSloganSection([])).toBe('');
        });

        it('formats slogan correctly', () => {
            const slogans = [{ slogan: 'Best prices!', usage_context: 'greeting' }];
            const result = buildSloganSection(slogans);
            expect(result).toContain('БРЭНД ХЭЛЛЭГ');
            expect(result).toContain('Best prices!');
        });
    });

    describe('buildSystemPrompt', () => {
        it('builds complete system prompt', () => {
            const context: ChatContext = {
                shopId: 'shop1',
                shopName: 'Test Shop',
                products: [],
            };
            const result = buildSystemPrompt(context);

            expect(result).toContain('Test Shop');
            // Opening line + goal now come from the sales role in the agent
            // registry (buildRolePromptRules), not the legacy basicRules block.
            expect(result).toContain(getRoleTitle('sales'));
            expect(result).toContain(getRoleGoalLine('sales'));
            // Rule markers emitted by the role registry's sales rules.
            expect(result).toContain('ЧУХАЛ ДҮРЭМ');
            expect(result).toContain('ХЯЗГААРЛАЛТ');
        });

        it('includes customer info when provided', () => {
            const context: ChatContext = {
                shopId: 'shop1',
                shopName: 'Test Shop',
                products: [],
                customerName: 'Bat',
                orderHistory: 5,
            };
            const result = buildSystemPrompt(context);

            expect(result).toContain('Bat');
            // Customer info format matches PromptService output
            expect(result).toContain('ХЭРЭГЛЭГЧ: Bat');
        });

        it('applies emotion style', () => {
            const context: ChatContext = {
                shopId: 'shop1',
                shopName: 'Test Shop',
                products: [],
                aiEmotion: 'enthusiastic',
            };
            const result = buildSystemPrompt(context);

            expect(result).toContain('урам зоригтой');
        });

        it('injects owner reply-style controls (assertive / short / no emoji)', () => {
            const context: ChatContext = {
                shopId: 'shop1',
                shopName: 'Test Shop',
                products: [],
                crossCutting: {
                    sales_assertiveness: 'assertive',
                    response_length: 'short',
                    emoji_usage: 'none',
                },
            };
            const result = buildSystemPrompt(context);

            expect(result).toContain('ХАРИУЛТЫН ХЭВ МАЯГ');
            expect(result).toContain('ШУЛУУХАН');
            expect(result).toContain('БОГИНО');
            expect(result).toContain('ОГТ ҮГҮЙ');
        });
    });

    describe('buildResponseStyleSection', () => {
        it('returns empty when nothing is configured', () => {
            expect(buildResponseStyleSection()).toBe('');
            expect(buildResponseStyleSection({})).toBe('');
        });

        it('renders the assertive directive against an over-soft AI', () => {
            const result = buildResponseStyleSection({ sales_assertiveness: 'assertive' });
            expect(result).toContain('ХАРИУЛТЫН ХЭВ МАЯГ');
            expect(result).toContain('Шулуун зан');
            expect(result).toContain('ИДЭВХТЭЙ');
        });

        it('only includes the knobs that are set', () => {
            const result = buildResponseStyleSection({ response_length: 'long' });
            expect(result).toContain('ДЭЛГЭРЭНГҮЙ');
            expect(result).not.toContain('Шулуун зан');
            expect(result).not.toContain('Emoji');
        });
    });
});
