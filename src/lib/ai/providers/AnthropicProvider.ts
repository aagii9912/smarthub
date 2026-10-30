/**
 * Anthropic Provider Implementation (Claude Haiku 5.5 by default)
 */

import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/utils/logger';
import type { ChatContext, ChatMessage, ChatResponse, AIProduct } from '@/types/ai';
import type { AIProviderInterface, VisionResult, ChatOptions } from './AIProvider';
import { buildSystemPrompt } from '../services/PromptService';
import {
    AI_REQUEST_DEFAULTS,
    extractText,
    getAnthropic,
    isAnthropicConfigured,
    resolveBackendModel,
    totalTokens,
} from '../anthropicClient';

/**
 * Vision image-to-image тааруулалтын inline-зургийн хязгаарлалтууд.
 * Зургийг base64 data URL-ээр шууд дамжуулдаг тул нэг зураг болон нийт
 * хэмжээг хязгаарлаж, request body-г боломжийн хэмжээнд барина.
 */
const MAX_VISION_CANDIDATES = 8;
const MAX_INLINE_IMAGE_BYTES = 4 * 1024 * 1024;   // нэг зураг (base64-ийн өмнө)
const MAX_TOTAL_INLINE_BYTES = 15 * 1024 * 1024;  // нийт base64 урт

/** Image formats the Messages API accepts as base64 image blocks. */
type SupportedImageType = Anthropic.Base64ImageSource['media_type'];
const SUPPORTED_IMAGE_TYPES: ReadonlySet<string> = new Set<SupportedImageType>([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]);

const toImageBlock = (img: { mimeType: string; data: string }): Anthropic.ImageBlockParam => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mimeType as SupportedImageType, data: img.data },
});

/**
 * Anthropic AI Provider
 */
export class AnthropicProvider implements AIProviderInterface {
    readonly name = 'anthropic';
    readonly model: string;

    constructor(model?: string) {
        this.model = resolveBackendModel(model);
    }

    isAvailable(): boolean {
        return isAnthropicConfigured();
    }

    async generateChatResponse(
        message: string,
        context: ChatContext,
        history: ChatMessage[],
        options?: ChatOptions
    ): Promise<ChatResponse> {
        const systemPrompt = buildSystemPrompt(context);

        const turns = history
            .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        // The first turn must be `user`.
        const firstUser = turns.findIndex(m => m.role === 'user');
        const messages: Anthropic.MessageParam[] = [
            ...(firstUser === -1 ? [] : turns.slice(firstUser)),
            { role: 'user', content: message },
        ];

        logger.info(`Anthropic Provider: Sending to ${this.model}...`);

        // Haiku 5.5 rejects sampling params, so options.temperature is ignored.
        const result = await getAnthropic().messages.create({
            model: this.model,
            max_tokens: options?.maxTokens || 1024,
            ...AI_REQUEST_DEFAULTS,
            system: systemPrompt,
            messages,
        });
        const responseText = extractText(result);

        logger.success('Anthropic response received', { length: responseText.length });

        return { text: responseText };
    }

    /**
     * Зургийн URL-г татаж base64 болгоно (image block-д ашиглана). CDN линк хүчингүй
     * (хугацаа дууссан / устсан) эсвэл зураг биш бол `null` буцаана — ингэснээр
     * алдааны HTML body base64 болж model руу орохоос сэргийлнэ (token дэмий зарцуулах,
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
            // хасаж зөвхөн bare MIME-г үлдээнэ — data URL-д параметртэй утга
            // орвол зураг буруу танигдана.
            const mimeType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
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
            logger.info('Anthropic Vision: Analyzing image...', { imageUrl: imageUrl.substring(0, 80) });

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
                logger.warn('Anthropic Vision: source image unavailable (expired/non-image)', {
                    imageUrl: imageUrl.substring(0, 80),
                });
                return {
                    matchedProduct: null,
                    matchedProductId: null,
                    confidence: 0,
                    description: 'Зураг боломжгүй байна (хугацаа дууссан эсвэл зураг биш).',
                };
            }

            // Нийт inline хэмжээний төсөв. base64
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
                logger.info('Anthropic Vision: candidate product images capped', {
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

            const parts: Anthropic.ContentBlockParam[] = [
                { type: 'text', text: prompt },
                { type: 'text', text: 'ХЭРЭГЛЭГЧийн зураг:' },
                toImageBlock(mainImage),
            ];
            for (const c of candidateImages) {
                parts.push({ type: 'text', text: `PRODUCT_ID=${c.id} | ${c.name}` });
                parts.push(toImageBlock(c.part));
            }

            const result = await getAnthropic().messages.create({
                model: this.model,
                max_tokens: 512,
                ...AI_REQUEST_DEFAULTS,
                // Pure JSON хариу — доорх regex parse stray текстийг тэсвэрлэнэ.
                system: 'Respond with a single valid JSON object only — no code fences, no prose.',
                messages: [{ role: 'user', content: parts }],
            });

            const responseText = extractText(result);
            const tokensUsed = totalTokens(result.usage);
            logger.success('Anthropic Vision response received', { tokensUsed, candidateImages: candidateImages.length });

            let parsed: VisionResult;
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText) as VisionResult;
            } catch (parseErr) {
                logger.warn('Anthropic Vision: response not parseable as JSON', {
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
            logger.success('Anthropic Vision analysis complete', {
                matched: matchedProduct,
                matchedId: matchedProductId,
                confidence,
            });
            return { ...parsed, matchedProduct, matchedProductId, confidence, tokensUsed };
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('Anthropic Vision Error:', { message: err.message });
            return { matchedProduct: null, matchedProductId: null, confidence: 0, description: 'Зураг боловсруулахад алдаа гарлаа.' };
        }
    }
}
