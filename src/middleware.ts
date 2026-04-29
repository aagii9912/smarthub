import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseMiddlewareClient } from '@/lib/supabase-middleware';
import { checkMiddlewareRateLimit } from '@/lib/utils/rate-limiter';

// Define protected routes
const protectedPaths = ['/dashboard', '/setup', '/admin'];

// Pages an expired-trial / unpaid user CAN still reach so they have somewhere
// to upgrade. Everything else under /dashboard bounces to /dashboard/subscription.
const PAYWALL_BYPASS = [
    '/dashboard/subscription',
    '/dashboard/settings',
];

// Define public routes that don't need auth
const publicPaths = [
    '/',
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password',
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

        // Trial / paywall guard: any /dashboard page (except subscription &
        // settings) requires an active or trialing plan with a valid window.
        // Reads the denormalized snapshot on user_profiles via service role
        // so RLS doesn't accidentally hide the row in the cookie-bound client.
        if (
            pathname.startsWith('/dashboard') &&
            !matchesPath(pathname, PAYWALL_BYPASS)
        ) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            // Fail-open if the service-role env is missing (e.g. preview build
            // without secrets) — the route handler will still enforce limits.
            if (supabaseUrl && serviceKey) {
                const admin = createClient(supabaseUrl, serviceKey, {
                    auth: { persistSession: false, autoRefreshToken: false },
                });

                const { data: profile } = await admin
                    .from('user_profiles')
                    .select('subscription_status, trial_ends_at')
                    .eq('id', user.id)
                    .maybeSingle();

                // Profile not yet created → trigger should populate it shortly.
                // Allow the request through this once.
                if (profile) {
                    const status = profile.subscription_status;
                    const trialEndsAt = profile.trial_ends_at
                        ? new Date(profile.trial_ends_at).getTime()
                        : null;
                    const trialExpired =
                        status === 'trialing' &&
                        trialEndsAt !== null &&
                        trialEndsAt < Date.now();

                    const blocked =
                        status === 'unpaid' ||
                        status === 'expired' ||
                        status === 'expired_trial' ||
                        status === 'canceled' ||
                        trialExpired;

                    if (blocked) {
                        const url = new URL('/dashboard/subscription', req.url);
                        url.searchParams.set('expired', '1');
                        return NextResponse.redirect(url);
                    }
                }
            }
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
