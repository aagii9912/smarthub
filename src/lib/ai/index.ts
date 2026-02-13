/**
 * AI Module Exports
 * 
 * Main entry point for AI functionality
 */

// Main AI Router (recommended for new code)
export {
    routeToAI,
    analyzeProductImageWithPlan,
    type RouterChatContext,
    type RouterResponse,
} from './AIRouter';

// Plan configuration
export {
    type PlanType,
    type AIProvider,
    type AIModel,
    type PlanAIConfig,
    PLAN_CONFIGS,
    getPlanConfig,
    getPlanTypeFromSubscription,
    isToolEnabledForPlan,
    getEnabledToolsForPlan,
    checkMessageLimit,
    MODEL_DISPLAY_NAMES,
    PLAN_DISPLAY_NAMES,
} from './config/plans';

// Services
export { buildSystemPrompt } from './services/PromptService';
export { executeTool, type ToolExecutionContext, type ToolExecutionResult } from './services/ToolExecutor';
export { parseProductDataWithAI } from './services/ProductParser';

// Tools
export { AI_TOOLS, type ToolName } from './tools/definitions';
