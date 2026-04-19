import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware';
import { checkMiddlewareRateLimit } from '@/lib/utils/rate-limiter';

// Define protected routes
const protectedPaths = ['/dashboard', '/setup', '/admin'];

// Define public routes that don't need auth
const publicPaths = [
    '/',
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/admin/login',
    '/api/webhook',
    '/api/subscription/webhook',
    '/api/payment/webhook',
    '/api/pay',
    '/pay',
    '/privacy',
    '/terms',
    '/help',
];

// AI/Chat routes (strict rate limit)
const aiPaths = ['/api/chat', '/api/ai'];

// Webhook routes (relaxed rate limit)
const webhookPaths = ['/api/webhook', '/api/subscription/webhook', '/api/payment/webhook'];

// Debug / test-only routes — 404 in production
const devOnlyPaths = ['/api/debug', '/api/debug-auth', '/test', '/test-ui'];

function matchesPath(pathname: string, paths: string[]): boolean {
    return paths.some(path => pathname === path || pathname.startsWith(path + '/') || pathname.startsWith(path + '?'));
}

export default async function middleware(req: NextRequest) {
    // ── FAST BYPASS: Payment pages must work in Messenger WebView ──
    // Messenger in-app browser doesn't support cookies/auth
    // These routes need ZERO middleware processing
    const pathname = req.nextUrl.pathname;
    if (pathname.startsWith('/pay') || pathname.startsWith('/api/pay/')) {
        return NextResponse.next();
    }

    // Block dev-only debug/test routes in production
    if (process.env.NODE_ENV === 'production' && matchesPath(pathname, devOnlyPaths)) {
        return new NextResponse('Not Found', { status: 404 });
    }

    const { supabase, supabaseResponse } = createSupabaseMiddlewareClient(req);

    // Rate limiting for API routes
    if (pathname.startsWith('/api/')) {
        let routeType: 'strict' | 'standard' | 'webhook' = 'standard';

        if (matchesPath(pathname, aiPaths)) {
            routeType = 'strict';
        } else if (matchesPath(pathname, webhookPaths)) {
            routeType = 'webhook';
        }

        const rateLimit = await checkMiddlewareRateLimit(req, routeType);
        if (!rateLimit.allowed && rateLimit.response) {
            return rateLimit.response;
        }
    }

    // Allow public routes
    if (matchesPath(pathname, publicPaths)) {
        // Still refresh the session even on public routes
        await supabase.auth.getUser();
        return supabaseResponse;
    }

    // Check auth for protected routes
    if (matchesPath(req.nextUrl.pathname, protectedPaths)) {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            const signInUrl = new URL('/auth/login', req.url);
            signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
            return NextResponse.redirect(signInUrl);
        }
    }

    // For all other routes, refresh the session
    await supabase.auth.getUser();
    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|api/meta/data-deletion|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
    ],
};
