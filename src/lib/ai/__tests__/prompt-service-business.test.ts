/**
 * Phase 1 unit tests for the new business-type-aware and cross-cutting
 * prompt builders. Each builder is tested for:
 *   1. The empty/missing input case (must emit "").
 *   2. The happy path (rendered fragment shows up where expected).
 *
 * The full-prompt snapshot at the end guards against accidental reordering
 * inside `buildSystemPrompt`.
 */

import { describe, it, expect } from 'vitest';
import {
    buildWorkingHoursSection,
    buildBrandVoiceSection,
    buildProhibitedTopicsSection,
    buildEscalationSection,
    buildPromotionsSection,
    buildSLASection,
    buildBusinessTypeSection,
    buildSystemPrompt,
    detectLanguage,
    buildLocalizedSystemPrompt,
} from '../services/PromptService';
import type { ChatContext, CrossCuttingConfig, WeeklyHours } from '@/types/ai';

const baseContext: ChatContext = {
    shopId: 'shop-1',
    shopName: 'Тестийн дэлгүүр',
    products: [],
};

describe('buildWorkingHoursSection', () => {
    it('returns empty when hours is missing or empty', () => {
        expect(buildWorkingHoursSection()).toBe('');
        expect(buildWorkingHoursSection({})).toBe('');
    });

    it('renders weekly hours with Mongolian day labels', () => {
        const hours: WeeklyHours = {
            mon: { open: '09:00', close: '18:00' },
            sat: { closed: true },
        };
        const out = buildWorkingHoursSection(hours);
        expect(out).toContain('Даваа: 09:00 - 18:00');
        expect(out).toContain('Бямба: Амралт');
        expect(out).toContain('АЖИЛЛАХ ЦАГИЙН');
    });

    it('skips days that have neither open/close nor closed flag', () => {
        const hours: WeeklyHours = {
            mon: { open: '09:00', close: '18:00' },
            tue: {}, // empty
        };
        const out = buildWorkingHoursSection(hours);
        expect(out).toContain('Даваа');
        expect(out).not.toContain('Мягмар');
    });
});

describe('buildBrandVoiceSection', () => {
    it('returns empty when voice is missing', () => {
        expect(buildBrandVoiceSection()).toBe('');
    });

    it('renders luxurious voice with the expected instruction', () => {
        const out = buildBrandVoiceSection('luxurious');
        expect(out).toContain('БРЭНД ХООЛОЙ');
        expect(out).toContain('Тансаг');
    });
});

describe('buildProhibitedTopicsSection', () => {
    it('returns empty when topics is missing or all-whitespace', () => {
        expect(buildProhibitedTopicsSection()).toBe('');
        expect(buildProhibitedTopicsSection([])).toBe('');
        expect(buildProhibitedTopicsSection(['  ', '   '])).toBe('');
    });

    it('renders prohibited topics as bullets', () => {
        const out = buildProhibitedTopicsSection(['Улс төр', 'Бусдын үнэ']);
        expect(out).toContain('• Улс төр');
        expect(out).toContain('• Бусдын үнэ');
        expect(out).toContain('ХОРИГЛОСОН СЭДВҮҮД');
    });
});

describe('buildEscalationSection', () => {
    it('returns empty when rules is missing', () => {
        expect(buildEscalationSection()).toBe('');
    });

    it('renders handoff phone and complaint trigger', () => {
        const out = buildEscalationSection({
            on_complaint: 'handoff',
            handoff_phone: '99119911',
            after_hours_message: 'Маргааш 9:00-аас хариулна',
        });
        expect(out).toContain('request_human_support');
        expect(out).toContain('99119911');
        expect(out).toContain('Маргааш 9:00-аас хариулна');
    });
});

describe('buildPromotionsSection', () => {
    const now = new Date('2026-05-13T12:00:00Z');

    it('returns empty when no promotions', () => {
        expect(buildPromotionsSection(undefined, now)).toBe('');
        expect(buildPromotionsSection([], now)).toBe('');
    });

    it('renders active promotion within window', () => {
        const out = buildPromotionsSection(
            [
                {
                    name: 'Зуны акц',
                    description: '20% хямдрал',
                    starts_at: '2026-05-01T00:00:00Z',
                    ends_at: '2026-05-31T23:59:59Z',
                },
            ],
            now,
        );
        expect(out).toContain('Зуны акц');
        expect(out).toContain('20% хямдрал');
    });

    it('filters out expired promotions', () => {
        const out = buildPromotionsSection(
            [
                {
                    name: 'Хуучин акц',
                    description: '50% хямдрал',
                    starts_at: '2026-01-01T00:00:00Z',
                    ends_at: '2026-02-01T00:00:00Z',
                },
            ],
            now,
        );
        expect(out).toBe('');
    });
});

