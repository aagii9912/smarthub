import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth/auth';

export async function GET(request: NextRequest) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = supabaseAdmin();
        const { searchParams } = new URL(request.url);
        const statusStr = searchParams.get('status');

        let query = supabase.from('webhook_jobs').select('*').order('updated_at', { ascending: false }).limit(100);
        
        if (statusStr && statusStr !== 'all') {
            query = query.eq('status', statusStr);
        }

        const { data, error } = await query;

        if (error) throw error;
        
        return NextResponse.json({ jobs: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { jobId, action = 'retry' } = body;
        const supabase = supabaseAdmin();

        if (action === 'retry') {
            const { error } = await supabase
                .from('webhook_jobs')
                .update({ 
                    status: 'pending', 
                    next_retry_at: new Date().toISOString() 
                })
                .eq('id', jobId)
                .in('status', ['dead', 'completed', 'failed']); 
            
            if (error) throw error;
            return NextResponse.json({ success: true });
        }
        
        if (action === 'delete') {
            const { error } = await supabase.from('webhook_jobs').delete().eq('id', jobId);
            if (error) throw error;
            return NextResponse.json({ success: true });
        }
        
        if (action === 'clear_dead') {
            const { error } = await supabase.from('webhook_jobs').delete().eq('status', 'dead');
            if (error) throw error;
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
