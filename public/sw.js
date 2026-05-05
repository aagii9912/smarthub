// SmartHub Service Worker
const CACHE_NAME = 'smarthub-v2';
const STATIC_ASSETS = [
    '/dashboard',
    '/icon-192.png',
    '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests (always network)
    if (event.request.url.includes('/api/')) return;

    // Cross-origin (өөр домэйны) хүсэлтийг хөндөхгүй —
    // FB Pixel, Google Fonts г.м-ийг SW барьж авбал CSP-ын
    // connect-src блок хийнэ, мөн зөв Response буцаахгүй бол
    // "Failed to convert value to 'Response'" алдаа цацарна.
    let requestUrl;
    try {
        requestUrl = new URL(event.request.url);
    } catch {
        return;
    }
    if (requestUrl.origin !== self.location.origin) return;

    // Skip non-http(s) schemes (chrome-extension://, blob:, data:, etc.)
    if (requestUrl.protocol !== 'http:' && requestUrl.protocol !== 'https:') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful, basic (same-origin) responses only
                if (response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(async () => {
                // Fallback to cache; үргэлж хүчинтэй Response буцаах
                const cached = await caches.match(event.request);
                return cached || new Response('', {
                    status: 504,
                    statusText: 'Offline',
                });
            })
    );
});

// Push notification event
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'Шинэ мэдэгдэл байна',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/dashboard',
            ...data
        },
        actions: data.actions || [
            { action: 'open', title: 'Нээх' },
            { action: 'close', title: 'Хаах' }
        ],
        tag: data.tag || 'smarthub-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'SmartHub', options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/dashboard';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if available
                for (const client of clientList) {
                    if (client.url.includes('/dashboard') && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open new window
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
