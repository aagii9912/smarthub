import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateStaffInput, UpdateStaffInput, WorkingHours } from '@/lib/validations/staff';

export interface Staff {
    id: string;
    shop_id: string;
    name: string;
    specialty: string | null;
    phone: string | null;
    color: string;
    is_active: boolean;
    working_hours: WorkingHours;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

function shopHeaders(): Record<string, string> {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return { 'x-shop-id': shopId || '', 'Content-Type': 'application/json' };
}

export function useStaff() {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return useQuery({
        queryKey: ['staff', shopId],
        queryFn: async (): Promise<Staff[]> => {
            const res = await fetch('/api/dashboard/staff', { headers: shopHeaders() });
            if (!res.ok) throw new Error('Failed to fetch staff');
            const json = await res.json();
            return json.staff || [];
        },
    });
}

export function useCreateStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: CreateStaffInput): Promise<Staff> => {
            const res = await fetch('/api/dashboard/staff', {
                method: 'POST',
                headers: shopHeaders(),
                body: JSON.stringify(input),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to create staff');
            return (await res.json()).staff;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Ажилтан нэмэгдлээ');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useUpdateStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateStaffInput & { id: string }): Promise<Staff> => {
            const res = await fetch(`/api/dashboard/staff/${id}`, {
                method: 'PATCH',
                headers: shopHeaders(),
                body: JSON.stringify(input),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to update staff');
            return (await res.json()).staff;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Хадгалагдлаа');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}

export function useDeleteStaff() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string): Promise<void> => {
            const res = await fetch(`/api/dashboard/staff/${id}`, { method: 'DELETE', headers: shopHeaders() });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete staff');
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['staff'] });
            toast.success('Устгагдлаа');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
