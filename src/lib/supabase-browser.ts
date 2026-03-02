import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for Client Components (browser-side).
 * Uses cookie-based auth session automatically.
 */
export function createSupabaseBrowserClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}
