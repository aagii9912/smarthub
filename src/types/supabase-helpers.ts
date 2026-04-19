/**
 * Shared shapes for Supabase join results.
 *
 * Supabase's PostgREST joins return related rows as either a single object
 * (for 1:1 / belongs-to) or an array (for 1:N). The generated types don't
 * always disambiguate, so we use these narrow helpers in route handlers
 * and services instead of `any`.
 */

export type SupabaseRelation<T> = T | T[] | null;

/** Extract a single row from a join that may be an object or an array. */
export function pickOne<T>(rel: SupabaseRelation<T>): T | null {
    if (!rel) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/** Normalize a related field into an array. */
export function pickAll<T>(rel: SupabaseRelation<T>): T[] {
    if (!rel) return [];
    return Array.isArray(rel) ? rel : [rel];
}

export interface ProductSummary {
    id?: string;
    name: string;
    price?: number;
    images?: string[] | null;
}

export interface OrderItemRow {
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    products?: SupabaseRelation<ProductSummary>;
}

export interface CustomerSummary {
    id?: string;
    name: string | null;
    phone?: string | null;
    email?: string | null;
}

export interface OrderWithJoins {
    id: string;
    shop_id: string;
    customer_id: string;
    status: string;
    total_amount: number;
    notes: string | null;
    created_at: string;
    updated_at?: string;
    customers?: SupabaseRelation<CustomerSummary>;
    order_items?: OrderItemRow[];
}

export interface CartItemRow {
    id?: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    variant_id?: string | null;
    products?: SupabaseRelation<ProductSummary>;
}
