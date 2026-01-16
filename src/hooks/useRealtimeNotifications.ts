'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { formatTimeAgo } from '@/lib/utils/date';

export function useRealtimeNotifications() {
    const { shop } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!shop?.id) return;

        console.log('🔔 Subscribing to realtime notifications for shop:', shop.id);

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

                // Play notification sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.log('Audio play failed:', e));
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

                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                    audio.play().catch(e => console.log('Audio play failed:', e));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shop?.id, router]);
}
