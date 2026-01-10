import { NextResponse } from 'next/server';

// GET - Return VAPID public key for client
export async function GET() {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
        return NextResponse.json({ error: 'VAPID key not configured' }, { status: 500 });
    }

    return NextResponse.json({
        publicKey: vapidPublicKey
    });
}
