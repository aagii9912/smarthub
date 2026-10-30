import { Sparkles } from 'lucide-react';
import type { IndustryPack } from '../types';
import { formatServiceItems, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const beautyPack: IndustryPack = {
    id: 'beauty',
    meta: {
        label: 'Гоо сайхан',
        description: 'Салон, спа, гоо сайхны үйлчилгээ',
        icon: Sparkles,
        productNoun: 'Үйлчилгээ',
        productNounSingular: 'Үйлчилгээ',
        hasOperations: true,
        aiTemplate: 'beauty',
        accentClass: 'bg-pink-100 text-pink-600',
    },
    archetype: 'booking',
    blocks: { commerce: false, booking: true, lead: false },
    operations: {
        title: 'Салоны тохиргоо',
        subtitle: 'Салоны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'staff_count',
                label: 'Ажилтан/мэргэжилтэн тоо',
                type: 'number',
                min: 0,
                max: 100,
                placeholder: '2',
            },
            {
                key: 'salon_address',
                label: 'Салоны хаяг',
                type: 'text',
                placeholder: 'Жишээ: ХУД 11-р хороо...',
            },
            {
                key: 'services_at_home',
                label: 'Гэрт нь очиж үйлчилдэг үү?',
                type: 'boolean',
            },
            {
                key: 'default_duration_minutes',
                label: 'Үйлчилгээний дундаж хугацаа (минут)',
                type: 'number',
                min: 0,
                max: 600,
                placeholder: '45',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'booking', defaultCapabilities: ['booking', 'information'] },
    prompt: {
        sectionLabel: 'САЛОНЫ МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const staff = pickNumber(data, 'staff_count');
            if (staff !== null && staff > 0) lines.push(`• Мэргэжилтний тоо: ${staff}`);
            const address = pickString(data, 'salon_address');
            if (address) lines.push(`• Салоны хаяг: ${address}`);
            const home = pickBoolean(data, 'services_at_home');
            if (home === true) lines.push('• Гэрт нь очиж үйлчилдэг');
            const duration = pickNumber(data, 'default_duration_minutes');
            if (duration !== null && duration > 0) lines.push(`• Үйлчилгээний дундаж үргэлжлэх хугацаа: ${duration} минут`);
            const items = formatServiceItems(data['service_menu']);
            if (items.length > 0) lines.push(`• Үйлчилгээний жагсаалт: ${items.join('; ')}`);
            const specialists = data['specialist_list'];
            if (Array.isArray(specialists) && specialists.length > 0) {
                const names = specialists
                    .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
                    .map(s => {
                        const name = typeof s.name === 'string' ? s.name : '';
                        const specialty = typeof s.specialty === 'string' ? s.specialty : '';
                        return name && specialty ? `${name} - ${specialty}` : name;
                    })
                    .filter(Boolean);
                if (names.length > 0) lines.push(`• Мэргэжилтнүүд: ${names.join(', ')}`);
            }
            const walkIn = pickBoolean(data, 'walk_in_accepted');
            if (walkIn === true) lines.push('• Урьдчилсан захиалгагүй ирж болно');
            else if (walkIn === false) lines.push('• Зөвхөн урьдчилсан захиалгаар үйлчилнэ');
            const aftercare = pickString(data, 'aftercare_instructions');
            if (aftercare) lines.push(`• Үйлчилгээний дараах зөвлөгөө: ${aftercare}`);
            return lines;
        },
    },
};
