/**
 * AI Provider Factory - Creates and manages provider instances
 */

import type { AIProviderInterface } from './AIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';
import type { AIProvider, AIModel } from '../config/plans';
import { logger } from '@/lib/utils/logger';

// Singleton instances
let openaiProvider: OpenAIProvider | null = null;
let geminiProvider: GeminiProvider | null = null;

/**
 * Model mapping for OpenAI (GPT-5 -> GPT-4o backend)
 */
const OPENAI_MODEL_MAPPING: Record<string, string> = {
    'gpt-5-nano': process.env.GPT5_NANO_MODEL || 'gpt-4o-mini',
    'gpt-5-mini': process.env.GPT5_MINI_MODEL || 'gpt-4o-mini',
    'gpt-5': process.env.GPT5_MODEL || 'gpt-4o',
};

/**
 * Get provider instance by type
 */
export function getProvider(
    providerType: AIProvider,
    model?: AIModel
): AIProviderInterface {
    if (providerType === 'gemini') {
        // Check if Gemini is available
        if (!process.env.GEMINI_API_KEY) {
            logger.warn('Gemini API key not configured, falling back to OpenAI');
            return getProvider('openai', model);
        }

        if (!geminiProvider) {
            geminiProvider = new GeminiProvider(model || 'gemini-2.5-flash');
        }
        return geminiProvider;
    }

    // Default to OpenAI
    const backendModel = model ? OPENAI_MODEL_MAPPING[model] || model : 'gpt-4o-mini';

    if (!openaiProvider || openaiProvider.model !== backendModel) {
        openaiProvider = new OpenAIProvider(backendModel);
    }
    return openaiProvider;
}

/**
 * Get the best available provider (prefers configured, falls back)
 */
export function getBestAvailableProvider(
    preferred: AIProvider = 'openai',
    model?: AIModel
): AIProviderInterface {
    const provider = getProvider(preferred, model);

    if (provider.isAvailable()) {
        return provider;
    }

    // Fallback to the other provider
    const fallback = preferred === 'openai' ? 'gemini' : 'openai';
    logger.warn(`${preferred} not available, falling back to ${fallback}`);

    return getProvider(fallback, model);
}

// Re-exports
export type { AIProviderInterface, VisionResult, ChatOptions } from './AIProvider';
export { OpenAIProvider } from './OpenAIProvider';
export { GeminiProvider } from './GeminiProvider';
