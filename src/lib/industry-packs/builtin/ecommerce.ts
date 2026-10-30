import { ShoppingBag } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickBoolean, pickNumber, pickString } from '../setup-helpers';

export const ecommercePack: IndustryPack = {
    id: 'ecommerce',
    meta: {
        label: 'E-commerce',
        description: 'Зөвхөн онлайнаар бараа худалддаг',
        icon: ShoppingBag,
        productNoun: 'Бараа',
        productNounSingular: 'Бараа',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-violet-100 text-violet-600',
    },
    archetype: 'commerce',
    blocks: { commerce: true, booking: false, lead: false },
    operations: {
        title: 'Онлайн худалдааны тохиргоо',
        subtitle: 'Онлайн дэлгүүрийн мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'shipping_zones',
                label: 'Хүргэлтийн бүс',
                type: 'text',
                placeholder: 'УБ, орон нутаг...',
                helpText: 'Таслалаар тусгаарлан бичээрэй',
            },
            {
                key: 'payment_methods',
                label: 'Төлбөрийн арга',
                type: 'multi-checkbox',
                options: [
                    { value: 'card', label: 'Картаар' },
                    { value: 'qpay', label: 'QPay' },
                    { value: 'bank_transfer', label: 'Банкаар шилжүүлэх' },
                    { value: 'cod', label: 'Хүлээж авах үед' },
                ],
            },
            {
                key: 'inventory_tracking',
                label: 'Үлдэгдэл хянах уу?',
                type: 'boolean',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'sales', defaultCapabilities: ['sales', 'support'] },
    prompt: {
        sectionLabel: 'ОНЛАЙН ДЭЛГҮҮРИЙН МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const zones = pickArray(data, 'shipping_zones');
            if (zones.length > 0) lines.push(`• Хүргэлтийн бүс: ${zones.join(', ')}`);
            const methods = pickArray(data, 'payment_methods');
            if (methods.length > 0) lines.push(`• Төлбөрийн арга: ${methods.join(', ')}`);
            const tracking = pickBoolean(data, 'inventory_tracking');
            if (tracking === true) lines.push('• Үлдэгдэл автоматаар хянагдана');
            const dispatch = pickNumber(data, 'dispatch_sla_hours');
            if (dispatch !== null && dispatch > 0) lines.push(`• Захиалгыг ${dispatch} цагийн дотор боловсруулна`);
            const returnWindow = pickNumber(data, 'return_window_days');
            if (returnWindow !== null && returnWindow > 0) lines.push(`• Буцаах хугацаа: ${returnWindow} хоног`);
            const sizeChart = pickString(data, 'size_chart_url');
            if (sizeChart) lines.push(`• Размерийн хүснэгт: ${sizeChart}`);
            const story = pickString(data, 'brand_story');
            if (story) lines.push(`• Брэндийн түүх: ${story}`);
            const preOrder = pickString(data, 'pre_order_policy');
            if (preOrder) lines.push(`• Урьдчилсан захиалгын бодлого: ${preOrder}`);
            return lines;
        },
    },
};
