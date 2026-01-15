
import { NextResponse } from 'next/server';
import { getClerkUser, supabaseAdmin } from '@/lib/auth/clerk-auth';

export async function GET() {
    try {
        const userId = await getClerkUser();
        const supabase = supabaseAdmin();

        if (!userId) {
            return NextResponse.json({ error: 'No Clerk userId found' });
        }

        // Get all shops for this user
        const { data: shops, error: shopsError } = await supabase
            .from('shops')
            .select('*')
            .eq('user_id', userId);

        // Get total customer count globally (to see if data exists at all)
        const { count: totalCustomers } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });

        return NextResponse.json({
            currentUserId: userId,
            shops: shops || [],
            shopsError,
            totalGlobalCustomers: totalCustomers
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message });
    }
}
