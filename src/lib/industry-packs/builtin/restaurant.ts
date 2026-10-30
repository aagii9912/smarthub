import { UtensilsCrossed } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const restaurantPack: IndustryPack = {
    id: 'restaurant',
    meta: {
        label: 'Ресторан',
        description: 'Хоол, унд, кафе, fast food',
        icon: UtensilsCrossed,
        productNoun: 'Меню',
        productNounSingular: 'Хоол',
        hasOperations: true,
        aiTemplate: 'restaurant',
        accentClass: 'bg-orange-100 text-orange-600',
    },
    // sales-first; appointments surface as a secondary block
    archetype: 'commerce',
    blocks: { commerce: true, booking: true, lead: false },
    operations: {
        title: 'Ресторан тохиргоо',
        subtitle: 'Үйл ажиллагааны мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'table_count',
                label: 'Ширээний тоо',
                type: 'number',
                min: 0,
                max: 500,
                placeholder: '20',
            },
            {
                key: 'delivery_enabled',
                label: 'Хүргэлтийн үйлчилгээ үзүүлэх үү?',
                type: 'boolean',
            },
            {
                key: 'delivery_zones',
                label: 'Хүргэлтийн бүс / дүүрэг',
                type: 'text',
                placeholder: 'СБД, ЧД, БГД...',
                helpText: 'Таслалаар тусгаарлан бичээрэй',
            },
            {
                key: 'avg_prep_minutes',
                label: 'Дундаж бэлтгэх хугацаа (минут)',
                type: 'number',
                min: 0,
                max: 240,
                placeholder: '15',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'hybrid', defaultCapabilities: ['sales', 'booking', 'information'] },
    prompt: {
        sectionLabel: 'РЕСТОРАН/КАФЕНЫ МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const tables = pickNumber(data, 'table_count');
            if (tables !== null && tables > 0) lines.push(`• Нийт ширээний тоо: ${tables}`);
            const delivery = pickBoolean(data, 'delivery_enabled');
            if (delivery === true) lines.push('• Хүргэлтийн үйлчилгээтэй');
            else if (delivery === false) lines.push('• Хүргэлтгүй (зөвхөн дотроо үйлчилнэ)');
            const zones = pickArray(data, 'delivery_zones');
            if (zones.length > 0) lines.push(`• Хүргэлтийн бүс: ${zones.join(', ')}`);
            const prep = pickNumber(data, 'avg_prep_minutes');
            if (prep !== null && prep > 0) lines.push(`• Хоол бэлдэх дундаж хугацаа: ${prep} минут`);
            const categories = pickArray(data, 'menu_categories');
            if (categories.length > 0) lines.push(`• Цэсний ангилал: ${categories.join(', ')}`);
            const dietary = pickArray(data, 'dietary_options');
            if (dietary.length > 0) lines.push(`• Тусгай хоолны сонголт: ${dietary.join(', ')}`);
            const peak = pickString(data, 'peak_hours');
            if (peak) lines.push(`• Ачаалал ихтэй цаг: ${peak}`);
            const reservation = pickString(data, 'reservation_policy');
            if (reservation) lines.push(`• Ширээ захиалгын бодлого: ${reservation}`);
            const minOrder = pickNumber(data, 'min_order_value');
            if (minOrder !== null && minOrder > 0) lines.push(`• Хүргэлтийн доод дүн: ${minOrder.toLocaleString()}₮`);
            const fee = pickNumber(data, 'service_fee_percent');
            if (fee !== null && fee > 0) lines.push(`• Үйлчилгээний хураамж: ${fee}%`);
            return lines;
        },
    },
};
