import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Anon client (legacy — DO NOT use in new code).
//
// ⚠️ Client components ('use client') must use:
//      import { createSupabaseBrowserClient } from '@/lib/supabase-browser';
//    Importing this `supabase` export from a browser context creates a
//    SECOND GoTrueClient instance and triggers the
//    "Multiple GoTrueClient instances" warning, with potential undefined
//    auth behavior under the same storage key.
//
// ⚠️ Server-side API routes / Server Components must use:
//      import { supabaseAdmin } from '@/lib/supabase';     (service role)
//   or import { createSupabaseServerClient } from '@/lib/supabase-server';
//
// Kept only because some non-auth library code may still import it.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role key (for admin operations)
// Creates a new instance per call to avoid session leaks in serverless
export const supabaseAdmin = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
