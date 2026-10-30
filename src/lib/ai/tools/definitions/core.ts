import type Anthropic from '@anthropic-ai/sdk';

/**
 * Capability tag — must match the AgentCapability union in
 * `src/lib/ai/agents/types.ts`. Tools list which capabilities they
 * are valid for; the AI Router uses this to gate tool exposure.
 */
export type ToolCapability =
    | 'sales'
    | 'booking'
    | 'information'
    | 'support'
    | 'lead_capture';

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required: string[];
    };
    /**
     * Capabilities that this tool supports. The AI Router exposes the
     * tool only when the shop's role/capabilities include at least one
     * of these. Tools without `capabilities` are treated as universal.
     */
    capabilities?: ToolCapability[];
}

/**
 * Convert internal tool definitions to Anthropic Messages API tools.
 * Only the JSON-schema keys we actually use are forwarded (type, description,
 * enum, items) so stray metadata never leaks into the API payload.
 */
export function getClaudeTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => {
        const properties: Record<string, unknown> = {};

        for (const [key, prop] of Object.entries(tool.parameters.properties)) {
            const schemaProp: Record<string, unknown> = {
                type: prop.type,
                description: prop.description,
            };
            if (prop.enum) schemaProp.enum = prop.enum;
            if (prop.items) schemaProp.items = { type: prop.items.type };
            properties[key] = schemaProp;
        }

        return {
            name: tool.name,
            description: tool.description,
            input_schema: {
                type: 'object',
                properties,
                required: tool.parameters.required,
            },
        };
    });
}
