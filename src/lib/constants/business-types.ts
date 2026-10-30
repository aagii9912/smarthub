/**
 * Business types — `INDUSTRY_PACKS`-аас үүсвэрлэгдэнэ.
 *
 * Салбарын бүх тодорхойлолт `src/lib/industry-packs/builtin/*` дотор байна;
 * энэ файл хуучин импортуудыг (BUSINESS_TYPES, OPERATIONS_CONFIG …) эвдэхгүй
 * байлгах нимгэн давхарга. Шинэ салбар энд биш, pack-д нэмнэ.
 */

import { PACK_IDS, mapPacks } from '@/lib/industry-packs/registry';
import type { BusinessTypeMeta, OperationsConfig } from '@/lib/industry-packs/types';

export type { BusinessType } from '@/lib/industry-packs/registry';
export { isBusinessType } from '@/lib/industry-packs/registry';
export type {
  BusinessTypeMeta,
  OperationsConfig,
  OperationsField,
  OperationsFieldType,
} from '@/lib/industry-packs/types';

export const BUSINESS_TYPES = mapPacks<BusinessTypeMeta>((pack) => pack.meta);

export const BUSINESS_TYPE_VALUES = PACK_IDS;

// ────────────────────────────────────────────────────────────────────
// Operations step — per-type field configuration
// ────────────────────────────────────────────────────────────────────

export const OPERATIONS_CONFIG = mapPacks<OperationsConfig | null>((pack) => pack.operations);

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
