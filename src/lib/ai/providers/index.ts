/**
 * AI Provider Factory - Anthropic only
 */

import type { AIProviderInterface } from './AIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { isAnthropicConfigured, resolveBackendModel } from '../anthropicClient';
import type { AIModel } from '../config/plans';
import { logger } from '@/lib/utils/logger';

// Singleton instance
let anthropicProvider: AnthropicProvider | null = null;

/**
 * Get Anthropic provider instance
 */
export function getProvider(
    _providerType?: string,
    model?: AIModel
): AIProviderInterface {
    if (!isAnthropicConfigured()) {
        logger.error('ANTHROPIC_API_KEY not configured');
        throw new Error('ANTHROPIC_API_KEY is required');
    }

    const modelName = resolveBackendModel(model);

    if (!anthropicProvider || anthropicProvider.model !== modelName) {
        anthropicProvider = new AnthropicProvider(modelName);
    }
    return anthropicProvider;
}

/**
 * Get the best available provider (always Anthropic)
 */
export function getBestAvailableProvider(
    _preferred?: string,
    model?: AIModel
): AIProviderInterface {
    return getProvider('anthropic', model);
}

// Re-exports
export type { AIProviderInterface, VisionResult, ChatOptions } from './AIProvider';
export { AnthropicProvider } from './AnthropicProvider';
