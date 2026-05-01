'use client';

import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/utils/logger';

const isDev = process.env.NODE_ENV === 'development';

interface UsePushNotificationsReturn {
    isSupported: boolean;
    isSubscribed: boolean;
    isLoading: boolean;
    permission: NotificationPermission | null;
    subscribe: () => Promise<boolean>;
    unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [permission, setPermission] = useState<NotificationPermission | null>(null);

    // Check if push notifications are supported
    useEffect(() => {
        const checkSupport = async () => {
            const supported =
                'serviceWorker' in navigator &&
                'PushManager' in window &&
                'Notification' in window;

            setIsSupported(supported);

            if (supported) {
                setPermission(Notification.permission);

                // Check if already subscribed (with timeout)
                try {
                    const timeoutPromise = new Promise<null>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 3000)
                    );

                    const registration = await Promise.race([
                        navigator.serviceWorker.ready,
                        timeoutPromise,
                    ]) as ServiceWorkerRegistration | null;

                    if (registration) {
                        const subscription = await registration.pushManager.getSubscription();
                        // UI state нь зөвхөн browser-н бодит subscription байгаа эсэхээс
                        // хамаарна. Хуурмаг auto-resubscribe хийхгүй — энэ нь хэрэглэгч
                        // өмнө OFF дарсан атлаа дахин нээгдэж auto-ON болж байсан bug-ыг
                        // арилгана.
                        setIsSubscribed(!!subscription);
                    }
                } catch {
                    // Service worker not ready yet - will register on subscribe
                }
            }

            setIsLoading(false);
        };

        checkSupport();
    }, []);

    // Subscribe to push notifications
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        setIsLoading(true);

        try {
            // Request permission
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult !== 'granted') {
                setIsLoading(false);
                return false;
            }

            // Get VAPID public key
            const vapidRes = await fetch('/api/push/vapid');
            if (!vapidRes.ok) {
                throw new Error('Failed to get VAPID key');
            }
            const { publicKey } = await vapidRes.json();

            // Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // Хуучин subscription байвал орхио гэж үзэн арилгана. Browser-ын
            // pushManager заримдаа шинэ endpoint үүсгэдэг — хуучин orphan-г
            // үлдээвэл UI/server state mismatch үүсэх эрсдэлтэй.
            const existing = await registration.pushManager.getSubscription();
            if (existing) {
                await fetch('/api/push/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: existing.endpoint }),
                }).catch(() => { /* non-critical, server-talasaa cleanup */ });
                await existing.unsubscribe();
            }

            // Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            // Save subscription to server
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: subscription.toJSON() }),
            });

            if (!res.ok) {
                // Browser subscription үүссэн ч server-руу хадгалаагүй —
                // browser side-аас хүчингүй болгож, UI false болгоно.
                await subscription.unsubscribe().catch(() => {});
                throw new Error('Failed to save subscription');
            }

            setIsSubscribed(true);
            setIsLoading(false);
            return true;
        } catch (err: unknown) {
            if (isDev) logger.error('Subscribe error:', { error: err });
            setIsSubscribed(false);
            setIsLoading(false);
            return false;
        }
    }, [isSupported]);

    // Unsubscribe from push notifications
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false;

        setIsLoading(true);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // 1. Server-ийг хүчингүй болгох — амжилтгүй болбол throw,
                //    UI optimistic-аар false-руу шилжихгүй.
                const res = await fetch('/api/push/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                });
                if (!res.ok) {
                    throw new Error('Server unsubscribe амжилтгүй');
                }

                // 2. Зөвхөн server цэвэрлэгдсэний дараа browser-аас unsubscribe
                await subscription.unsubscribe();
            }

            setIsSubscribed(false);
            setIsLoading(false);
            return true;
        } catch (err) {
            if (isDev) logger.error('Unsubscribe error:', { error: err });
            // UI/state-г server-н бодит state-тэй давтан шалгана
            try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                setIsSubscribed(!!sub);
            } catch { /* noop */ }
            setIsLoading(false);
            return false;
        }
    }, [isSupported]);

    return {
        isSupported,
        isSubscribed,
        isLoading,
        permission,
        subscribe,
        unsubscribe,
    };
}

// Helper function to convert base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}
