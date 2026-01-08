import OpenAI from 'openai';
import { logger } from '@/lib/utils/logger';
import { supabaseAdmin } from '@/lib/supabase';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export interface ChatContext {
    shopId: string;
    customerId?: string;
    shopName: string;
    shopDescription?: string;
    aiInstructions?: string;
    products: Array<{
        id: string;
        name: string;
        price: number;
        stock: number;
        description?: string;
        type?: 'product' | 'service';  // product = бараа, service = үйлчилгээ
        unit?: string;  // e.g., 'ширхэг', 'захиалга', 'цаг'
        variants?: Array<{
            color: string | null;
            size: string | null;
            stock: number;
        }>;
    }>;
    customerName?: string;
    orderHistory?: number;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        if (retries > 0 && (error.status === 429 || error.status === 503)) {
            logger.warn(`OpenAI rate limited, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

export async function analyzeProductImage(
    imageUrl: string,
    products: Array<{
        id: string;
        name: string;
        description?: string;
    }>
): Promise<{ matchedProduct: string | null; confidence: number; description: string }> {
    try {
        logger.info('analyzeProductImage called for:', { imageUrl });

        const productList = products.map(p => `- ${p.name}: ${p.description || ''}`).join('\n');

        const prompt = `Та бол дэлгүүрийн туслах юм. Энэ зургийг судалж, доорх бүтээгдэхүүнүүдийн алинтай нь тохирч байгааг хэлнэ үү.

Боломжит бүтээгдэхүүнүүд:
${productList}

Зөвхөн JSON форматаар хариулна уу:
{
  "matchedProduct": "Тохирсон бүтээгдэхүүний нэр (яг ижил нэрээр), эсвэл null",
  "confidence": 0.0-1.0 хооронд тоо,
  "description": "Зураг дээр юу харагдаж байгааг товч монголоор тайлбарла"
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageUrl } }
                    ]
                }
            ],
            max_completion_tokens: 500,
        });

        const responseText = response.choices[0]?.message?.content || '';
        logger.success('Vision response:', { responseText });

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { matchedProduct: null, confidence: 0, description: 'Зургийг таньж чадсангүй.' };
    } catch (error) {
        logger.error('OpenAI Vision Error:', { error });
        return { matchedProduct: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
    }
}

