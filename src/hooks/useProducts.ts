import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';


export interface ProductVariant {
    id: string;
    product_id: string;
    sku: string | null;
    name: string;
    options: Record<string, string>;
    price: number | null;
    stock: number;
    is_active: boolean;
}

export interface Product {
    id: string;
    name: string;
    description: string | null;
    category?: string | null;
    price: number;
    stock: number | null;
    reserved_stock: number | null;
    discount_percent: number | null;
    is_active: boolean;
    // Lifecycle status (draft | active | pre_order | coming_soon | discontinued)
    status?: 'draft' | 'active' | 'pre_order' | 'coming_soon' | 'discontinued';
    available_from?: string | null;
    pre_order_eta?: string | null;
    type: 'physical' | 'service' | 'appointment';
    colors: string[];
    sizes: string[];
    images: string[];
    // Variant support
    has_variants?: boolean;
    variants?: ProductVariant[];
    // Delivery configuration
    delivery_type?: 'included' | 'paid' | 'pickup_only';
    delivery_fee?: number;
    delivery_note?: string | null;
    // Appointment-specific fields
    duration_minutes: number | null;
    available_days: string[] | null;
    start_time: string | null;
    end_time: string | null;
    max_bookings_per_day: number | null;
}

interface ProductsResponse {
    products: Product[];
}

export function useProducts() {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return useQuery({
        queryKey: ['products', shopId],
        queryFn: async (): Promise<Product[]> => {
            const res = await fetch('/api/dashboard/products', {
                headers: {
                    'x-shop-id': shopId || ''
                }
            });
            if (!res.ok) throw new Error('Бүтээгдэхүүн ачаалахад алдаа гарлаа');
            const data: ProductsResponse = await res.json();
            return data.products;
        },
    });
}

export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productData: Partial<Product>) => {
            const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
            const res = await fetch('/api/dashboard/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId || ''
                },
                body: JSON.stringify(productData),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.details?.join(', ') || error.error || 'Бүтээгдэхүүн үүсгэхэд алдаа гарлаа');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productData: Partial<Product> & { id: string }) => {
            const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
            const res = await fetch('/api/dashboard/products', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId || ''
                },
                body: JSON.stringify(productData),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.details?.join(', ') || error.error || 'Бүтээгдэхүүн шинэчлэхэд алдаа гарлаа');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
    });
}

export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productId: string) => {
            const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
            const res = await fetch(`/api/dashboard/products?id=${productId}`, {
                method: 'DELETE',
                headers: {
                    'x-shop-id': shopId || ''
                }
            });
            if (!res.ok) throw new Error('Бүтээгдэхүүн устгахад алдаа гарлаа');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Бүтээгдэхүүн устгахад алдаа гарлаа');
        },
    });
}