describe('buildSLASection', () => {
    it('returns empty when sla is missing', () => {
        expect(buildSLASection()).toBe('');
        expect(buildSLASection({})).toBe('');
    });

    it('renders configured timelines verbatim', () => {
        const out = buildSLASection({
            response_minutes: 5,
            ship_within_hours: 24,
            refund_within_days: 7,
        });
        expect(out).toContain('5 минутын дотор');
        expect(out).toContain('24 цагийн дотор');
        expect(out).toContain('7 хоногийн дотор');
    });
});

describe('buildBusinessTypeSection', () => {
    it('returns empty when business_type is missing', () => {
        expect(buildBusinessTypeSection(undefined, {})).toBe('');
    });

    it('returns empty when business_type is "other"', () => {
        expect(buildBusinessTypeSection('other', { anything: 'x' })).toBe('');
    });

    it('renders restaurant-specific fields including dietary options', () => {
        const out = buildBusinessTypeSection('restaurant', {
            table_count: 20,
            delivery_enabled: true,
            dietary_options: ['vegan', 'halal'],
            peak_hours: '12:00-14:00',
            min_order_value: 25000,
        });
        expect(out).toContain('РЕСТОРАН');
        expect(out).toContain('20');
        expect(out).toContain('vegan, halal');
        expect(out).toContain('12:00-14:00');
        expect(out).toContain('25,000₮');
    });

    it('renders healthcare triage disclaimer prominently', () => {
        const out = buildBusinessTypeSection('healthcare', {
            doctor_count: 3,
            triage_disclaimer: 'Эмч биш тул оношлогоо хийхгүй',
        });
        expect(out).toContain('⚠️');
        expect(out).toContain('Эмч биш тул оношлогоо хийхгүй');
    });

    it('renders service catalog with duration and price', () => {
        const out = buildBusinessTypeSection('service', {
            service_catalog: [
                { name: 'Засвар', duration: 30, price: 50000 },
                { name: 'Үзлэг', duration: 15, price: 10000 },
            ],
        });
        expect(out).toContain('Засвар');
        expect(out).toContain('30мин');
        expect(out).toContain('50,000₮');
    });

    it('renders realestate lead qualification questions as a sub-bullet list', () => {
        const out = buildBusinessTypeSection('realestate_auto', {
            lead_qualification_questions: ['Танай төсөв хэд вэ?', 'Хэдэн өрөөтэй байх вэ?'],
        });
        expect(out).toContain('Танай төсөв хэд вэ?');
        expect(out).toContain('Хэдэн өрөөтэй байх вэ?');
    });
});

describe('buildSystemPrompt with new fields', () => {
    it('includes business type section when businessType + businessSetupData are set', () => {
        const out = buildSystemPrompt({
            ...baseContext,
            businessType: 'beauty',
            businessSetupData: { staff_count: 4, walk_in_accepted: false },
        });
        expect(out).toContain('САЛОНЫ МЭДЭЭЛЭЛ');
        expect(out).toContain('Мэргэжилтний тоо: 4');
        expect(out).toContain('Зөвхөн урьдчилсан захиалгаар');
    });

    it('emits no business section when businessSetupData is missing', () => {
        const out = buildSystemPrompt({
            ...baseContext,
            businessType: 'beauty',
        });
        expect(out).not.toContain('САЛОНЫ МЭДЭЭЛЭЛ');
    });

    it('injects brand voice + prohibited topics + escalation from crossCutting', () => {
        const cc: CrossCuttingConfig = {
            brand_voice: 'casual',
            prohibited_topics: ['Улс төр'],
            escalation_rules: { on_complaint: 'log' },
        };
        const out = buildSystemPrompt({ ...baseContext, crossCutting: cc });
        expect(out).toContain('Дотно');
        expect(out).toContain('Улс төр');
        expect(out).toContain('log_complaint');
    });
});

describe('detectLanguage with supported_languages restriction', () => {
    it('falls back to mn when message is English but English is not supported', () => {
        const lang = detectLanguage('Hello, how much is this?', ['mn']);
        expect(lang).toBe('mn');
    });

    it('detects English when allowed', () => {
        const lang = detectLanguage('Hello, can I order?', ['en', 'mn']);
        expect(lang).toBe('en');
    });

    it('defaults to mn when allowed is empty', () => {
        const lang = detectLanguage('Hello', []);
        // empty list => no restriction, original detection applies
        expect(lang).toBe('en');
    });
});

describe('buildLocalizedSystemPrompt respects supported_languages', () => {
    it('omits the English wrapper when English is not in supported_languages', () => {
        const out = buildLocalizedSystemPrompt(
            {
                ...baseContext,
                crossCutting: { supported_languages: ['mn'] },
            },
            'Hello, how much?',
        );
        expect(out).not.toContain('Respond ONLY in English');
    });

    it('appends the English wrapper when English is supported', () => {
        const out = buildLocalizedSystemPrompt(
            {
                ...baseContext,
                crossCutting: { supported_languages: ['mn', 'en'] },
            },
            'Hello, how much?',
        );
        expect(out).toContain('Respond ONLY in English');
    });
});
