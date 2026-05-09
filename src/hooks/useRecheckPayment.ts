import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface RecheckResult {
    status: 'paid' | 'pending' | string;
    message?: string;
    transaction_id?: string | null;
}

export function useRecheckPayment() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (orderId: string): Promise<RecheckResult> => {
            const shopId =
                typeof window !== 'undefined'
                    ? localStorage.getItem('smarthub_active_shop_id')
                    : null;
            const res = await fetch(`/api/orders/${orderId}/recheck-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': shopId || '',
                },
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Recheck failed');
            }
            return (await res.json()) as RecheckResult;
        },
        onSuccess: (data) => {
            if (data.status === 'paid') {
                toast.success(data.message || 'Төлбөр баталгаажлаа');
            } else {
                toast.info(data.message || 'Төлбөр хараахан төлөгдөөгүй байна');
            }
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : 'Шалгахад алдаа гарлаа');
        },
    });
}