export async function generateChatResponse(
    message: string,
    context: ChatContext,
    previousHistory: ChatMessage[] = []
): Promise<string> {
    try {
        logger.debug('generateChatResponse called with:', {
            message,
            contextShopName: context.shopName,
            productsCount: context.products?.length || 0,
            historyLength: previousHistory.length
        });

        if (!context.shopName) {
            throw new Error('Shop name is required');
        }

        if (!Array.isArray(context.products)) {
            logger.warn('Products is not an array, converting to empty array');
            context.products = [];
        }

        const productsInfo = context.products.length > 0
            ? context.products.map(p => {
                const isService = p.type === 'service';
                const unit = p.unit || (isService ? 'захиалга' : 'ширхэг');

                // Different display for products vs services
                let stockDisplay: string;
                if (p.stock > 0) {
                    if (isService) {
                        stockDisplay = `${p.stock} ${unit} авах боломжтой`;
                    } else {
                        stockDisplay = `${p.stock} ${unit} байна`;
                    }
                } else {
                    if (isService) {
                        stockDisplay = 'Захиалга дүүрсэн';
                    } else {
                        stockDisplay = 'Дууссан';
                    }
                }

                const typeLabel = isService ? '[ҮЙЛЧИЛГЭЭ]' : '[БАРАА]';

                const variantInfo = p.variants && p.variants.length > 0
                    ? `\n  Хувилбарууд: ${p.variants.map(v => `${v.color || ''} ${v.size || ''} (${v.stock > 0 ? `${v.stock}${unit}` : 'Дууссан'})`).join(', ')}`
                    : '';
                return `- ${typeLabel} ${p.name}: ${p.price.toLocaleString()}₮ (${stockDisplay})${variantInfo}`;
            }).join('\n')
            : '- Одоогоор бүтээгдэхүүн бүртгэгдээгүй байна';

        // Build custom instructions section
        const customInstructions = context.aiInstructions
            ? `\nДЭЛГҮҮРИЙН ЭЗНИЙ ЗААВАР:\n${context.aiInstructions}\n`
            : '';

        const shopInfo = context.shopDescription
            ? `\nДЭЛГҮҮРИЙН ТУХАЙ: ${context.shopDescription}`
            : '';

        const systemPrompt = `Та "${context.shopName}" дэлгүүрийн борлуулагч.
${shopInfo}${customInstructions}
ЧУХАЛ ДҮРЭМ:
1. БОГИНО хариулт (1-2 өгүүлбэр л!)
2. "Сайн байна уу" БҮҮ ДАВТ
3. Бүтээгдэхүүн САНАЛ БОЛГОХГҮЙ (хэрэглэгч асуувал л хариул)
4. Энгийн ярианы хэл
5. 1-2 emoji л 😊
6. [БАРАА] = физик бүтээгдэхүүн (stock = тоо хэмжээ)
7. [ҮЙЛЧИЛГЭЭ] = үйлчилгээ (stock = боломжит захиалгын тоо)

ЖИШЭЭ:
- Бараа: "5 ширхэг л үлдсэн 👍"
- Үйлчилгээ: "3 захиалга авах боломжтой байна"
- Үйлчилгээ дүүрсэн: "Одоогоор захиалга дүүрсэн байна, дараа долоо хоногт шалгаарай 🙏"

БҮТЭЭГДЭХҮҮН/ҮЙЛЧИЛГЭЭ:
${productsInfo}

${context.customerName ? `Хэрэглэгч: ${context.customerName}` : ''}
${context.orderHistory ? `VIP (${context.orderHistory}x)` : ''}

БҮҮ ХИЙ:
- Бүтээгдэхүүн санал болгох (асуугаагүй бол)
- Урт хариулт
- Давтан мэндлэх`;

        const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: 'function',
                function: {
                    name: 'create_order',
                    description: 'Create a new order when customer explicitly says they want to buy something. Do not use for general inquiries.',
                    parameters: {
                        type: 'object',
                        properties: {
                            product_name: {
                                type: 'string',
                                description: 'Name of the product to order (fuzzy match)'
                            },
                            quantity: {
                                type: 'number',
                                description: 'Quantity to order',
                                default: 1
                            },
                            color: {
                                type: 'string',
                                description: 'Selected color variant (optional)'
                            },
                            size: {
                                type: 'string',
                                description: 'Selected size variant (optional)'
                            }
                        },
                        required: ['product_name', 'quantity']
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'collect_contact_info',
                    description: 'Save customer contact information when they provide phone number or delivery address for an order. Use this when customer shares their phone or address.',
                    parameters: {
                        type: 'object',
                        properties: {
                            phone: {
                                type: 'string',
                                description: 'Customer phone number (8 digits for Mongolia)'
                            },
                            address: {
                                type: 'string',
                                description: 'Delivery address'
                            },
                            name: {
                                type: 'string',
                                description: 'Customer name if provided'
                            }
                        },
                        required: []
                    }
                }
            }
        ];

        const messages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...previousHistory,
            { role: 'user', content: message }
        ];

        logger.debug('System prompt prepared', { length: systemPrompt.length });

        return await retryOperation(async () => {
            logger.info('Sending message to OpenAI GPT-4o mini...');

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_completion_tokens: 800,
                tools: tools,
                tool_choice: 'auto',
            });

            const responseMessage = response.choices[0]?.message;
            let finalResponseText = responseMessage?.content || '';

            // Handle Tool Calls
            if (responseMessage?.tool_calls) {
                const toolCalls = responseMessage.tool_calls;
                logger.info('AI triggered tool calls:', { count: toolCalls.length });

                // Add assistant's tool call message to history
                messages.push(responseMessage as any);

                for (const toolCall of toolCalls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name;
                        const args = JSON.parse(toolCall.function.arguments);

                        logger.info(`Executing tool: ${functionName}`, args);

                        // Handle collect_contact_info
                        if (functionName === 'collect_contact_info') {
                            try {
                                const { phone, address, name } = args;

                                if (!context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: 'No customer context' })
                                    } as any);
                                    continue;
                                }

                                const supabase = supabaseAdmin();
                                const updateData: Record<string, any> = {};

                                if (phone) updateData.phone = phone;
                                if (address) updateData.address = address;
                                if (name) updateData.name = name;

                                if (Object.keys(updateData).length > 0) {
                                    await supabase
                                        .from('customers')
                                        .update(updateData)
                                        .eq('id', context.customerId);

                                    logger.info('Contact info saved to CRM:', updateData);

                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({
                                            success: true,
                                            message: `Saved: ${phone ? 'phone ' : ''}${address ? 'address ' : ''}${name ? 'name' : ''}`
                                        })
                                    } as any);
                                } else {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ message: 'No info to save' })
                                    } as any);
                                }
                            } catch (error: any) {
                                logger.error('Contact save error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                            continue;
                        }

                        // Handle create_order
                        if (functionName === 'create_order') {
                            try {
                                const { product_name, quantity, color, size } = args;

                                // 1. Find Product
                                const product = context.products.find(p =>
                                    p.name.toLowerCase().includes(product_name.toLowerCase())
                                );

                                if (!product) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Product "${product_name}" not found.` })
                                    } as any);
                                    continue;
                                }

                                // 2. Check Stock
                                /* 
                                    Note: context.products might be slightly stale compared to DB, 
                                    but for MVP it's okay. Truly we should verify stock from DB here 
                                    but we need supabase access. 
                                    Since we added supabaseAdmin import, let's use it!
                                */

                                const supabase = supabaseAdmin();

                                // Verify stock from DB
                                const { data: dbProduct } = await supabase
                                    .from('products')
                                    .select('stock, price, id')
                                    .eq('id', product.id)
                                    .single();

                                if (!dbProduct || dbProduct.stock < quantity) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Not enough stock. Only ${dbProduct?.stock || 0} left.` })
                                    } as any);
                                    continue;
                                }

                                // 3. Create Order
                                if (!context.shopId || !context.customerId) {
                                    messages.push({
                                        role: 'tool',
                                        tool_call_id: toolCall.id,
                                        content: JSON.stringify({ error: `Missing shop or customer ID context.` })
                                    } as any);
                                    continue;
                                }

                                const { data: order, error: orderError } = await supabase
                                    .from('orders')
                                    .insert({
                                        shop_id: context.shopId,
                                        customer_id: context.customerId,
                                        status: 'pending',
                                        total_amount: dbProduct.price * quantity,
                                        notes: `AI Order: ${product_name} (${color || ''} ${size || ''})`,
                                        created_at: new Date().toISOString()
                                    })
                                    .select()
                                    .single();

                                if (orderError) throw orderError;

                                // 4. Create Order Item & Deduct Stock
                                await supabase.from('order_items').insert({
                                    order_id: order.id,
                                    product_id: product.id,
                                    quantity: quantity,
                                    unit_price: dbProduct.price,
                                    color: color || null,
                                    size: size || null
                                });

                                // Deduct stock
                                const { error: rpcError } = await supabase.rpc('decrement_stock', {
                                    p_id: product.id,
                                    qty: quantity
                                });

                                if (rpcError) {
                                    // Fallback if RPC doesn't exist
                                    await supabase
                                        .from('products')
                                        .update({ stock: dbProduct.stock - quantity })
                                        .eq('id', product.id);
                                }

                                const successMessage = `Success! Order #${order.id.substring(0, 8)} created. Total: ${(dbProduct.price * quantity).toLocaleString()}₮. Stock deducted.`;

                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ success: true, message: successMessage })
                                } as any);

                            } catch (error: any) {
                                logger.error('Tool execution error:', error);
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: error.message })
                                } as any);
                            }
                        }
                    }
                }

                // Call OpenAI again with tool results
                const secondResponse = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_completion_tokens: 800,
                });

                finalResponseText = secondResponse.choices[0]?.message?.content || '';

                // Monitor second request token usage too
                if (secondResponse.usage) {
                    logger.info('Token usage (post-tool):', {
                        total_tokens: secondResponse.usage.total_tokens
                    });
                }
            }

            // Log token usage (first request)
            const usage = response.usage;
            if (usage) {
                logger.info('Token usage:', {
                    prompt_tokens: usage.prompt_tokens,
                    completion_tokens: usage.completion_tokens,
                    total_tokens: usage.total_tokens,
                    estimated_cost_usd: ((usage.prompt_tokens * 0.00025 / 1000) + (usage.completion_tokens * 0.002 / 1000)).toFixed(6)
                });
            }

            logger.success('OpenAI response received', { length: finalResponseText.length });

            return finalResponseText;
        });
    } catch (error: any) {
        logger.error('OpenAI API Error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            status: error?.status
        });
        throw error;
    }
}

