import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/auth/clerk-auth';

export async function POST(req: Request) {
    // Get webhook secret from environment
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
        console.error('Missing CLERK_WEBHOOK_SECRET');
        return NextResponse.json(
            { error: 'Webhook secret not configured' },
            { status: 500 }
        );
    }

    // Get headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get('svix-id');
    const svix_timestamp = headerPayload.get('svix-timestamp');
    const svix_signature = headerPayload.get('svix-signature');

    if (!svix_id || !svix_timestamp || !svix_signature) {
        return NextResponse.json(
            { error: 'Missing svix headers' },
            { status: 400 }
        );
    }

    // Get body
    const payload = await req.json();
    const body = JSON.stringify(payload);

    // Verify webhook
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: WebhookEvent;

    try {
        evt = wh.verify(body, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as WebhookEvent;
    } catch (err) {
        console.error('Webhook verification failed:', err);
        return NextResponse.json(
            { error: 'Webhook verification failed' },
            { status: 400 }
        );
    }

    // Handle events
    const eventType = evt.type;
    const supabase = supabaseAdmin();

    if (eventType === 'user.created') {
        const { id, email_addresses, first_name, last_name } = evt.data;
        const email = email_addresses[0]?.email_address;
        const fullName = [first_name, last_name].filter(Boolean).join(' ');

        console.log(`New user created: ${email} (${id})`);

        // Create a default shop for new users
        const { error } = await supabase
            .from('shops')
            .insert([{
                user_id: id,
                name: `${fullName || email?.split('@')[0]}'s Shop`,
                owner_name: fullName || null,
                is_active: true,
                setup_completed: false,
            }]);

        if (error) {
            console.error('Error creating shop for new user:', error);
        }
    }

    if (eventType === 'user.updated') {
        const { id, first_name, last_name } = evt.data;
        const fullName = [first_name, last_name].filter(Boolean).join(' ');

        // Update shop owner name when user updates profile
        if (fullName) {
            await supabase
                .from('shops')
                .update({ owner_name: fullName })
                .eq('user_id', id)
                .is('owner_name', null);
        }
    }

    if (eventType === 'user.deleted') {
        const { id } = evt.data;

        // Optionally deactivate shops when user is deleted
        await supabase
            .from('shops')
            .update({ is_active: false })
            .eq('user_id', id);
    }

    return NextResponse.json({ received: true });
}
