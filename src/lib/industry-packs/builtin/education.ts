import { GraduationCap } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const educationPack: IndustryPack = {
    id: 'education',
    meta: {
        label: 'Боловсрол',
        description: 'Сургалт, курс, боловсролын байгууллага',
        icon: GraduationCap,
        productNoun: 'Сургалт',
        productNounSingular: 'Сургалт',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-indigo-100 text-indigo-600',
    },
    archetype: 'lead',
    blocks: { commerce: false, booking: false, lead: true },
    operations: {
        title: 'Сургалтын төвийн тохиргоо',
        subtitle: 'Үйл ажиллагааны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'course_types',
                label: 'Сургалтын төрлүүд',
                type: 'text',
                placeholder: 'Хэлний сургалт, програмчлал...',
                helpText: 'Таслалаар тусгаарлан бичээрэй',
            },
            {
                key: 'student_capacity',
                label: 'Анги дүүргэлтийн дээд хязгаар',
                type: 'number',
                min: 0,
                max: 1000,
                placeholder: '25',
            },
            {
                key: 'business_hours',
                label: 'Ажиллах цаг',
                type: 'text',
                placeholder: 'Да-Ба: 09:00 - 21:00',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'hybrid', defaultCapabilities: ['information', 'lead_capture'] },
    prompt: {
        sectionLabel: 'СУРГАЛТЫН ТӨВИЙН МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const types = pickArray(data, 'course_types');
            if (types.length > 0) lines.push(`• Сургалтын төрлүүд: ${types.join(', ')}`);
            const capacity = pickNumber(data, 'student_capacity');
            if (capacity !== null && capacity > 0) lines.push(`• Ангийн дээд хязгаар: ${capacity} суралцагч`);
            const hours = pickString(data, 'business_hours');
            if (hours) lines.push(`• Ажиллах цаг: ${hours}`);
            const levels = pickArray(data, 'levels_offered');
            if (levels.length > 0) lines.push(`• Түвшнүүд: ${levels.join(', ')}`);
            const formats = pickArray(data, 'class_format');
            if (formats.length > 0) lines.push(`• Хичээллэх хэлбэр: ${formats.join(', ')}`);
            const intake = pickString(data, 'intake_dates');
            if (intake) lines.push(`• Элсэлтийн огноо: ${intake}`);
            const cert = pickBoolean(data, 'certification_offered');
            if (cert === true) lines.push('• Сертификат олгодог');
            const trial = pickBoolean(data, 'trial_class_available');
            if (trial === true) lines.push('• Туршилтын хичээл боломжтой');
            return lines;
        },
    },
};
