/**
 * Health Check API Endpoint
 * Returns system health status for monitoring
 */

import { NextResponse } from 'next/server';

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
        api: boolean;
        environment: boolean;
    };
}

const startTime = Date.now();

export async function GET() {
    const response: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        checks: {
            api: true,
            environment: !!(
                process.env.NEXT_PUBLIC_SUPABASE_URL &&
                process.env.OPENAI_API_KEY
            ),
        },
    };

    // Determine overall status
    if (!response.checks.environment) {
        response.status = 'degraded';
    }

    return NextResponse.json(response, {
        status: response.status === 'healthy' ? 200 : 503,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
    });
}
