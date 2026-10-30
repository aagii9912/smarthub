import { MoreHorizontal } from 'lucide-react';
import type { IndustryPack } from '../types';

export const otherPack: IndustryPack = {
    id: 'other',
    meta: {
        label: 'Бусад',
        description: 'Бусад төрлийн бизнес',
        icon: MoreHorizontal,
        productNoun: 'Бараа',
        productNounSingular: 'Бараа',
        hasOperations: false,
        aiTemplate: 'general',
        accentClass: 'bg-gray-100 text-gray-600',
    },
    archetype: 'commerce',
    blocks: { commerce: true, booking: false, lead: false },
    operations: null,
    catalog: { mode: 'stock' },
    ai: { defaultRole: 'sales', defaultCapabilities: ['sales'] },
    prompt: { sectionLabel: 'БИЗНЕСИЙН МЭДЭЭЛЭЛ' },
};
