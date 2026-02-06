'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeNotifications() {
    const { shop } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!shop?.id) return;

        // Realtime notifications subscription active for shop

        const channel = supabase
            .channel(`shop-updates-${shop.id}`)
            // 🆕 New Orders
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders',
                filter: `shop_id=eq.${shop.id}`
            }, (payload) => {
                const newOrder = payload.new;
                toast.success('🎉 Шинэ захиалга!', {
                    description: `Үнийн дүн: ${Number(newOrder.total_amount).toLocaleString()}₮`,
                    action: {
                        label: 'Харах',
                        onClick: () => router.push(`/dashboard/orders`)
                    },
                    duration: 10000,
                });

                // Invalidate orders query to refresh UI
                queryClient.invalidateQueries({ queryKey: ['orders'] });

                // Play notification sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => { /* Audio autoplay blocked */ });
            })
            // 📦 Order Status Updates
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `shop_id=eq.${shop.id}`
            }, (payload) => {
                // Invalidate orders query to keep UI in sync
                queryClient.invalidateQueries({ queryKey: ['orders'] });
                queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            })
            // 🛒 Product Changes (INSERT, UPDATE, DELETE)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `shop_id=eq.${shop.id}`
            }, () => {
                // Invalidate products query to refresh UI
                queryClient.invalidateQueries({ queryKey: ['products'] });
            })
            // 💬 New Messages
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_history',
                filter: `shop_id=eq.${shop.id}`
            }, (payload) => {
                // Only notify if it's from user
                if (payload.new.role === 'user') {
                    toast.info('💬 Шинэ мессеж', {
                        description: payload.new.content.substring(0, 50) + (payload.new.content.length > 50 ? '...' : ''),
                        action: {
                            label: 'Хариулах',
                            onClick: () => router.push(`/dashboard/inbox`)
                        }
                    });

                    // Invalidate conversations
                    queryClient.invalidateQueries({ queryKey: ['conversations'] });

                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                    audio.play().catch(() => { /* Audio autoplay blocked */ });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shop?.id, router, queryClient]);
}

