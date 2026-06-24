import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { UpdateAppointmentInput, AppointmentStatus, PaymentStatus } from '@/lib/validations/appointment';

interface Related { name: string | null; phone?: string | null; category?: string | null }

export interface AppointmentRow {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    price: number | null;
    notes: string | null;
    staff_id: string | null;
    customers: Related | Related[] | null;
    products: Related | Related[] | null;
}

function shopHeaders(): Record<string, string> {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    return { 'x-shop-id': shopId || '', 'Content-Type': 'application/json' };
}

export function useAppointments(filters?: { status?: string; payment?: string }) {
    const shopId = typeof window !== 'undefined' ? localStorage.getItem('smarthub_active_shop_id') : null;
    const qs = new URLSearchParams();
    if (filters?.status) qs.set('status', filters.status);
    if (filters?.payment) qs.set('payment', filters.payment);
    const query = qs.toString();

    return useQuery({
        queryKey: ['appointments', shopId, filters?.status ?? '', filters?.payment ?? ''],
        queryFn: async (): Promise<AppointmentRow[]> => {
            const res = await fetch(`/api/dashboard/appointments${query ? `?${query}` : ''}`, { headers: shopHeaders() });
            if (!res.ok) throw new Error('Failed to fetch appointments');
            return (await res.json()).appointments || [];
        },
    });
}

export function useUpdateAppointment() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...input }: UpdateAppointmentInput & { id: string }): Promise<AppointmentRow> => {
            const res = await fetch(`/api/dashboard/appointments/${id}`, {
                method: 'PATCH',
                headers: shopHeaders(),
                body: JSON.stringify(input),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to update');
            return (await res.json()).appointment;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['appointments'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            toast.success('Шинэчлэгдлээ');
        },
        onError: (e: Error) => toast.error(e.message),
    });
}
