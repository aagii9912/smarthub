
import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message } = body;

        const mockContext = {
            shopId: 'test-shop-id',
            shopName: 'Test Shop',
            products: [
                { id: '1', name: 'Test Product', price: 50000, stock: 10, type: 'physical' as const }
            ]
        };

        const response = await generateChatResponse(message, mockContext, []);

        return NextResponse.json({
            input: message,
            response: response,
            isSafe: !response.toLowerCase().includes('python') && !response.includes('1990') // Simple check
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
