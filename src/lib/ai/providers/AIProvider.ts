/**
 * AI Provider Interface - Unified abstraction for all AI providers
 */

import type { ChatContext, ChatMessage, ChatResponse, AIProduct } from '@/types/ai';

/**
 * Vision analysis result
 */
export interface VisionResult {
    /** Тохирсон барааны нэр (хуучин зан төлөв — нэрээр substring тааруулна). */
    matchedProduct: string | null;
    /**
     * Тохирсон барааны ID. Image-to-image тааруулалт ажиллах үед vision яг
     * энэ ID-г буцаадаг тул substring reconciliation хэрэггүй болно. Хэрэв
     * боломжгүй бол null — энэ үед `matchedProduct` (нэр) рүү fallback хийнэ.
     */
    matchedProductId?: string | null;
    confidence: number;
    description: string;
    isReceipt?: boolean;
    receiptAmount?: number;
    /** Total tokens consumed by the vision call (for per-feature billing). */
    tokensUsed?: number;
}

/**
 * Provider chat options
 */
export interface ChatOptions {
    maxTokens?: number;
    temperature?: number;
    tools?: unknown[];
}

/**
 * Base interface for all AI providers
 */
export interface AIProviderInterface {
    readonly name: string;
    readonly model: string;

    /**
     * Generate chat response
     */
    generateChatResponse(
        message: string,
        context: ChatContext,
        history: ChatMessage[],
        options?: ChatOptions
    ): Promise<ChatResponse>;

    /**
     * Analyze image for product matching
     */
    analyzeImage(
        imageUrl: string,
        products: AIProduct[]
    ): Promise<VisionResult>;

    /**
     * Check if provider is available (API key configured)
     */
    isAvailable(): boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
    apiKey: string;
    timeout?: number;
    maxRetries?: number;
}
