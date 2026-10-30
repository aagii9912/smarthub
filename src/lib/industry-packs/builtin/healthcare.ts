import { HeartPulse } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const healthcarePack: IndustryPack = {
    id: 'healthcare',
    meta: {
        label: 'Эрүүл мэнд',
        description: 'Эмнэлэг, клиник, эрүүл мэндийн төв',
        icon: HeartPulse,
        productNoun: 'Үйлчилгээ',
        productNounSingular: 'Үйлчилгээ',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-red-100 text-red-600',
    },
    archetype: 'booking',
    blocks: { commerce: false, booking: true, lead: false },
    operations: {
        title: 'Эрүүл мэндийн байгууллагын тохиргоо',
        subtitle: 'Үйл ажиллагааны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'doctor_count',
                label: 'Эмчийн тоо',
                type: 'number',
                min: 0,
                max: 1000,
                placeholder: '5',
            },
            {
                key: 'specialties',
                label: 'Үндсэн чиглэлүүд',
                type: 'text',
                placeholder: 'Шүд, дотрын, хүүхэд...',
                helpText: 'Таслалаар тусгаарлан бичээрэй',
            },
            {
                key: 'business_hours',
                label: 'Ажиллах цаг',
                type: 'text',
                placeholder: 'Да-Ба: 09:00 - 18:00',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'hybrid', defaultCapabilities: ['booking', 'information'] },
    prompt: {
        sectionLabel: 'ЭМНЭЛГИЙН МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const doctors = pickNumber(data, 'doctor_count');
            if (doctors !== null && doctors > 0) lines.push(`• Эмчийн тоо: ${doctors}`);
            const specialties = pickArray(data, 'specialties');
            if (specialties.length > 0) lines.push(`• Чиглэлүүд: ${specialties.join(', ')}`);
            const hours = pickString(data, 'business_hours');
            if (hours) lines.push(`• Ажиллах цаг: ${hours}`);
            const insurance = pickArray(data, 'insurance_accepted');
            if (insurance.length > 0) lines.push(`• Хүлээн авдаг даатгал: ${insurance.join(', ')}`);
            const appointmentReq = pickBoolean(data, 'appointment_required');
            if (appointmentReq === true) lines.push('• Зөвхөн урьдчилсан цаг авсан үед үйлчилнэ');
            const emergency = pickString(data, 'emergency_handling');
            if (emergency) lines.push(`• Яаралтай тохиолдол: ${emergency}`);
            const disclaimer = pickString(data, 'triage_disclaimer');
            if (disclaimer) {
                lines.push(`• ⚠️ ЗААВАЛ ХЭЛЭХ МЭДЭГДЭЛ: ${disclaimer}`);
            }
            return lines;
        },
    },
};
