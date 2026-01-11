/**
 * Admin Login API
 * Validates admin password and returns session token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

// Admin password from environment variable or default
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Moon1160';

// Simple token generation
function generateToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return createHash('sha256').update(timestamp + random + ADMIN_PASSWORD).digest('hex').substring(0, 32);
}

// Store valid tokens (in production, use Redis or database)
const validTokens = new Set<string>();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password } = body;

        if (!password) {
            return NextResponse.json(
                { error: 'Password is required' },
                { status: 400 }
            );
        }

        // Check password
        if (password !== ADMIN_PASSWORD) {
            return NextResponse.json(
                { error: 'Буруу нууц үг' },
                { status: 401 }
            );
        }

        // Generate session token
        const token = generateToken();
        validTokens.add(token);

        // Auto-expire after 24 hours (cleanup)
        setTimeout(() => {
            validTokens.delete(token);
        }, 24 * 60 * 60 * 1000);

        return NextResponse.json({
            success: true,
            token,
            message: 'Амжилттай нэвтэрлээ'
        });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Login failed' },
            { status: 500 }
        );
    }
}

// Verify token endpoint
export async function GET(request: NextRequest) {
    const token = request.cookies.get('admin_token')?.value;

    if (!token || !validTokens.has(token)) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
}

// Export for use in other files
export { validTokens };
