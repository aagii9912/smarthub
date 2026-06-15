/**
 * Gemini Provider Implementation
 */

import { GoogleGenerativeAI, Content, Part } from '@google/generative-ai';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, AIProduct } from '@/types/ai';
import type { AIProviderInterface, VisionResult, ChatOptions } from './AIProvider';
import { buildSystemPrompt } from '../services/PromptService';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Vision image-to-image тааруулалтын inline-зургийн хязгаарлалтууд.
 * generateContent inline body нь ~20MB-аар хязгаарлагдсан тул нэг зураг болон
 * нийт хэмжээг хязгаарлаж, prompt-д зай үлдээнэ.
 */
const MAX_VISION_CANDIDATES = 8;
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;   // нэг зураг (base64-ийн өмнө)
const MAX_TOTAL_INLINE_BYTES = 15 * 1024 * 1024;  // нийт base64 урт (~20MB cap-аас доош)

/**
 * Retry with exponential backoff
 */
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '';
        if (retries > 0 && (errorMessage.includes('503') || errorMessage.includes('overloaded'))) {
            logger.warn(`Gemini overloaded, retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

/**
 * Gemini AI Provider
 */
export class GeminiProvider implements AIProviderInterface {
    readonly name = 'gemini';
    readonly model: string;

    constructor(model: string = 'gemini-3.1-flash-lite') {
        this.model = model;
    }

    isAvailable(): boolean {
        return !!process.env.GEMINI_API_KEY;
    }

    async generateChatResponse(
        message: string,
        context: ChatContext,
        history: ChatMessage[],
        options?: ChatOptions
    ): Promise<ChatResponse> {
        const systemPrompt = buildSystemPrompt(context);

        // Convert ChatMessage to Gemini Content format
        const geminiHistory: Content[] = history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        logger.info(`Gemini Provider: Sending to ${this.model}...`);

        return await retryOperation(async () => {
            const chatModel = genAI.getGenerativeModel({
                model: this.model,
                systemInstruction: systemPrompt,
                generationConfig: {
                    temperature: options?.temperature || 0.7,
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: options?.maxTokens || 1024,
                },
            });

            const chat = chatModel.startChat({ history: geminiHistory });
            const result = await chat.sendMessage(message);
            const responseText = result.response.text();

            logger.success('Gemini response received', { length: responseText.length });

            return { text: responseText };
        });
    }

    /**
     * Зургийн URL-г татаж Gemini inlineData болгоно. CDN линк хүчингүй (хугацаа
     * дууссан / устсан) эсвэл зураг биш бол `null` буцаана — ингэснээр алдааны
     * HTML body base64 болж Gemini руу орохоос сэргийлнэ (token дэмий зарцуулах,
     * худал match гаргахаас хамгаална). AbortController-аар timeout тавина.
     * IG story / customer-upload CDN линкүүд богино хугацаатай тул чухал.
     */
    private async fetchInlineImage(
        url: string,
        timeoutMs = 4000
    ): Promise<{ mimeType: string; data: string } | null> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) {
                logger.warn('fetchInlineImage: non-OK response', { status: res.status, url: url.substring(0, 80) });
                return null;
            }
            // content-type-ийн параметрийг (ж: "image/jpeg; charset=utf-8")
            // хасаж зөвхөн bare MIME-г үлдээнэ — Gemini inlineData нь IANA bare
            // type шаарддаг тул параметртэй утга INVALID_ARGUMENT өгдөг.
            const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            if (!mimeType.startsWith('image/')) {
                logger.warn('fetchInlineImage: non-image content-type', { mimeType, url: url.substring(0, 80) });
                return null;
            }
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length === 0) return null;
            if (buf.length > MAX_INLINE_IMAGE_BYTES) {
                logger.warn('fetchInlineImage: image too large, skipping', {
                    bytes: buf.length, url: url.substring(0, 80),
                });
                return null;
            }
            return { mimeType, data: buf.toString('base64') };
        } catch (e) {
            logger.warn('fetchInlineImage: fetch failed', { error: String(e), url: url.substring(0, 80) });
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    async analyzeImage(
        imageUrl: string,
        products: AIProduct[]
    ): Promise<VisionResult> {
        try {
            logger.info('Gemini Vision: Analyzing image...', { imageUrl: imageUrl.substring(0, 80) });

            const visionModel = genAI.getGenerativeModel({
                model: this.model,
                // Pure JSON хариу — model stray brace гаргаснаас болж parse
                // алдахаас сэргийлнэ.
                generationConfig: { responseMimeType: 'application/json' },
            });

            // Барааны эхний ХҮЧИНТЭЙ зургийн URL (хоосон мөр/undefined алгасна).
            const pickUrl = (p: AIProduct): string | undefined =>
                p.image_url || (p.images || []).find(u => !!u);

            // IMAGE-TO-IMAGE: барааны жинхэнэ зурагтай харьцуулна (өмнө нь зөвхөн
            // нэр+тайлбартай тулгадаг байсан). Каталог том байж болзошгүй тул
            // зурагтай нэр дэвшигчдийг тоогоор хязгаарлана. Зураггүй бараа доорх
            // текст жагсаалтаар (fallback) танигдана.
            const withImages = products.filter(p => !!pickUrl(p));
            const candidatePool = withImages.slice(0, MAX_VISION_CANDIDATES);
            const droppedForCount = Math.max(0, withImages.length - candidatePool.length);

            // Эх зураг + нэр дэвшигчдийг ЗЭРЭГ татна (webhook ack замд latency
            // бууруулна — өмнө нь эх зургийг дараалан хүлээдэг байв).
            const [mainImage, candidateFetched] = await Promise.all([
                this.fetchInlineImage(imageUrl),
                Promise.allSettled(candidatePool.map(p => this.fetchInlineImage(pickUrl(p)!))),
            ]);

            // Татах эх зураг (хэрэглэгчийн / story зураг) хүчингүй бол шууд буцна.
            if (!mainImage) {
                logger.warn('Gemini Vision: source image unavailable (expired/non-image)', {
                    imageUrl: imageUrl.substring(0, 80),
                });
                return {
                    matchedProduct: null,
                    matchedProductId: null,
                    confidence: 0,
                    description: 'Зураг боломжгүй байна (хугацаа дууссан эсвэл зураг биш).',
                };
            }

            // Нийт inline хэмжээний төсөв (generateContent ~20MB cap). base64
            // урт ≈ raw bytes × 1.33 тул бага зэрэг хэт тооцох нь аюулгүй талдаа.
            let inlineBudgetLeft = MAX_TOTAL_INLINE_BYTES - mainImage.data.length;
            let droppedForSize = 0;
            const candidateImages: Array<{ id: string; name: string; part: { mimeType: string; data: string } }> = [];
            candidatePool.forEach((p, i) => {
                const r = candidateFetched[i];
                const part = r.status === 'fulfilled' ? r.value : null;
                if (!part) return;
                if (part.data.length > inlineBudgetLeft) { droppedForSize++; return; }
                inlineBudgetLeft -= part.data.length;
                candidateImages.push({ id: p.id, name: p.name, part });
            });

            if (droppedForCount > 0 || droppedForSize > 0) {
                logger.info('Gemini Vision: candidate product images capped', {
                    withImages: withImages.length,
                    sent: candidateImages.length,
                    droppedForCount,
                    droppedForSize,
                });
            }

            // Бүх барааны текст жагсаалт (зурагтай эсэхээс үл хамаарна) — нэрээр
            // таних fallback + PRODUCT_ID-аар буцаах боломж олгоно.
            const productList = products
                .map(p => `- PRODUCT_ID=${p.id} | ${p.name}: ${p.description || ''}`)
                .join('\n');

            const hasCandidateImages = candidateImages.length > 0;
            const matchInstruction = hasCandidateImages
                ? 'Эхний зураг бол ХЭРЭГЛЭГЧийн зураг. Дараагийн зурагнууд бол боломжит бараанууд бөгөөд тус бүрийн өмнө "PRODUCT_ID=..." гэж бичсэн. Хэрэглэгчийн зурагтай ИЖИЛ барааг (өнцөг/гэрэл/арын дэвсгэр өөр байж болно) ол.'
                : 'Эхний зураг бол ХЭРЭГЛЭГЧийн зураг. Доорх бараануудын жагсаалттай тааруулж ал нэгийг нь сонго.';

            const prompt = `Та бол дэлгүүрийн туслах юм. ${matchInstruction}

Бүх бараа:
${productList}

Зөвхөн JSON форматаар хариулна уу:
{
  "matchedProductId": "Тохирсон барааны PRODUCT_ID, эсвэл null",
  "matchedProduct": "Тохирсон барааны нэр (яг ижил нэрээр), эсвэл null",
  "confidence": 0.0-1.0 хооронд тоо,
  "description": "Хэрэглэгчийн зураг дээр юу харагдаж байгааг товч монголоор тайлбарла"
}`;

            const parts: Part[] = [
                { text: prompt },
                { text: 'ХЭРЭГЛЭГЧийн зураг:' },
                { inlineData: mainImage },
            ];
            for (const c of candidateImages) {
                parts.push({ text: `PRODUCT_ID=${c.id} | ${c.name}` });
                parts.push({ inlineData: c.part });
            }

            const result = await visionModel.generateContent(parts);

            const responseText = result.response.text();
            const tokensUsed = result.response.usageMetadata?.totalTokenCount ?? 0;
            logger.success('Gemini Vision response received', { tokensUsed, candidateImages: candidateImages.length });

            let parsed: VisionResult;
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText) as VisionResult;
            } catch (parseErr) {
                logger.warn('Gemini Vision: response not parseable as JSON', {
                    error: String(parseErr),
                    sample: responseText.slice(0, 120),
                });
                return { matchedProduct: null, matchedProductId: null, confidence: 0, description: 'Хариуг танихад алдаа гарлаа.', tokensUsed };
            }

            // Model гаргалтыг хатууруулна: "null" текст → жинхэнэ null,
            // confidence → 0..1 хязгаарлагдсан тоо (NaN/undefined → 0).
            const normNull = (v: unknown): string | null => {
                const s = v == null ? null : String(v);
                return s && s.toLowerCase() !== 'null' ? s : null;
            };
            const matchedProductId = normNull(parsed.matchedProductId);
            const matchedProduct = normNull(parsed.matchedProduct);
            const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
            logger.success('Gemini Vision analysis complete', {
                matched: matchedProduct,
                matchedId: matchedProductId,
                confidence,
            });
            return { ...parsed, matchedProduct, matchedProductId, confidence, tokensUsed };
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('Gemini Vision Error:', { message: err.message });
            return { matchedProduct: null, matchedProductId: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
        }
    }
}
