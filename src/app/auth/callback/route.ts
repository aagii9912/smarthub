import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { provisionNewUserTrial, chooseLandingPath } from '@/lib/auth/onboarding';
import { logger } from '@/lib/utils/logger';

/**
 * OAuth callback handler.
 *
 * Exchanges the auth code for a session, then:
 *   1. Provisions a 3-day Lite trial for first-time users (idempotent).
 *   2. Routes the user to the right next step:
 *        - explicit `redirect_url` query param wins (used by email-verify links).
 *        - else, decide based on shop state (no shops → /setup, ready shop → /dashboard).
 *
 * Fixes bug #6 (new Google sign-in skipping payment) and lays the
 * groundwork for #7 (existing user re-running setup wizard).
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const explicitRedirect = requestUrl.searchParams.get('redirect_url');

    let landing = explicitRedirect;

    if (code) {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
            logger.warn('OAuth code exchange failed', { error: error.message });
            return NextResponse.redirect(new URL('/auth/login?error=oauth', requestUrl.origin));
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
            // Always provision — idempotent. Failure here must not block sign-in.
            await provisionNewUserTrial(user.id, user.email ?? null);

            // Only auto-route when caller didn't pin a destination.
            if (!landing) {
                landing = await chooseLandingPath(user.id);
            }
        }
    }

    return NextResponse.redirect(new URL(landing || '/dashboard', requestUrl.origin));
}