export async function parseProductDataWithAI(
    fileContent: string,
    fileName: string
): Promise<Array<{
    name: string;
    price: number;
    stock: number;
    description: string;
    type: 'physical' | 'service';
    unit: string;
    colors: string[];
    sizes: string[];
}>> {
    try {
        logger.info('Parsing product data with AI...', { fileName, contentLength: fileContent.length });

        const prompt = `
You are a data extraction assistant. Extract products and services from the provided file content.
Filename: "${fileName}"

RULES:
1. Extract ALL items found.
2. Determine 'type': 'physical' for physical goods (phones, clothes), 'service' for services (repair, editing, consulting).
3. Determine 'unit': e.g., 'ширхэг' for goods, 'захиалга', 'цаг', 'хүн' for services.
4. Extract 'stock': For services, this is the Number of Available Slots/Orders. If not specified, default to 0.
5. Extract 'colors' and 'sizes' if available.
6. Return a JSON object with a "products" array.

Input Content:
${fileContent.slice(0, 15000)} -- truncated if too long

Response Format (JSON only):
{
  "products": [
    {
      "name": "Product Name",
      "price": 0,
      "stock": 0,
      "description": "Description",
      "type": "physical" | "service",
      "unit": "ширхэг" | "захиалга" | "цаг",
      "colors": ["red", "blue"],
      "sizes": ["S", "M"]
    }
  ]
}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Use a capable model for extraction
            messages: [
                { role: 'system', content: 'You are a helpful data extraction assistant that outputs JSON.' },
                { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);

        if (!Array.isArray(result.products)) {
            logger.warn('AI returned invalid format', result);
            return [];
        }

        return result.products.map((p: any) => ({
            name: p.name || 'Unnamed',
            price: Number(p.price) || 0,
            stock: Number(p.stock) || 0,
            description: p.description || '',
            type: p.type === 'service' ? 'service' : 'physical',
            unit: p.unit || (p.type === 'service' ? 'захиалга' : 'ширхэг'),
            colors: Array.isArray(p.colors) ? p.colors : [],
            sizes: Array.isArray(p.sizes) ? p.sizes : []
        }));

    } catch (error: any) {
        logger.error('AI Parse Error:', { message: error?.message || error });
        return [];
    }
}

