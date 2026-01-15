import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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

export default clerkMiddleware(async (auth, req) => {
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
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
    ],
};
