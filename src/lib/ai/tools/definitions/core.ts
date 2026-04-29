import { type FunctionDeclaration, SchemaType } from '@google/generative-ai';

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

export function toSchemaType(type: string): SchemaType {
    switch (type) {
        case 'string': return SchemaType.STRING;
        case 'number': return SchemaType.NUMBER;
        case 'integer': return SchemaType.INTEGER;
        case 'boolean': return SchemaType.BOOLEAN;
        case 'array': return SchemaType.ARRAY;
        case 'object': return SchemaType.OBJECT;
        default: return SchemaType.STRING;
    }
}

export function getGeminiFunctionDeclarations(tools: ToolDefinition[]): FunctionDeclaration[] {
    return tools.map(tool => {
        const properties: Record<string, any> = {};

        for (const [key, prop] of Object.entries(tool.parameters.properties)) {
            const schemaProp: Record<string, unknown> = {
                type: toSchemaType(prop.type),
                description: prop.description,
            };
            if (prop.enum) schemaProp.enum = prop.enum;
            if (prop.items) schemaProp.items = { type: toSchemaType(prop.items.type) };
            properties[key] = schemaProp;
        }

        return {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: SchemaType.OBJECT,
                properties,
                required: tool.parameters.required,
            },
        } as FunctionDeclaration;
    });
}
