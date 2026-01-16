'use client';

import { useEffect } from 'react';

const isDev = process.env.NODE_ENV === 'development';

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    if (isDev) console.log('Service Worker registered:', registration.scope);
                })
                .catch((error) => {
                    if (isDev) console.error('Service Worker registration failed:', error);
                });
        }
    }, []);

    return null;
}
