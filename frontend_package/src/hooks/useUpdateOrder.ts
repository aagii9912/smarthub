import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderWithDetails } from './useOrders';

interface UpdateOrderParams {
    orderId: string;
    status: string;
}

export function useUpdateOrder() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ orderId, status }: UpdateOrderParams) => {
            const res = await fetch('/api/orders', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-shop-id': localStorage.getItem('smarthub_active_shop_id') || ''
                },
                body: JSON.stringify({ id: orderId, status }),
            });
            if (!res.ok) throw new Error('Failed to update status');
            return res.json();
        },
        // Optimistic Update
        onMutate: async ({ orderId, status }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['orders'] });

            // Snapshot previous value
            const previousOrders = queryClient.getQueryData<OrderWithDetails[]>(['orders']);

            // Optimistically update
            if (previousOrders) {
                queryClient.setQueryData<OrderWithDetails[]>(['orders'], (old) => {
                    if (!old) return [];
                    return old.map((order) =>
                        order.id === orderId ? { ...order, status } : order
                    );
                });
            }

            // Return context for rollback
            return { previousOrders };
        },
        onError: (err, newTodo, context) => {
            // Rollback
            if (context?.previousOrders) {
                queryClient.setQueryData(['orders'], context.previousOrders);
            }
        },
        onSettled: () => {
            // Always refetch to sync server state
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        },
    });
}
