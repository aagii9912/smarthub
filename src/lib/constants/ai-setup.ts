import {
    Smile,
    Briefcase,
    Zap,
    Cloud,
    PartyPopper,
    Feather,
    Scale,
    Target,
    AlignLeft,
    AlignCenter,
    AlignJustify,
    Ban,
    Laugh,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type {
    SalesAssertiveness,
    ResponseLength,
    EmojiUsage,
} from '@/types/ai';

type StyleOption<T> = {
    value: T;
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
};

export const TEMPLATES = {
    general: {
        label: 'Ерөнхий / Бусад',
        description: 'Бүх төрлийн бизнест тохиромжтой',
        emotion: 'friendly',
        instructions: 'Хэрэглэгчид туслах, асуултанд хариулах, захиалга авах үндсэн үүрэгтэй.',
        greeting: 'Сайн байна уу! Танд юугаар туслах вэ? 😊'
    },
    clothing: {
        label: 'Хувцас, Загвар',
        description: 'Загварын дэлгүүрт зориулсан',
        emotion: 'enthusiastic',
        instructions: 'Загварын зөвлөгөө өгөх, хэмжээ, материалын талаар дэлгэрэнгүй мэдээлэл өгөх. "Гоё зохино", "Тренд болж байгаа" гэх мэт үгс ашиглах.',
        greeting: 'Сайн байна уу! Манай загварлаг цуглуулгаас сонирхоорой 👗'
    },
    restaurant: {
        label: 'Ресторан, Хоол',
        description: 'Хоол захиалга, меню танилцуулга',
        emotion: 'friendly',
        instructions: 'Хоолны амт, орц найрлагыг тайлбарлах. Хурдан шуурхай үйлчилгээг амлах. "Амттай", "Халуун" гэх мэт үгс ашиглах.',
        greeting: 'Сайн байна уу! Өнөөдөр ямар амттай хоол идмээр байна? 🍔'
    },
    beauty: {
        label: 'Гоо сайхан, Салон',
        description: 'Гоо сайхны бүтээгдэхүүн, үйлчилгээ',
        emotion: 'calm',
        instructions: 'Арьс арчилгаа, гоо сайхны зөвлөгөө өгөх. Тайван, итгэл төрүүлэхүйц өнгө аяс.',
        greeting: 'Таны гоо үзэсгэлэнд зориулав ✨ Сайн байна уу?'
    },
    tech: {
        label: 'Электроник, IT',
        description: 'Технологийн бараа, засвар',
        emotion: 'professional',
        instructions: 'Техникийн үзүүлэлт, баталгаат хугацааг тод хэлэх. Мэргэжлийн, товч тодорхой хариулах.',
        greeting: 'Сайн байна уу! Технологийн шийдлийг эндээс. 💻'
    }
};

export const EMOTIONS = [
    { value: 'friendly', label: 'Найрсаг 😊', icon: Smile },
    { value: 'professional', label: 'Мэргэжлийн 👔', icon: Briefcase },
    { value: 'enthusiastic', label: 'Урам зоригтой 🎉', icon: Zap },
    { value: 'calm', label: 'Тайван 🧘', icon: Cloud },
    { value: 'playful', label: 'Тоглоомтой 🎮', icon: PartyPopper },
];

/**
 * Reply-style tuning shown to the shop owner. Shared by the dashboard
 * persona tab and the onboarding wizard so labels stay in sync. The `value`
 * is persisted to `cross_cutting` and mapped to prompt text in
 * `PromptService.buildResponseStyleSection`.
 */
export const ASSERTIVENESS_OPTIONS: StyleOption<SalesAssertiveness>[] = [
    { value: 'soft', label: 'Зөөлөн', description: 'Эелдэг, тулгахгүй. Хэрэглэгчид цаг өгнө', icon: Feather },
    { value: 'balanced', label: 'Тэнцвэртэй', description: 'Тус болж, зохистой санал болгоно', icon: Scale },
    { value: 'assertive', label: 'Шулуухан', description: 'Идэвхтэй санал болгож захиалга руу хөтөлнө', icon: Target },
];

export const RESPONSE_LENGTH_OPTIONS: StyleOption<ResponseLength>[] = [
    { value: 'short', label: 'Богино', description: '1–2 өгүүлбэр, шууд гол санаа', icon: AlignLeft },
    { value: 'medium', label: 'Дунд', description: 'Хэрэгцээт хэмжээгээр тайлбарлана', icon: AlignCenter },
    { value: 'long', label: 'Дэлгэрэнгүй', description: 'Давуу тал, жишээтэй бүрэн тайлбар', icon: AlignJustify },
];

export const EMOJI_OPTIONS: StyleOption<EmojiUsage>[] = [
    { value: 'none', label: 'Огт үгүй', description: 'Emoji ашиглахгүй, цэвэр текст', icon: Ban },
    { value: 'minimal', label: 'Бага', description: 'Хааяа, зохистой хэмжээнд', icon: Smile },
    { value: 'frequent', label: 'Их', description: 'Чөлөөтэй, хөгжилтэй өнгөтэй', icon: Laugh },
];

export const PERSONA_STYLE_DEFAULTS: {
    sales_assertiveness: SalesAssertiveness;
    response_length: ResponseLength;
    emoji_usage: EmojiUsage;
} = {
    sales_assertiveness: 'balanced',
    response_length: 'medium',
    emoji_usage: 'minimal',
};

export const STEPS = [
    { id: 'identity', title: 'Бизнесийн төрөл' },
    { id: 'personality', title: 'Зан төлөв' },
    { id: 'review', title: 'Баталгаажуулах' }
];
