import { Building2 } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickNumber, pickString } from '../setup-helpers';

export const realestateAutoPack: IndustryPack = {
    id: 'realestate_auto',
    meta: {
        label: 'Үл хөдлөх / Авто',
        description: 'Үл хөдлөх хөрөнгө, автомашин зарах бизнес',
        icon: Building2,
        productNoun: 'Зар',
        productNounSingular: 'Зар',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-amber-100 text-amber-600',
    },
    archetype: 'lead',
    blocks: { commerce: false, booking: false, lead: true },
    operations: {
        title: 'Үл хөдлөх / Автоны тохиргоо',
        subtitle: 'Үйл ажиллагааны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'category',
                label: 'Чиглэл',
                type: 'radio',
                options: [
                    { value: 'realestate', label: 'Үл хөдлөх' },
                    { value: 'auto', label: 'Авто' },
                    { value: 'both', label: 'Хоёулаа' },
                ],
            },
            {
                key: 'agent_count',
                label: 'Менежерийн тоо',
                type: 'number',
                min: 0,
                max: 500,
                placeholder: '3',
            },
            {
                key: 'service_areas',
                label: 'Үйлчилгээний бүс',
                type: 'text',
                placeholder: 'УБ, Дархан...',
            },
        ],
    },
    // Нэг байр бол нэг л байр: үлдэгдэл, хүргэлт байхгүй.
    catalog: { mode: 'listing' },
    ai: { defaultRole: 'hybrid', defaultCapabilities: ['lead_capture', 'information'] },
    prompt: {
        sectionLabel: 'ҮЛ ХӨДЛӨХ / АВТО МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const category = pickString(data, 'category');
            if (category === 'realestate') lines.push('• Чиглэл: Үл хөдлөх хөрөнгө');
            else if (category === 'auto') lines.push('• Чиглэл: Автомашин');
            else if (category === 'both') lines.push('• Чиглэл: Үл хөдлөх + Автомашин');
            const agents = pickNumber(data, 'agent_count');
            if (agents !== null && agents > 0) lines.push(`• Менежерийн тоо: ${agents}`);
            const areas = pickArray(data, 'service_areas');
            if (areas.length > 0) lines.push(`• Үйлчилгээний бүс: ${areas.join(', ')}`);
            const types = pickArray(data, 'listing_types');
            if (types.length > 0) lines.push(`• Зарын төрлүүд: ${types.join(', ')}`);
            const financing = pickString(data, 'financing_partners');
            if (financing) lines.push(`• Санхүүгийн түнш: ${financing}`);
            const inspection = pickString(data, 'inspection_policy');
            if (inspection) lines.push(`• Үзлэгийн бодлого: ${inspection}`);
            const questions = pickArray(data, 'lead_qualification_questions');
            if (questions.length > 0) {
                lines.push('• Lead шалгах асуултууд (хэрэглэгчээс заавал асуу):');
                for (const q of questions) {
                    lines.push(`  - ${q}`);
                }
            }
            return lines;
        },
    },
};
