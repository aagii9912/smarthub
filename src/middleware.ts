import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { checkMiddlewareRateLimit } from '@/lib/utils/rate-limiter';

// Define protected routes
const isProtectedRoute = createRouteMatcher([
    '/dashboard(.*)',
    '/setup(.*)',
    '/admin(.*)',
]);

// Define public routes that don't need auth
const isPublicRoute = createRouteMatcher([
    '/',
    '/auth/login',
    '/auth/register',
    '/admin/login(.*)',
    '/api/webhook(.*)',
    '/api/subscription/webhook',
    '/api/payment/webhook',
    '/privacy',
    '/terms',
    '/help',
]);

// AI/Chat routes (strict rate limit)
const isAIRoute = createRouteMatcher([
    '/api/chat(.*)',
    '/api/ai(.*)',
]);

// Webhook routes (relaxed rate limit)
const isWebhookRoute = createRouteMatcher([
    '/api/webhook(.*)',
    '/api/subscription/webhook',
    '/api/payment/webhook',
]);

export default clerkMiddleware(async (auth, req) => {
    // Rate limiting for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
        let routeType: 'strict' | 'standard' | 'webhook' = 'standard';

        if (isAIRoute(req)) {
            routeType = 'strict';
        } else if (isWebhookRoute(req)) {
            routeType = 'webhook';
        }

        const rateLimit = checkMiddlewareRateLimit(req, routeType);
        if (!rateLimit.allowed && rateLimit.response) {
            return rateLimit.response;
        }
    }

    // Allow public routes
    if (isPublicRoute(req)) {
        return NextResponse.next();
    }

    // Check auth for protected routes
    if (isProtectedRoute(req)) {
        const { userId } = await auth();

        if (!userId) {
            const signInUrl = new URL('/auth/login', req.url);
            signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
            return NextResponse.redirect(signInUrl);
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|api/webhook|api/payment/webhook|api/subscription/webhook|api/meta/data-deletion|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
    ],
};

