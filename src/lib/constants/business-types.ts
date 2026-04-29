import type { LucideIcon } from 'lucide-react';
import {
  Store,
  UtensilsCrossed,
  Calendar,
  ShoppingBag,
  Sparkles,
  MoreHorizontal,
  HeartPulse,
  GraduationCap,
  Building2,
} from 'lucide-react';

export type BusinessType =
  | 'retail'
  | 'restaurant'
  | 'service'
  | 'ecommerce'
  | 'beauty'
  | 'other'
  | 'healthcare'
  | 'education'
  | 'realestate_auto';

export interface BusinessTypeMeta {
  label: string;
  description: string;
  icon: LucideIcon;
  productNoun: string;
  productNounSingular: string;
  hasOperations: boolean;
  aiTemplate: 'general' | 'clothing' | 'restaurant' | 'beauty' | 'tech';
  accentClass: string;
}

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeMeta> = {
  retail: {
    label: 'Дэлгүүр',
    description: 'Бараа, бүтээгдэхүүн борлуулдаг физик дэлгүүр',
    icon: Store,
    productNoun: 'Бараа',
    productNounSingular: 'Бараа',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-emerald-100 text-emerald-600',
  },
  restaurant: {
    label: 'Ресторан',
    description: 'Хоол, унд, кафе, fast food',
    icon: UtensilsCrossed,
    productNoun: 'Меню',
    productNounSingular: 'Хоол',
    hasOperations: true,
    aiTemplate: 'restaurant',
    accentClass: 'bg-orange-100 text-orange-600',
  },
  service: {
    label: 'Үйлчилгээ',
    description: 'Цаг захиалгат үйлчилгээ (засвар, сургалт г.м.)',
    icon: Calendar,
    productNoun: 'Үйлчилгээ',
    productNounSingular: 'Үйлчилгээ',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-blue-100 text-blue-600',
  },
  ecommerce: {
    label: 'E-commerce',
    description: 'Зөвхөн онлайнаар бараа худалддаг',
    icon: ShoppingBag,
    productNoun: 'Бараа',
    productNounSingular: 'Бараа',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-violet-100 text-violet-600',
  },
  beauty: {
    label: 'Гоо сайхан',
    description: 'Салон, спа, гоо сайхны үйлчилгээ',
    icon: Sparkles,
    productNoun: 'Үйлчилгээ',
    productNounSingular: 'Үйлчилгээ',
    hasOperations: true,
    aiTemplate: 'beauty',
    accentClass: 'bg-pink-100 text-pink-600',
  },
  healthcare: {
    label: 'Эрүүл мэнд',
    description: 'Эмнэлэг, клиник, эрүүл мэндийн төв',
    icon: HeartPulse,
    productNoun: 'Үйлчилгээ',
    productNounSingular: 'Үйлчилгээ',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-red-100 text-red-600',
  },
  education: {
    label: 'Боловсрол',
    description: 'Сургалт, курс, боловсролын байгууллага',
    icon: GraduationCap,
    productNoun: 'Сургалт',
    productNounSingular: 'Сургалт',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-indigo-100 text-indigo-600',
  },
  realestate_auto: {
    label: 'Үл хөдлөх / Авто',
    description: 'Үл хөдлөх хөрөнгө, автомашин зарах бизнес',
    icon: Building2,
    productNoun: 'Зар',
    productNounSingular: 'Зар',
    hasOperations: true,
    aiTemplate: 'general',
    accentClass: 'bg-amber-100 text-amber-600',
  },
  other: {
    label: 'Бусад',
    description: 'Бусад төрлийн бизнес',
    icon: MoreHorizontal,
    productNoun: 'Бараа',
    productNounSingular: 'Бараа',
    hasOperations: false,
    aiTemplate: 'general',
    accentClass: 'bg-gray-100 text-gray-600',
  },
};

export const BUSINESS_TYPE_VALUES = Object.keys(BUSINESS_TYPES) as BusinessType[];

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && value in BUSINESS_TYPES;
}

// ────────────────────────────────────────────────────────────────────
// Operations step — per-type field configuration
// ────────────────────────────────────────────────────────────────────

export type OperationsFieldType = 'number' | 'text' | 'boolean' | 'radio' | 'multi-checkbox';

export interface OperationsField {
  key: string;
  label: string;
  type: OperationsFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  helpText?: string;
}

export interface OperationsConfig {
  title: string;
  subtitle: string;
  fields: OperationsField[];
}

export const OPERATIONS_CONFIG: Record<BusinessType, OperationsConfig | null> = {
  retail: {
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
  restaurant: {
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
  service: {
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
  ecommerce: {
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
  beauty: {
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
  healthcare: {
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
  education: {
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
  realestate_auto: {
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
  other: null,
};

// ────────────────────────────────────────────────────────────────────
// Discriminated union schema (Zod-friendly shape)
// ────────────────────────────────────────────────────────────────────

export interface RetailSetupData {
  inventory_method?: 'manual' | 'barcode';
  warehouse_address?: string;
  tax_registered?: boolean;
}

export interface RestaurantSetupData {
  table_count?: number;
  delivery_enabled?: boolean;
  delivery_zones?: string;
  avg_prep_minutes?: number;
}

export interface ServiceSetupData {
  staff_count?: number;
  default_duration_minutes?: number;
  booking_method?: 'manual' | 'calendar';
  business_hours?: string;
}

export interface EcommerceSetupData {
  shipping_zones?: string;
  payment_methods?: ('card' | 'qpay' | 'bank_transfer' | 'cod')[];
  inventory_tracking?: boolean;
}

export interface BeautySetupData {
  staff_count?: number;
  salon_address?: string;
  services_at_home?: boolean;
  default_duration_minutes?: number;
}

export interface HealthcareSetupData {
  doctor_count?: number;
  specialties?: string;
  business_hours?: string;
}

export interface EducationSetupData {
  course_types?: string;
  student_capacity?: number;
  business_hours?: string;
}

export interface RealEstateAutoSetupData {
  category?: 'realestate' | 'auto' | 'both';
  agent_count?: number;
  service_areas?: string;
}

export type BusinessSetupData =
  | RetailSetupData
  | RestaurantSetupData
  | ServiceSetupData
  | EcommerceSetupData
  | BeautySetupData
  | HealthcareSetupData
  | EducationSetupData
  | RealEstateAutoSetupData
  | Record<string, never>;
