import { Calendar } from 'lucide-react';
import type { IndustryPack } from '../types';
import { formatServiceItems, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const servicePack: IndustryPack = {
    id: 'service',
    meta: {
        label: 'Үйлчилгээ',
        description: 'Цаг захиалгат үйлчилгээ (засвар, сургалт г.м.)',
        icon: Calendar,
        productNoun: 'Үйлчилгээ',
        productNounSingular: 'Үйлчилгээ',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-blue-100 text-blue-600',
    },
    archetype: 'booking',
    blocks: { commerce: false, booking: true, lead: false },
    operations: {
        title: 'Үйлчилгээний тохиргоо',
        subtitle: 'Үйл ажиллагааны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'staff_count',
                label: 'Ажилтны тоо',
                type: 'number',
                min: 0,
                max: 1000,
                placeholder: '3',
            },
            {
                key: 'default_duration_minutes',
                label: 'Үйлчилгээний дундаж хугацаа (минут)',
                type: 'number',
                min: 0,
                max: 600,
                placeholder: '60',
            },
            {
                key: 'booking_method',
                label: 'Захиалга авах хэлбэр',
                type: 'radio',
                options: [
                    { value: 'manual', label: 'Гараар (мессеж дамжуулан)' },
                    { value: 'calendar', label: 'Календар системээр' },
                ],
            },
            {
                key: 'business_hours',
                label: 'Ажиллах цаг',
                type: 'text',
                placeholder: 'Ня-Ба: 09:00 - 18:00',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'booking', defaultCapabilities: ['booking', 'information'] },
    prompt: {
        sectionLabel: 'ҮЙЛЧИЛГЭЭНИЙ МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const staff = pickNumber(data, 'staff_count');
            if (staff !== null && staff > 0) lines.push(`• Ажилтны тоо: ${staff}`);
            const duration = pickNumber(data, 'default_duration_minutes');
            if (duration !== null && duration > 0) lines.push(`• Үйлчилгээний дундаж үргэлжлэх хугацаа: ${duration} минут`);
            const booking = pickString(data, 'booking_method');
            if (booking === 'manual') lines.push('• Захиалгыг мессежээр гараар авдаг');
            else if (booking === 'calendar') lines.push('• Захиалгыг календар системээр авдаг');
            const hours = pickString(data, 'business_hours');
            if (hours) lines.push(`• Ажиллах цаг: ${hours}`);
            const items = formatServiceItems(data['service_catalog']);
            if (items.length > 0) lines.push(`• Үйлчилгээний жагсаалт: ${items.join('; ')}`);
            const cancel = pickString(data, 'cancellation_policy');
            if (cancel) lines.push(`• Захиалга цуцлах бодлого: ${cancel}`);
            const advance = pickNumber(data, 'advance_booking_days');
            if (advance !== null && advance > 0) lines.push(`• Урьдчилан захиалах боломжтой: ${advance} хоног`);
            const deposit = pickBoolean(data, 'requires_deposit');
            if (deposit === true) lines.push('• Захиалга баталгаажуулахад урьдчилгаа төлбөр шаардлагатай');
            const home = pickBoolean(data, 'home_visit_enabled');
            if (home === true) lines.push('• Гэрт нь очиж үйлчилдэг');
            return lines;
        },
    },
};
