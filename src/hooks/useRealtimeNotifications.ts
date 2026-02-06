'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

// Debounce helper to prevent excessive invalidations
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
    let timeoutId: NodeJS.Timeout;
    return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
}

interface LowStockProduct {
    id: string;
    name: string;
    stock_quantity: number;
}

export function useRealtimeNotifications() {
    const { shop } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const lowStockThreshold = 5; // Alert when stock falls below this

    // Debounced invalidation functions for performance
    const debouncedInvalidateOrders = useCallback(
        debounce(() => {
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }, 500),
        [queryClient]
    );

    const debouncedInvalidateProducts = useCallback(
        debounce(() => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        }, 500),
        [queryClient]
    );

    const debouncedInvalidateCustomers = useCallback(
        debounce(() => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        }, 500),
        [queryClient]
    );

    useEffect(() => {
        if (!shop?.id) return;

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

                debouncedInvalidateOrders();

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
            }, () => {
                debouncedInvalidateOrders();
            })
            // 🛒 Product Changes with Low Stock Alert
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'products',
                filter: `shop_id=eq.${shop.id}`
            }, (payload) => {
                debouncedInvalidateProducts();

                // Low stock alert for updates
                if (payload.eventType === 'UPDATE' && payload.new) {
                    const product = payload.new as LowStockProduct;
                    if (product.stock_quantity <= lowStockThreshold && product.stock_quantity > 0) {
                        toast.warning('⚠️ Бага нөөц', {
                            description: `${product.name}: ${product.stock_quantity} ширхэг үлдсэн`,
                            action: {
                                label: 'Нэмэх',
                                onClick: () => router.push(`/dashboard/products`)
                            },
                            duration: 8000,
                        });
                    } else if (product.stock_quantity === 0) {
                        toast.error('🚫 Нөөц дууссан!', {
                            description: `${product.name} дууссан`,
                            action: {
                                label: 'Нэмэх',
                                onClick: () => router.push(`/dashboard/products`)
                            },
                            duration: 10000,
                        });
                    }
                }
            })
            // 👤 Customer Changes (NEW, UPDATE)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'customers',
                filter: `shop_id=eq.${shop.id}`
            }, (payload) => {
                debouncedInvalidateCustomers();

                // New customer notification
                if (payload.eventType === 'INSERT' && payload.new) {
                    toast.info('👤 Шинэ харилцагч', {
                        description: payload.new.name || 'Нэргүй харилцагч',
                        duration: 5000
                    });
                }
            })
            // 🛍️ Active Carts - Real-time shopping tracking
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'carts',
                filter: `shop_id=eq.${shop.id}`
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['carts'] });
                queryClient.invalidateQueries({ queryKey: ['active-carts'] });
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

                    queryClient.invalidateQueries({ queryKey: ['conversations'] });

                    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
                    audio.play().catch(() => { /* Audio autoplay blocked */ });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [shop?.id, router, queryClient, debouncedInvalidateOrders, debouncedInvalidateProducts, debouncedInvalidateCustomers]);
}
