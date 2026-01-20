/**
 * A/B Testing Framework - Prompt optimization through experimentation
 * Allows testing different prompts, models, and configurations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * Experiment types
 */
export type ExperimentType =
    | 'prompt_variant'     // Different system prompts
    | 'model_variant'      // Different AI models
    | 'tool_variant'       // Different tool configurations
    | 'temperature'        // Different temperature settings
    | 'closing_tactic';    // Different sales closing tactics

/**
 * Variant configuration
 */
export interface Variant {
    id: string;
    name: string;
    weight: number;          // 0-100, percentage of traffic
    config: Record<string, unknown>;
}

/**
 * Experiment definition
 */
export interface Experiment {
    id: string;
    name: string;
    type: ExperimentType;
    description: string;
    variants: Variant[];
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
    targetShopIds?: string[];  // If empty, applies to all
}

/**
 * Experiment result
 */
export interface ExperimentResult {
    experimentId: string;
    variantId: string;
    shopId: string;
    customerId?: string;
    eventType: 'impression' | 'conversion' | 'cart_add' | 'checkout';
    metadata?: Record<string, unknown>;
    timestamp: Date;
}

/**
 * A/B Test manager
 */
export class ABTestManager {
    private experiments: Map<string, Experiment> = new Map();

    /**
     * Load experiments from database
     */
    async loadExperiments(): Promise<void> {
        try {
            const supabase = supabaseAdmin();

            const { data, error } = await supabase
                .from('ab_experiments')
                .select('*')
                .eq('is_active', true)
                .gte('end_date', new Date().toISOString())
                .or('end_date.is.null');

            if (error) {
                logger.error('Failed to load experiments:', { error });
                return;
            }

            this.experiments.clear();
            for (const exp of data || []) {
                this.experiments.set(exp.id, {
                    id: exp.id,
                    name: exp.name,
                    type: exp.type,
                    description: exp.description || '',
                    variants: exp.variants || [],
                    startDate: new Date(exp.start_date),
                    endDate: exp.end_date ? new Date(exp.end_date) : undefined,
                    isActive: exp.is_active,
                    targetShopIds: exp.target_shop_ids
                });
            }

            logger.info(`Loaded ${this.experiments.size} active experiments`);
        } catch (error) {
            logger.error('Error loading experiments:', { error });
        }
    }

    /**
     * Get applicable experiments for a shop
     */
    getExperimentsForShop(shopId: string): Experiment[] {
        const applicable: Experiment[] = [];

        for (const exp of this.experiments.values()) {
            if (!exp.isActive) continue;

            // Check if experiment targets specific shops
            if (exp.targetShopIds && exp.targetShopIds.length > 0) {
                if (!exp.targetShopIds.includes(shopId)) continue;
            }

            // Check date range
            const now = new Date();
            if (now < exp.startDate) continue;
            if (exp.endDate && now > exp.endDate) continue;

            applicable.push(exp);
        }

        return applicable;
    }

    /**
     * Select a variant based on weights (deterministic for same user)
     */
    selectVariant(
        experiment: Experiment,
        identifier: string  // customerId or sessionId for consistency
    ): Variant {
        // Create deterministic hash from identifier
        const hash = this.hashString(experiment.id + identifier);
        const randomValue = (hash % 100) + 1;

        // Select variant based on cumulative weights
        let cumulativeWeight = 0;
        for (const variant of experiment.variants) {
            cumulativeWeight += variant.weight;
            if (randomValue <= cumulativeWeight) {
                return variant;
            }
        }

        // Fallback to first variant
        return experiment.variants[0];
    }

    /**
     * Simple string hash function
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Track experiment event
     */
    async trackEvent(result: ExperimentResult): Promise<void> {
        try {
            const supabase = supabaseAdmin();

            await supabase.from('ab_experiment_results').insert({
                experiment_id: result.experimentId,
                variant_id: result.variantId,
                shop_id: result.shopId,
                customer_id: result.customerId || null,
                event_type: result.eventType,
                metadata: result.metadata || {},
                created_at: result.timestamp.toISOString()
            });
        } catch (error) {
            logger.warn('Failed to track experiment event:', { error });
        }
    }

