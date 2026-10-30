import { Store } from 'lucide-react';
import type { IndustryPack } from '../types';
import { pickArray, pickBoolean, pickString } from '../setup-helpers';

export const retailPack: IndustryPack = {
    id: 'retail',
    meta: {
        label: 'Дэлгүүр',
        description: 'Бараа, бүтээгдэхүүн борлуулдаг физик дэлгүүр',
        icon: Store,
        productNoun: 'Бараа',
        productNounSingular: 'Бараа',
        hasOperations: true,
        aiTemplate: 'general',
        accentClass: 'bg-emerald-100 text-emerald-600',
    },
    archetype: 'commerce',
    blocks: { commerce: true, booking: false, lead: false },
    operations: {
        title: 'Дэлгүүрийн үйл ажиллагаа',
        subtitle: 'Дэлгүүрийн талаар нэмэлт мэдээлэл (заавал биш)',
        fields: [
            {
                key: 'inventory_method',
                label: 'Бараа бүртгэх арга',
                type: 'radio',
                options: [
                    { value: 'manual', label: 'Гараар бүртгэдэг' },
                    { value: 'barcode', label: 'Баркод/POS системтэй' },
                ],
            },
            {
                key: 'warehouse_address',
                label: 'Агуулахын хаяг',
                type: 'text',
                placeholder: 'Жишээ: СБД 1-р хороо...',
            },
            {
                key: 'tax_registered',
                label: 'НӨАТ-д бүртгэлтэй юу?',
                type: 'boolean',
            },
        ],
    },
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'sales', defaultCapabilities: ['sales', 'support'] },
    prompt: {
        sectionLabel: 'ДЭЛГҮҮРИЙН МЭДЭЭЛЭЛ',
        renderSetup(data) {
            const lines: string[] = [];
            const inv = pickString(data, 'inventory_method');
            if (inv === 'manual') lines.push('• Бараа бүртгэлийг гараар хийдэг');
            else if (inv === 'barcode') lines.push('• Бараа бүртгэлд баркод/POS систем ашигладаг');
            const warehouse = pickString(data, 'warehouse_address');
            if (warehouse) lines.push(`• Агуулахын хаяг: ${warehouse}`);
            const tax = pickBoolean(data, 'tax_registered');
            if (tax === true) lines.push('• НӨАТ-д бүртгэлтэй (баримт өгөх боломжтой)');
            else if (tax === false) lines.push('• НӨАТ-д бүртгэлгүй');
            const categories = pickArray(data, 'product_categories');
            if (categories.length > 0) lines.push(`• Барааны ангилал: ${categories.join(', ')}`);
            const origin = pickString(data, 'brand_origin');
            if (origin === 'local') lines.push('• Үндсэн бараа: дотоодын');
            else if (origin === 'imported') lines.push('• Үндсэн бараа: импортын');
            const warranty = pickString(data, 'warranty_policy');
            if (warranty) lines.push(`• Баталгаат хугацааны бодлого: ${warranty}`);
            const loyalty = pickString(data, 'loyalty_program');
            if (loyalty) lines.push(`• Урамшууллын систем: ${loyalty}`);
            return lines;
        },
    },
};