    /**
     * Get experiment results summary
     */
    async getExperimentResults(experimentId: string): Promise<{
        variantId: string;
        variantName: string;
        impressions: number;
        conversions: number;
        conversionRate: number;
    }[]> {
        try {
            const supabase = supabaseAdmin();
            const experiment = this.experiments.get(experimentId);

            if (!experiment) {
                return [];
            }

            const { data, error } = await supabase
                .from('ab_experiment_results')
                .select('variant_id, event_type')
                .eq('experiment_id', experimentId);

            if (error || !data) {
                return [];
            }

            // Aggregate by variant
            const variantStats: Record<string, { impressions: number; conversions: number }> = {};

            for (const variant of experiment.variants) {
                variantStats[variant.id] = { impressions: 0, conversions: 0 };
            }

            for (const row of data) {
                if (!variantStats[row.variant_id]) {
                    variantStats[row.variant_id] = { impressions: 0, conversions: 0 };
                }

                if (row.event_type === 'impression') {
                    variantStats[row.variant_id].impressions++;
                } else if (row.event_type === 'conversion' || row.event_type === 'checkout') {
                    variantStats[row.variant_id].conversions++;
                }
            }

            return experiment.variants.map(v => ({
                variantId: v.id,
                variantName: v.name,
                impressions: variantStats[v.id]?.impressions || 0,
                conversions: variantStats[v.id]?.conversions || 0,
                conversionRate: variantStats[v.id]?.impressions > 0
                    ? (variantStats[v.id].conversions / variantStats[v.id].impressions) * 100
                    : 0
            }));
        } catch (error) {
            logger.error('Error getting experiment results:', { error });
            return [];
        }
    }

    /**
     * Create a new experiment
     */
    async createExperiment(experiment: Omit<Experiment, 'id'>): Promise<string | null> {
        try {
            const supabase = supabaseAdmin();

            const { data, error } = await supabase
                .from('ab_experiments')
                .insert({
                    name: experiment.name,
                    type: experiment.type,
                    description: experiment.description,
                    variants: experiment.variants,
                    start_date: experiment.startDate.toISOString(),
                    end_date: experiment.endDate?.toISOString() || null,
                    is_active: experiment.isActive,
                    target_shop_ids: experiment.targetShopIds || null
                })
                .select('id')
                .single();

            if (error) {
                logger.error('Failed to create experiment:', { error });
                return null;
            }

            // Reload experiments
            await this.loadExperiments();

            return data.id;
        } catch (error) {
            logger.error('Error creating experiment:', { error });
            return null;
        }
    }

    /**
     * Deactivate an experiment
     */
    async deactivateExperiment(experimentId: string): Promise<boolean> {
        try {
            const supabase = supabaseAdmin();

            await supabase
                .from('ab_experiments')
                .update({ is_active: false })
                .eq('id', experimentId);

            this.experiments.delete(experimentId);
            return true;
        } catch (error) {
            logger.error('Error deactivating experiment:', { error });
            return false;
        }
    }
}

// Singleton instance
export const abTestManager = new ABTestManager();

/**
 * Helper to apply experiment to prompt context
 */
export function applyPromptExperiment(
    basePrompt: string,
    variant: Variant
): string {
    const config = variant.config as Record<string, string>;

    // Replace placeholders in prompt
    let modifiedPrompt = basePrompt;

    if (config.appendix) {
        modifiedPrompt += '\n\n' + config.appendix;
    }

    if (config.prefix) {
        modifiedPrompt = config.prefix + '\n\n' + modifiedPrompt;
    }

    if (config.replace) {
        for (const [from, to] of Object.entries(config.replace)) {
            modifiedPrompt = modifiedPrompt.replace(new RegExp(from, 'g'), String(to));
        }
    }

    return modifiedPrompt;
}

/**
 * Helper to get AI model from experiment
 */
export function getModelFromExperiment(
    defaultModel: string,
    variant: Variant
): string {
    const config = variant.config as Record<string, string>;
    return config.model || defaultModel;
}
